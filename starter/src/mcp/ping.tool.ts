import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';

@Injectable()
export class PingTool {
  @Tool({
    name: 'ping',
    description: 'サーバーの疎通確認',
  })
  async ping() {
    return 'pong!';
  }
}
