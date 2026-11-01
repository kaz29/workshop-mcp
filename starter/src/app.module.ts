import { Module } from '@nestjs/common';
import { McpModule, McpTransportType } from '@rekog/mcp-nest';
import { McpToolsModule } from './mcp/mcp.module';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'workshop-mcp',
      version: '1.0.0',
      transport: McpTransportType.STDIO,
    }),
    McpToolsModule,
  ],
})
export class AppModule {}
