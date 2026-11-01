import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { GitHubService } from '../github/github.service';

/**
 * Step 2 の解答例です。詰まったときだけ見てください。
 *
 * 使い方（リポジトリ直下で）
 *   cp complete/github.tool.ts starter/src/mcp/github.tool.ts
 *   npm run build
 *   → AI クライアントを再起動（または MCP サーバーを再接続）
 */
@Injectable()
export class GithubMcpTool {
  constructor(private readonly githubService: GitHubService) {}

  @Tool({
    name: 'get_contributions',
    description: 'GitHubのコントリビューション履歴（コミットとPR）を取得する',
    parameters: z.object({
      username: z.string().optional()
        .describe('GitHubユーザー名。省略するとトークンの持ち主（自分）のデータ'),
      days: z.number().optional().describe('取得する日数（デフォルト30日）'),
    }),
  })
  async getContributions({ username, days = 30 }: { username?: string; days?: number }) {
    return this.githubService.getContributions(username, days);
  }
}
