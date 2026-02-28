import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { unlinkSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { loginCommand, saveSession } from "../../../src/cli/commands/login.js";

describe("loginCommand integration tests", () => {
  let testStateDir: string;
  let origStateEnv: string | undefined;

  beforeEach(() => {
    origStateEnv = process.env.GH_ATTACH_STATE_PATH;
    testStateDir = join(homedir(), `.test-gh-attach-state-${Date.now()}`);
    process.env.GH_ATTACH_STATE_PATH = join(testStateDir, "session.json");
  });

  afterEach(() => {
    // Cleanup
    try {
      const stateFile = process.env.GH_ATTACH_STATE_PATH;
      if (stateFile && existsSync(stateFile)) {
        unlinkSync(stateFile);
      }
      if (existsSync(testStateDir)) {
        const rmDir = (dir: string) => {
          const fs = require("fs");
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const path = join(dir, file);
            if (fs.statSync(path).isDirectory()) {
              rmDir(path);
            } else {
              fs.unlinkSync(path);
            }
          }
          fs.rmdirSync(dir);
        };
        rmDir(testStateDir);
      }
    } catch {
      // Ignore cleanup errors
    }

    if (origStateEnv) {
      process.env.GH_ATTACH_STATE_PATH = origStateEnv;
    } else {
      delete process.env.GH_ATTACH_STATE_PATH;
    }
  });

  it("should check status when no session exists", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await loginCommand({ status: true });
    } catch (err) {
      if (!(err instanceof Error) || err.message !== "process.exit called") {
        throw err;
      }
    }

    expect(consoleSpy).toHaveBeenCalledWith("Status: not authenticated");
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("should check status when session exists and is valid", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Create a valid session
    await saveSession({
      username: "testuser",
      expires: Date.now() + 86400000, // 1 day from now
    });

    await loginCommand({ status: true });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Status: authenticated as testuser",
    );
    consoleSpy.mockRestore();
  });

  it("should check status when session is expired", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    // Create an expired session
    await saveSession({
      username: "testuser",
      expires: Date.now() - 1000, // 1 second ago
    });

    try {
      await loginCommand({ status: true });
    } catch (err) {
      if (!(err instanceof Error) || err.message !== "process.exit called") {
        throw err;
      }
    }

    expect(consoleSpy).toHaveBeenCalledWith("Status: session expired");
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("should throw error for interactive login not implemented", async () => {
    await expect(loginCommand({})).rejects.toThrow(
      "Interactive browser login is not yet implemented",
    );
  });

  it("should throw error when trying to login interactively", async () => {
    await expect(loginCommand({ status: false })).rejects.toThrow(
      "Interactive browser login is not yet implemented",
    );
  });

  it("should handle session without username", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Create a session without username
    await saveSession({
      expires: Date.now() + 86400000,
    });

    await loginCommand({ status: true });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Status: session found but username not set",
    );
    consoleSpy.mockRestore();
  });

  it("should persist session state", async () => {
    await saveSession({
      username: "saveduser",
      expires: Date.now() + 86400000,
    });

    const stateFile = process.env.GH_ATTACH_STATE_PATH!;
    expect(existsSync(stateFile)).toBe(true);

    const fs = require("fs");
    const content = fs.readFileSync(stateFile, "utf-8");
    const session = JSON.parse(content);
    expect(session.username).toBe("saveduser");
  });

  it("should create state directory if it doesn't exist", async () => {
    await saveSession({
      username: "newuser",
    });

    const stateFile = process.env.GH_ATTACH_STATE_PATH!;
    const stateDir = stateFile.substring(0, stateFile.lastIndexOf("/"));

    expect(existsSync(stateDir)).toBe(true);
  });
});
