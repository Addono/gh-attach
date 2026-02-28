import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/mcp/index.js", () => ({
  createMCPServer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../src/cli/output.js", () => ({
  debug: vi.fn(),
  info: vi.fn(),
  globalOptions: { verbose: false, quiet: false, noColor: false },
}));

import { mcpCommand } from "../../../../src/cli/commands/mcp.js";
import { createMCPServer } from "../../../../src/mcp/index.js";

describe("mcpCommand unit tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to stdio transport on port 3000", async () => {
    await mcpCommand({});
    expect(createMCPServer).toHaveBeenCalledWith("stdio", 3000);
  });

  it("uses specified transport", async () => {
    await mcpCommand({ transport: "http" });
    expect(createMCPServer).toHaveBeenCalledWith("http", 3000);
  });

  it("parses port from string option", async () => {
    await mcpCommand({ transport: "http", port: "8080" });
    expect(createMCPServer).toHaveBeenCalledWith("http", 8080);
  });

  it("propagates errors from createMCPServer", async () => {
    vi.mocked(createMCPServer).mockRejectedValue(new Error("bind failed"));
    await expect(mcpCommand({ transport: "http", port: "80" })).rejects.toThrow(
      "bind failed",
    );
  });
});
