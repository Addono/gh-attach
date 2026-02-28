/**
 * MCP server command implementation.
 */
import { createMCPServer } from "../../mcp/index.js";
import { debug } from "../output.js";

interface McpOptions {
  transport?: string;
  port?: string;
}

export async function mcpCommand(options: McpOptions) {
  const transport = (options.transport || "stdio") as "stdio" | "http";
  const port = options.port ? parseInt(options.port, 10) : 3000;
  debug(`Starting MCP server (transport=${transport}, port=${port})`);

  await createMCPServer(transport, port);
}
