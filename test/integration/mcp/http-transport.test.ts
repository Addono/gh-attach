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

  it("returns 404 for unknown paths", async () => {
    const res = await fetch(new URL("/unknown", baseUrl));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Not found");
  });

  it("returns 400 for POST with empty body", async () => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "  ",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Missing request body");
  });

  it("returns 400 for POST with invalid JSON", async () => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid json!",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Invalid JSON");
  });

  it("returns 400 for POST with non-initialize request and no session ID", async () => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1,
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Missing mcp-session-id header");
  });

  it("returns 404 for POST with unknown session ID", async () => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "mcp-session-id": "nonexistent-session-id",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1,
      }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Session not found");
  });

  it("returns 405 for GET without session ID", async () => {
    const res = await fetch(baseUrl, { method: "GET" });
    expect(res.status).toBe(405);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Method not allowed");
  });

  it("returns 404 for GET with unknown session ID", async () => {
    const res = await fetch(baseUrl, {
      method: "GET",
      headers: { "mcp-session-id": "nonexistent" },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Session not found");
  });

  it("returns 404 for DELETE with unknown session ID", async () => {
    const res = await fetch(baseUrl, {
      method: "DELETE",
      headers: { "mcp-session-id": "nonexistent" },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Session not found");
  });
});
