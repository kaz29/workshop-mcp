import { Injectable } from '@nestjs/common';
// import { Tool } from '@rekog/mcp-nest';
// import { z } from 'zod';
import { GitHubService } from '../github/github.service';

/**
 * Step 2：ここに GitHub のツールを書きます。
 *
 * やること
 *   1. @Tool() デコレータでツールを定義する（name / description / parameters）
 *   2. GitHubService の getContributions(username, days) を呼んで、結果をそのまま返す
 *
 * ヒント
 *   - ping.tool.ts が最小の例です
 *   - description と .describe() は AI が読むドキュメントです。丁寧に書くほど AI が上手に使ってくれます
 *   - 分析ロジックは書かなくてOK。データを返せば AI が集計・分析します
 */
@Injectable()
export class GithubMcpTool {
  constructor(private readonly githubService: GitHubService) {}

  // TODO: ここにツールを書く
}
