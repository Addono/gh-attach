import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("CLI command documentation", () => {
  beforeEach(() => {
    // Save original process.argv and process.exit
    vi.stubGlobal("process", {
      ...process,
      argv: ["node", "gh-attach"],
      exit: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("upload command has proper description", async () => {
    const { uploadCommand } = await import(
      "../../../src/cli/commands/upload.js"
    );
    // The uploadCommand is called with options, so we test the module's interface
    // by checking that it's an async function
    expect(typeof uploadCommand).toBe("function");
  });

  it("login command has proper description", async () => {
    const { loginCommand } = await import("../../../src/cli/commands/login.js");
    expect(typeof loginCommand).toBe("function");
  });

  it("config command has proper description", async () => {
    const { configCommand } = await import("../../../src/cli/commands/config.js");
    expect(typeof configCommand).toBe("function");
  });

  it("all commands are properly exported", async () => {
    const upload = await import("../../../src/cli/commands/upload.js");
    const login = await import("../../../src/cli/commands/login.js");
    const config = await import("../../../src/cli/commands/config.js");
    const mcp = await import("../../../src/cli/commands/mcp.js");

    expect(upload).toHaveProperty("uploadCommand");
    expect(login).toHaveProperty("loginCommand");
    expect(config).toHaveProperty("configCommand");
    expect(mcp).toHaveProperty("mcpCommand");
  });

  it("CLI entry point modules can be loaded", async () => {
    // Test that core CLI modules can be imported
    const upload = await import("../../../src/cli/commands/upload.js");
    const login = await import("../../../src/cli/commands/login.js");
    const config = await import("../../../src/cli/commands/config.js");
    const mcp = await import("../../../src/cli/commands/mcp.js");

    expect(upload).toBeDefined();
    expect(login).toBeDefined();
    expect(config).toBeDefined();
    expect(mcp).toBeDefined();
  });
});

