import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { mcpInternals } from "../../../src/mcp/index.js";

describe("MCP Streamable HTTP transport", () => {
  let baseUrl: URL;
  let closeServer: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const started = await mcpInternals.startHttpServer(0);
    closeServer = started.close;
    baseUrl = new URL(`http://127.0.0.1:${started.port}/`);
  });

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
    }
  });

  it("serves /health", async () => {
    const res = await fetch(new URL("/health", baseUrl));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; version: string };
    expect(body.status).toBe("ok");
    expect(typeof body.version).toBe("string");
    expect(body.version.length).toBeGreaterThan(0);
  });

  it("supports initialize + tools/list + tools/call over Streamable HTTP", async () => {
    const transport = new StreamableHTTPClientTransport(baseUrl);
    const client = new Client(
      { name: "gh-attach-test", version: "0.0.0" },
      { capabilities: {} },
    );

    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.some((t) => t.name === "upload_image")).toBe(true);

    const result = await client.callTool({
      name: "check_auth",
      arguments: {},
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.type).toBe("text");

    const parsed = JSON.parse(result.content[0]?.text ?? "{}") as {
      authenticated?: unknown;
    };
    expect(typeof parsed.authenticated).toBe("boolean");

    await client.close();
  });
});
