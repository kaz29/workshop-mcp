import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { GitHubService } from '../github/github.service';

/**
 * 「時間が余った人へ」の解答例（ツール層）
 *
 * Step 2 の get_contributions に、3 つのツールを追加したものです。
 *   - get_reviews              … 自分がレビューした PR
 *   - get_repositories         … リポジトリ一覧
 *   - get_pull_request_detail  … PR 1件の詳細
 *
 * 使い方（リポジトリ直下で。自分で書いた内容は消えます）
 *   cp complete/extra/github.service.ts starter/src/github/github.service.ts
 *   cp complete/extra/github.tool.ts starter/src/mcp/github.tool.ts
 *   npm run build
 *   → AI クライアントを再起動（または MCP サーバーを再接続）
 */
@Injectable()
export class GithubMcpTool {
  constructor(private readonly githubService: GitHubService) {}

  @Tool({
    name: 'get_contributions',
    description:
      'GitHubのコントリビューション履歴（コミットとPR）を取得する。PRの number は get_pull_request_detail に渡せる',
    parameters: z.object({
      username: z.string().optional()
        .describe('GitHubユーザー名。省略するとトークンの持ち主（自分）のデータ'),
      days: z.number().optional().describe('取得する日数（デフォルト30日）'),
    }),
  })
  async getContributions({ username, days = 30 }: { username?: string; days?: number }) {
    return this.githubService.getContributions(username, days);
  }

  @Tool({
    name: 'get_reviews',
    description:
      'ユーザーがレビューした他の人のPRの一覧を取得する（自分のPRは含まない）。' +
      '「書いたPRとレビューしたPRの比較」や「誰のPRをよくレビューしているか」の分析に使う。' +
      'PRの number は get_pull_request_detail に渡せる',
    parameters: z.object({
      username: z.string().optional()
        .describe('GitHubユーザー名。省略するとトークンの持ち主（自分）のデータ'),
      days: z.number().optional().describe('PRの作成日で何日前まで遡るか（デフォルト30日）'),
    }),
  })
  async getReviews({ username, days = 30 }: { username?: string; days?: number }) {
    return this.githubService.getReviews(username, days);
  }

  @Tool({
    name: 'get_repositories',
    description:
      'ユーザーのリポジトリ一覧（言語・スター数・フォーク数・作成日時・最終push日時）を、最近pushされた順に最大100件取得する。' +
      '自分の場合は private リポジトリも含む',
    parameters: z.object({
      username: z.string().optional()
        .describe('GitHubユーザー名。省略するとトークンの持ち主（自分）のリポジトリ'),
    }),
  })
  async getRepositories({ username }: { username?: string }) {
    return this.githubService.getRepositories(username);
  }

  @Tool({
    name: 'get_pull_request_detail',
    description:
      'PR 1件の詳細（追加行数・削除行数・変更ファイル数・コミット数・コメント数・本文の冒頭）を取得する。' +
      'repo と number は get_contributions や get_reviews の結果から使う',
    parameters: z.object({
      repo: z.string().describe('リポジトリ名。"owner/name" 形式（例: kaz29/workshop-mcp）'),
      number: z.number().describe('PR番号'),
    }),
  })
  async getPullRequestDetail({ repo, number }: { repo: string; number: number }) {
    return this.githubService.getPullRequestDetail(repo, number);
  }
}
