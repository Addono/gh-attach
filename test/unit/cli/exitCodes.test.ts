import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AuthenticationError,
  ValidationError,
  UploadError,
  GhAttachError,
  NoStrategyAvailableError,
} from "../../../src/core/types.js";

/**
 * Import getExitCode and createProgram directly from the CLI module.
 *
 * We mock `commander` parse() to prevent side effects from the module-level
 * `program.parse()` call that runs on import.
 */
vi.mock("commander", async (importOriginal) => {
  const actual = await importOriginal<typeof import("commander")>();
  const OriginalCommand = actual.Command;
  class MockCommand extends OriginalCommand {
    parse() {
      // no-op to prevent process.argv parsing during tests
      return this;
    }
  }
  return { ...actual, Command: MockCommand };
});

let getExitCode: (err: unknown) => number;
let createProgram: () => import("commander").Command;
let resolveVersion: () => string;

beforeEach(async () => {
  const mod = await import("../../../src/cli/index.js");
  getExitCode = mod.getExitCode;
  createProgram = mod.createProgram;
  resolveVersion = mod.resolveVersion;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CLI exit codes", () => {
  describe("getExitCode", () => {
    it("should return 2 for AuthenticationError", () => {
      const err = new AuthenticationError(
        "Session expired",
        "SESSION_EXPIRED",
        {},
      );
      expect(getExitCode(err)).toBe(2);
    });

    it("should return 3 for ValidationError", () => {
      const err = new ValidationError("File too large", "FILE_TOO_LARGE", {});
      expect(getExitCode(err)).toBe(3);
    });

    it("should return 4 for UploadError", () => {
      const err = new UploadError("Upload failed", "UPLOAD_FAILED", {});
      expect(getExitCode(err)).toBe(4);
    });

    it("should return 1 for generic GhAttachError", () => {
      const err = new GhAttachError("Generic error", "GENERIC_ERROR", {});
      expect(getExitCode(err)).toBe(1);
    });

    it("should return 1 for NoStrategyAvailableError", () => {
      const err = new NoStrategyAvailableError("No strategy available", [
        { strategy: "release-asset", reason: "not available" },
        { strategy: "repo-branch", reason: "not configured" },
      ]);
      expect(getExitCode(err)).toBe(1);
    });

    it("should return 1 for standard Error", () => {
      const err = new Error("Something went wrong");
      expect(getExitCode(err)).toBe(1);
    });

    it("should return 1 for non-Error values", () => {
      expect(getExitCode("string error")).toBe(1);
      expect(getExitCode(null)).toBe(1);
      expect(getExitCode(undefined)).toBe(1);
      expect(getExitCode(42)).toBe(1);
    });
  });
});

describe("createProgram", () => {
  it("should create a Commander program named gh-attach", () => {
    const program = createProgram();
    expect(program.name()).toBe("gh-attach");
  });

  it("should include upload, login, config, and mcp commands", () => {
    const program = createProgram();
    const commandNames = program.commands.map((c) => c.name());
    expect(commandNames).toContain("upload");
    expect(commandNames).toContain("login");
    expect(commandNames).toContain("config");
    expect(commandNames).toContain("mcp");
  });

  it("should have global --verbose, --quiet, and --no-color options", () => {
    const program = createProgram();
    const optionFlags = program.options.map((o) => o.long);
    expect(optionFlags).toContain("--verbose");
    expect(optionFlags).toContain("--quiet");
    expect(optionFlags).toContain("--no-color");
  });

  it("should include version flag", () => {
    const program = createProgram();
    expect(program.version()).toBeTruthy();
  });

  it("upload command should have required options", () => {
    const program = createProgram();
    const upload = program.commands.find((c) => c.name() === "upload");
    expect(upload).toBeDefined();
    const optionFlags = (upload ?? program).options.map((o) => o.long);
    expect(optionFlags).toContain("--target");
    expect(optionFlags).toContain("--strategy");
    expect(optionFlags).toContain("--format");
    expect(optionFlags).toContain("--stdin");
    expect(optionFlags).toContain("--filename");
  });

  it("login command should have --state-path and --status options", () => {
    const program = createProgram();
    const login = program.commands.find((c) => c.name() === "login");
    expect(login).toBeDefined();
    const optionFlags = (login ?? program).options.map((o) => o.long);
    expect(optionFlags).toContain("--state-path");
    expect(optionFlags).toContain("--status");
  });

  it("mcp command should have --transport and --port options", () => {
    const program = createProgram();
    const mcp = program.commands.find((c) => c.name() === "mcp");
    expect(mcp).toBeDefined();
    const optionFlags = (mcp ?? program).options.map((o) => o.long);
    expect(optionFlags).toContain("--transport");
    expect(optionFlags).toContain("--port");
  });
});

describe("resolveVersion", () => {
  it("should return a version string", () => {
    const version = resolveVersion();
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });
});
