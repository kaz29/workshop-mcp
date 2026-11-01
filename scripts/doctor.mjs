// ワークショップの環境チェック（npm run doctor）
// ❌ が出たら、表示される「→」の手順で直してから再実行してください。
import { existsSync, readFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN_JS = path.join(ROOT, 'starter', 'dist', 'main.js');
const ENV_FILE = path.join(ROOT, '.env');

let failed = 0;
const ok = (msg) => console.log(`✅ ${msg}`);
const warn = (msg, hint) => console.log(`⚠️  ${msg}${hint ? `\n   → ${hint}` : ''}`);
const ng = (msg, hint) => {
  failed++;
  console.log(`❌ ${msg}${hint ? `\n   → ${hint}` : ''}`);
};

console.log('\n🩺 ワークショップ環境チェック\n');

// 1. Node.js
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor >= 20) {
  ok(`Node.js ${process.versions.node}`);
} else {
  ng(`Node.js ${process.versions.node}（20以上が必要）`, 'https://nodejs.org/ から Node.js 20 以上をインストールしてください');
}

// 2. 依存パッケージ
const installed = existsSync(path.join(ROOT, 'node_modules', '@rekog', 'mcp-nest'));
if (installed) {
  ok('依存パッケージ（npm install 済み）');
} else {
  ng('依存パッケージがインストールされていません', 'リポジトリ直下で npm install を実行してください');
}

// 3. .env と GITHUB_TOKEN
const token = readToken();
if (!existsSync(ENV_FILE)) {
  ng('.env がありません', 'cp .env.example .env を実行して、GITHUB_TOKEN を記入してください');
} else if (!token) {
  ng('.env に GITHUB_TOKEN が入っていません', '.env を開いて GITHUB_TOKEN=ghp_xxxx のように記入してください');
} else {
  ok('.env に GITHUB_TOKEN が設定されています');
}

// 4. GitHub API
if (token) {
  await checkGitHub(token);
}

// 5. ビルド
const built = existsSync(MAIN_JS);
if (built) {
  ok('ビルド済み（starter/dist/main.js）');
} else {
  ng('ビルドされていません', 'npm run build を実行してください');
}

// 6. MCPサーバーとして起動できるか
if (installed && built) {
  await checkMcpServer();
}

// 7. Claude Desktop（使うクライアントは人それぞれなので、入っている人にだけ設定状況を表示する）
const desktop = claudeDesktopPaths();
if (desktop?.app) {
  checkDesktopConfig(desktop.config);
}

printClientConfig();

if (failed > 0) {
  console.log(`\n❌ が ${failed} 件あります。上の「→」の手順で直して、もう一度 npm run doctor を実行してください。\n`);
  process.exit(1);
}
console.log('\n🎉 準備OKです！当日お会いしましょう。\n');

// ---------------------------------------------------------------------------

function readToken() {
  if (!existsSync(ENV_FILE)) return '';
  const line = readFileSync(ENV_FILE, 'utf-8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith('GITHUB_TOKEN='));
  return line ? line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
}

async function checkGitHub(token) {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'workshop-mcp-doctor',
      },
    });
    if (res.status === 401) {
      ng('GitHub のトークンが無効です', 'トークンの期限切れ・コピーミスがないか確認し、必要なら再発行してください');
      return;
    }
    if (!res.ok) {
      ng(`GitHub API がエラーを返しました（${res.status}）`, await res.text());
      return;
    }
    const user = await res.json();
    ok(`GitHub API に接続できました（@${user.login}）`);

    // classic トークンのときだけスコープが返ってくる
    const scopes = res.headers.get('x-oauth-scopes');
    if (scopes !== null && !scopes.split(',').map((s) => s.trim()).includes('repo')) {
      warn('トークンに repo スコープがありません（private リポジトリが取れません）', 'public だけで良ければこのままでOKです');
    }
  } catch (e) {
    ng('GitHub API に接続できません', `ネットワークを確認してください（${e.message}）`);
  }
}

async function checkMcpServer() {
  let stderr = '';
  let client;
  try {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

    // Claude Desktop と同じく、リポジトリ外のディレクトリから起動する
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [MAIN_JS],
      cwd: homedir(),
      stderr: 'pipe',
    });
    transport.stderr?.on('data', (chunk) => (stderr += chunk));

    client = new Client({ name: 'workshop-doctor', version: '1.0.0' });
    const { tools } = await withTimeout(
      (async () => {
        await client.connect(transport);
        return client.listTools();
      })(),
      15000,
    );

    const names = tools.map((t) => t.name);
    if (names.includes('ping')) {
      ok(`MCPサーバーとして起動できました（ツール: ${names.join(', ')}）`);
    } else {
      ng(`MCPサーバーは起動しましたが ping ツールがありません（ツール: ${names.join(', ') || 'なし'}）`, 'starter/src/mcp/ping.tool.ts と mcp.module.ts を確認してください');
    }
  } catch (e) {
    ng('MCPサーバーとして起動できませんでした', `${e.message}${stderr ? `\n   ${stderr.trim().split('\n').join('\n   ')}` : ''}\n   → コードを変更した場合は console.log を使っていないか確認し、npm run build し直してください`);
  } finally {
    await client?.close().catch(() => {});
  }
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${ms / 1000}秒以内に応答がありませんでした`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function claudeDesktopPaths() {
  if (platform() === 'darwin') {
    return {
      app: ['/Applications/Claude.app', path.join(homedir(), 'Applications', 'Claude.app')].some(existsSync),
      config: path.join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    };
  }
  if (platform() === 'win32') {
    return {
      app: existsSync(path.join(process.env.LOCALAPPDATA ?? '', 'AnthropicClaude')),
      config: path.join(process.env.APPDATA ?? '', 'Claude', 'claude_desktop_config.json'),
    };
  }
  return null;
}

// 設定済みのときだけ ✅ を出す。未設定は当日 Step 1 でやるので何も言わない
function checkDesktopConfig(configPath) {
  if (!existsSync(configPath)) return;
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const servers = Object.values(config.mcpServers ?? {});
    if (servers.some((s) => (s.args ?? []).includes(MAIN_JS))) {
      ok('Claude Desktop にこのサーバーが設定済みです');
    }
  } catch (e) {
    warn('Claude Desktop の設定ファイルが JSON として読めません', `Claude Desktop を使う場合は ${configPath} の書式を確認してください（${e.message}）`);
  }
}

function printClientConfig() {
  const quote = (s) => (s.includes(' ') ? `"${s}"` : s);
  const json = JSON.stringify(
    { mcpServers: { 'workshop-mcp': { command: process.execPath, args: [MAIN_JS] } } },
    null,
    2,
  );

  console.log('\n📋 MCP クライアントの設定（Step 1 で使います）');
  console.log('   どのクライアントでも、この2つを設定します\n');
  console.log(`   command: ${process.execPath}`);
  console.log(`   args:    ${MAIN_JS}`);
  console.log('\n   Claude Desktop / Cursor などの JSON 形式（すでに mcpServers がある場合は "workshop-mcp": {...} だけ追加）\n');
  console.log(json.replace(/^/gm, '   '));
  console.log('\n   Claude Code の場合\n');
  console.log(`   claude mcp add workshop-mcp -- ${quote(process.execPath)} ${quote(MAIN_JS)}`);
  console.log('\n   その他のクライアント（VS Code など）の書き方は README を参照してください');
}
