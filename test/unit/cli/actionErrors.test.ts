import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AuthenticationError,
  ValidationError,
  UploadError,
} from "../../../src/core/types.js";

/**
 * Tests for the CLI program's action error handlers — the catch blocks
 * in src/cli/index.ts that map errors to exit codes and stderr output.
 *
 * We mock Commander.parse() to prevent side effects from the module-level
 * call, then exercise each command's action callback by invoking the
 * Commander-registered _actionHandler with the correct args format.
 */

vi.mock("commander", async (importOriginal) => {
  const actual = await importOriginal<typeof import("commander")>();
  const OriginalCommand = actual.Command;
  class MockCommand extends OriginalCommand {
    parse() {
      return this;
    }
  }
  return { ...actual, Command: MockCommand };
});

// Mock command implementations so we can control their throw behavior
const mockUploadCommand = vi.fn();
const mockLoginCommand = vi.fn();
const mockConfigCommand = vi.fn();
const mockMcpCommand = vi.fn();

vi.mock("../../../src/cli/commands/upload.js", () => ({
  uploadCommand: (...args: unknown[]) => mockUploadCommand(...args),
}));
vi.mock("../../../src/cli/commands/login.js", () => ({
  loginCommand: (...args: unknown[]) => mockLoginCommand(...args),
}));
vi.mock("../../../src/cli/commands/config.js", () => ({
  configCommand: (...args: unknown[]) => mockConfigCommand(...args),
}));
vi.mock("../../../src/cli/commands/mcp.js", () => ({
  mcpCommand: (...args: unknown[]) => mockMcpCommand(...args),
}));

import type { Command } from "commander";

let createProgram: () => Command;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import("../../../src/cli/index.js");
  createProgram = mod.createProgram;
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Invoke a subcommand's action handler using Commander's internal
 * _actionHandler interface: a single args array, from which the
 * listener extracts positional args and appends opts() + command.
 */
async function invokeAction(
  program: Command,
  name: string,
  args: unknown[],
): Promise<void> {
  const cmd = program.commands.find((c) => c.name() === name);
  if (!cmd) throw new Error(`command ${name} not found`);
  const handler = (
    cmd as unknown as {
      _actionHandler: (a: unknown[]) => Promise<void>;
    }
  )._actionHandler;
  if (!handler) throw new Error(`no action handler on ${name}`);
  await handler(args);
}

describe("CLI action error handlers", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as unknown as (code?: number) => never);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe("preAction hook sets globalOptions", () => {
    it("sets verbose from --verbose flag", async () => {
      mockUploadCommand.mockResolvedValue(undefined);
      const program = createProgram();
      await program.parseAsync([
        "node",
        "gh-attach",
        "--verbose",
        "upload",
        "--target",
        "a/b#1",
        "test.png",
      ]);

      const { globalOptions } = await import("../../../src/cli/output.js");
      expect(globalOptions.verbose).toBe(true);
    });

    it("sets quiet from --quiet flag", async () => {
      mockUploadCommand.mockResolvedValue(undefined);
      const program = createProgram();
      await program.parseAsync([
        "node",
        "gh-attach",
        "--quiet",
        "upload",
        "--target",
        "a/b#1",
        "test.png",
      ]);

      const { globalOptions } = await import("../../../src/cli/output.js");
      expect(globalOptions.quiet).toBe(true);
    });

    it("sets noColor from --no-color flag", async () => {
      mockUploadCommand.mockResolvedValue(undefined);
      const program = createProgram();
      await program.parseAsync([
        "node",
        "gh-attach",
        "--no-color",
        "upload",
        "--target",
        "a/b#1",
        "test.png",
      ]);

      const { globalOptions } = await import("../../../src/cli/output.js");
      expect(globalOptions.noColor).toBe(true);
    });
  });

  describe("upload command error handling", () => {
    it("should exit with code 3 for ValidationError", async () => {
      mockUploadCommand.mockRejectedValue(
        new ValidationError("Bad file", "UNSUPPORTED_FORMAT", {}),
      );

      const program = createProgram();
      await invokeAction(program, "upload", [["test.png"]]);

      expect(stderrSpy).toHaveBeenCalledWith("Error: Bad file");
      expect(exitSpy).toHaveBeenCalledWith(3);
    });

    it("should exit with code 2 for AuthenticationError", async () => {
      mockUploadCommand.mockRejectedValue(
        new AuthenticationError("No session", "SESSION_EXPIRED", {}),
      );

      const program = createProgram();
      await invokeAction(program, "upload", [["test.png"]]);

      expect(stderrSpy).toHaveBeenCalledWith("Error: No session");
      expect(exitSpy).toHaveBeenCalledWith(2);
    });

    it("should exit with code 4 for UploadError", async () => {
      mockUploadCommand.mockRejectedValue(
        new UploadError("Network failed", "UPLOAD_FAILED", {}),
      );

      const program = createProgram();
      await invokeAction(program, "upload", [["test.png"]]);

      expect(stderrSpy).toHaveBeenCalledWith("Error: Network failed");
      expect(exitSpy).toHaveBeenCalledWith(4);
    });

    it("should handle non-Error thrown values", async () => {
      mockUploadCommand.mockRejectedValue("string error");

      const program = createProgram();
      await invokeAction(program, "upload", [["test.png"]]);

      expect(stderrSpy).toHaveBeenCalledWith("Error: string error");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("login command error handling", () => {
    it("should exit with code 2 for AuthenticationError", async () => {
      mockLoginCommand.mockRejectedValue(
        new AuthenticationError("Auth failed", "SESSION_EXPIRED", {}),
      );

      const program = createProgram();
      await invokeAction(program, "login", []);

      expect(stderrSpy).toHaveBeenCalledWith("Error: Auth failed");
      expect(exitSpy).toHaveBeenCalledWith(2);
    });

    it("should handle non-Error thrown values", async () => {
      mockLoginCommand.mockRejectedValue(42);

      const program = createProgram();
      await invokeAction(program, "login", []);

      expect(stderrSpy).toHaveBeenCalledWith("Error: 42");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("config command error handling", () => {
    it("should exit with code 1 for general errors", async () => {
      mockConfigCommand.mockRejectedValue(new Error("Config broken"));

      const program = createProgram();
      await invokeAction(program, "config", ["list"]);

      expect(stderrSpy).toHaveBeenCalledWith("Error: Config broken");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should handle non-Error thrown values", async () => {
      mockConfigCommand.mockRejectedValue(null);

      const program = createProgram();
      await invokeAction(program, "config", ["list"]);

      expect(stderrSpy).toHaveBeenCalledWith("Error: null");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("mcp command error handling", () => {
    it("should exit with code 1 for general errors", async () => {
      mockMcpCommand.mockRejectedValue(new Error("MCP failed"));

      const program = createProgram();
      await invokeAction(program, "mcp", []);

      expect(stderrSpy).toHaveBeenCalledWith("Error: MCP failed");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should handle non-Error thrown values", async () => {
      mockMcpCommand.mockRejectedValue(undefined);

      const program = createProgram();
      await invokeAction(program, "mcp", []);

      expect(stderrSpy).toHaveBeenCalledWith("Error: undefined");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
