import { Module } from '@nestjs/common';
import { GitHubService } from '../github/github.service';
import { PingTool } from './ping.tool';
import { GithubMcpTool } from './github.tool';

@Module({
  providers: [
    // サービス層（データ取得）
    GitHubService,
    // ツール層（MCPインターフェース）
    PingTool,
    GithubMcpTool,
  ],
})
export class McpToolsModule {}
