# ダッシュボードの前にMCPを書こう

PHPMatsuri Reboot 2026 ワークショップ用リポジトリです。
NestJS + [`@rekog/mcp-nest`](https://github.com/rekog-labs/MCP-Nest) で MCP サーバーを作り、MCP 対応の AI クライアントから自分の GitHub データを自然言語で分析します。

## 事前準備（当日までにお願いします）

当日は講師1人で進行します。**会場で環境構築のサポートはほぼできない** ので、必ず事前に `npm run doctor` まで済ませてください。

### 必要なもの

- Node.js 20 以上
- MCP に対応した AI クライアント（どれでもOK）
  - 例：Claude Desktop / Claude Code / VS Code + GitHub Copilot / Cursor など
- GitHub アカウントと Personal Access Token（PAT）

### GitHub PAT の発行

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 「Generate new token (classic)」
3. `repo` スコープにチェック（public リポジトリだけで良ければチェックなしでもOK）
4. 発行されたトークン（`ghp_...`）をコピー

### セットアップ

```bash
git clone https://github.com/kaz29/workshop-mcp
cd workshop-mcp
npm install
cp .env.example .env
# .env を開いて GITHUB_TOKEN=ghp_xxxx を記入
npm run build
npm run doctor
```

`npm run doctor` で ✅ が並び、「🎉 準備OKです！」と出れば完了です。
❌ が出たら、その下の「→」に書かれた手順で直してから、もう一度 `npm run doctor` を実行してください。

最後に表示される設定の JSON に、MCP サーバーの起動に必要な **`command`（node の絶対パス）と `args`（main.js の絶対パス）** が入っています。当日 Step 1 で使います（その場でもう一度 `npm run doctor` すれば出ます）。

## 当日の流れ

| Step | 内容 |
|------|------|
| Step 1 | MCP サーバーを AI クライアントに繋いで、`ping` ツールを呼ぶ |
| Step 2 | `starter/src/mcp/github.tool.ts` に GitHub のツールを書いて、自然言語で分析する |

### AI クライアントへの設定（Step 1）

どのクライアントでも、やることは同じです。

1. `npm run doctor` が出力した `command` と `args` の値を、使っているクライアントの MCP 設定に書く
2. クライアントを再起動する（または MCP サーバーを再接続する）
3. 「pingして」と話しかけて `pong!` が返れば成功

以下の `<command>` `<args>` は、doctor が出力した値に置き換えてください。

#### Claude Desktop

設定 → 開発者 → 「設定を編集」で `claude_desktop_config.json` を開いて追加します（doctor の出力をそのまま貼ればOK）。
すでに `mcpServers` がある場合は `"workshop-mcp": {...}` の部分だけ追加してください。

```json
{
  "mcpServers": {
    "workshop-mcp": {
      "command": "<command>",
      "args": ["<args>"]
    }
  }
}
```

追加したら **完全に終了（⌘Q / タスクトレイから終了）** して起動し直します。

#### Claude Code

```bash
claude mcp add workshop-mcp -- node [YOUR_PATH]/workshop-mcp/starter/dist/main.js
```

Claude Code を起動して `/mcp` で `workshop-mcp` が connected になっていればOKです。

#### VS Code + GitHub Copilot

ワークスペースに `.vscode/mcp.json` を作ります（**キーが `servers` で、`mcpServers` ではない** ので注意）。

```json
{
  "servers": {
    "workshop-mcp": {
      "type": "stdio",
      "command": "<command>",
      "args": ["<args>"]
    }
  }
}
```

Copilot Chat を **エージェントモード** にすると、ツールが使えるようになります。

#### Cursor

`~/.cursor/mcp.json`（全プロジェクト共通）に追加します。書式は Claude Desktop と同じです。

```json
{
  "mcpServers": {
    "workshop-mcp": {
      "command": "<command>",
      "args": ["<args>"]
    }
  }
}
```

#### その他のクライアント

stdio 方式の MCP サーバーとして、`command` と `args` を指定できるクライアントなら使えます。各クライアントのドキュメントを参照してください。

### コードを変更したら

```bash
npm run build
```

してから、AI クライアントを再起動（または MCP サーバーを再接続）してください。そうしないと新しいツールが読み込まれません。

### Step 2 で詰まったら

解答例を上書きコピーして、ビルドし直してください（自分で書いた内容は消えます）。

```bash
cp complete/github.tool.ts starter/src/mcp/github.tool.ts
npm run build
```

### 時間が余った人へ

ツールを増やして、AI に聞けることを広げてみましょう。おすすめは次の 3 つです。

| ツール | 取ってくるもの | AI への質問例 |
|--------|----------------|---------------|
| `get_reviews` | 自分がレビューした他の人の PR | 「書いた PR とレビューした PR、どっちが多い？」「誰の PR をよくレビューしてる？」 |
| `get_repositories` | リポジトリ一覧（言語・スター数・最終 push 日時） | 「よく使う言語は？」「半年以上放置しているリポジトリは？」 |
| `get_pull_request_detail` | PR 1 件の詳細（追加・削除行数、変更ファイル数、コメント数） | 「大きい PR ほどマージに時間がかかってる？」 |

ヒント

- 今度は `GitHubService`（`starter/src/github/github.service.ts`）にもメソッドを足します。中にある `request()`（REST API）と `search()`（Search API）が使えます
- `get_reviews` は、`getContributions()` の PR 検索のクエリを `type:pr reviewed-by:<ユーザー名> -author:<ユーザー名>` に変えるだけで作れます
- `get_pull_request_detail` には PR 番号が必要です。`PullRequest` に `number` を追加しておくと、AI が `get_contributions` の結果から番号を拾ってくれます
- description に「どのツールと組み合わせて使うか」を書くと、AI がツールを連携して使ってくれます

解答例（自分で書いた内容は消えます）

```bash
cp complete/extra/github.service.ts starter/src/github/github.service.ts
cp complete/extra/github.tool.ts starter/src/mcp/github.tool.ts
npm run build
```

## ディレクトリ構成

```
workshop-mcp/
├── .env                 # GITHUB_TOKEN（自分で作成）
├── scripts/doctor.mjs   # 環境チェック
├── complete/
│   ├── github.tool.ts   # Step 2 の解答例（詰まったときだけ）
│   └── extra/           # 「時間が余った人へ」の解答例
└── starter/             # ここで作業します
    └── src/
        ├── main.ts                     # エントリーポイント（stdio）
        ├── app.module.ts               # MCP の設定
        ├── github/github.service.ts    # GitHub からデータを取る（完成済み・触らなくてOK）
        └── mcp/
            ├── mcp.module.ts           # ツールの登録
            ├── ping.tool.ts            # 疎通確認用ツール
            └── github.tool.ts          # ← Step 2 でここを書く
```

## トラブルシューティング

### ping が呼べない / ツールが出てこない

ほとんどが次の3つのどれかです。

1. **設定のパスが相対パスになっている** → `npm run doctor` が出力した絶対パスをそのまま使ってください
2. **クライアントを再起動していない** → Claude Desktop はウィンドウを閉じるだけでは不十分です（⌘Q / タスクトレイから終了）。他のクライアントは MCP サーバーの再接続・再起動をしてください
3. **ビルドしていない** → `npm run build` してから再起動してください

それでもダメなときは、クライアントの MCP ログを確認してください。

- Claude Desktop（macOS）: `~/Library/Logs/Claude/mcp-server-workshop-mcp.log`
- Claude Desktop（Windows）: `%APPDATA%\Claude\logs\mcp-server-workshop-mcp.log`
- Claude Code: `claude --debug` で起動
- VS Code: `.vscode/mcp.json` を開くと出る「Start / Show Output」から確認

### 「MCPサーバーとして起動できませんでした」と出る

コードに `console.log` を書いていませんか？
このサーバーは stdio（標準入出力）で AI クライアントと通信しているため、`console.log` の出力が混ざると通信が壊れます。デバッグ出力には `console.error` を使ってください。

### `npm install` でエラーが出る

Node.js のバージョンを確認してください（`node -v` で 20 以上）。
`node_modules` と `package-lock.json` を変更していなければ、`rm -rf node_modules && npm install` で直ることがあります。

### nvm / volta などで Node.js を管理している

`npm run doctor` が出力する `command` には、node の絶対パスが入っています。
`"command": "node"` のままだと、AI クライアントが古い Node.js や存在しないパスを使ってしまうことがあるので、出力された値をそのまま使ってください。
