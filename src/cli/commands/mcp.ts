/**
 * MCP server command implementation.
 */
import { createMCPServer } from "../../mcp/index.js";

interface McpOptions {
  transport?: string;
  port?: string;
}

export async function mcpCommand(options: McpOptions) {
  const transport = (options.transport || "stdio") as "stdio" | "http";
  const port = options.port ? parseInt(options.port, 10) : 3000;

  await createMCPServer(transport, port);
}
