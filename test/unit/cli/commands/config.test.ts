import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  configCommand,
  loadConfig,
} from "../../../../src/cli/commands/config.js";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("configCommand unit tests", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let origConfigEnv: string | undefined;
  let testConfigPath: string;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    origConfigEnv = process.env.GH_ATTACH_CONFIG;
    testConfigPath = join(tmpdir(), `gh-attach-config-test-${Date.now()}.json`);
    process.env.GH_ATTACH_CONFIG = testConfigPath;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    if (origConfigEnv !== undefined) {
      process.env.GH_ATTACH_CONFIG = origConfigEnv;
    } else {
      delete process.env.GH_ATTACH_CONFIG;
    }
    try {
      unlinkSync(testConfigPath);
    } catch {
      // Ignore
    }
  });

  describe("list action", () => {
    it("prints 'No configuration set' when config is empty", async () => {
      await configCommand("list");
      expect(consoleSpy).toHaveBeenCalledWith("No configuration set");
    });

    it("lists all configuration entries", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({ key1: "value1", key2: "value2" }),
      );

      await configCommand("list");
      expect(consoleSpy).toHaveBeenCalledWith("key1: value1");
      expect(consoleSpy).toHaveBeenCalledWith("key2: value2");
    });

    it("displays array values as comma-separated", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          "strategy-order": ["release-asset", "browser-session"],
        }),
      );

      await configCommand("list");
      expect(consoleSpy).toHaveBeenCalledWith(
        "strategy-order: release-asset, browser-session",
      );
    });
  });

  describe("get action", () => {
    it("prints value for existing key", async () => {
      writeFileSync(testConfigPath, JSON.stringify({ "my-key": "my-value" }));

      await configCommand("get", "my-key");
      expect(consoleSpy).toHaveBeenCalledWith("my-value");
    });

    it("prints 'not set' for missing key", async () => {
      await configCommand("get", "missing-key");
      expect(consoleSpy).toHaveBeenCalledWith("missing-key is not set");
    });

    it("throws error when key is missing", async () => {
      await expect(configCommand("get")).rejects.toThrow("Key is required");
    });

    it("displays array values as comma-separated", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({ "strategy-order": ["a", "b"] }),
      );

      await configCommand("get", "strategy-order");
      expect(consoleSpy).toHaveBeenCalledWith("a, b");
    });
  });

  describe("set action", () => {
    it("sets a simple key-value pair", async () => {
      await configCommand("set", "my-key", "my-value");
      expect(consoleSpy).toHaveBeenCalledWith("my-key set to my-value");

      const config = JSON.parse(readFileSync(testConfigPath, "utf-8"));
      expect(config["my-key"]).toBe("my-value");
    });

    it("sets strategy-order as comma-separated array", async () => {
      await configCommand(
        "set",
        "strategy-order",
        "release-asset,browser-session",
      );

      const config = JSON.parse(readFileSync(testConfigPath, "utf-8"));
      expect(config["strategy-order"]).toEqual([
        "release-asset",
        "browser-session",
      ]);
    });

    it("throws error when key or value is missing", async () => {
      await expect(configCommand("set", "key")).rejects.toThrow(
        "Key and value are required",
      );
    });
  });

  describe("unknown action", () => {
    it("throws error for unknown action", async () => {
      await expect(configCommand("delete", "key")).rejects.toThrow(
        "Unknown config action: delete",
      );
    });
  });

  describe("loadConfig", () => {
    it("returns empty object when config file does not exist", () => {
      process.env.GH_ATTACH_CONFIG = "/nonexistent/path/config.json";
      const config = loadConfig();
      expect(config).toEqual({});
    });

    it("returns empty object when config file is invalid JSON", () => {
      writeFileSync(testConfigPath, "not json!");
      const config = loadConfig();
      expect(config).toEqual({});
    });

    it("loads valid config from file", () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({ "default-target": "owner/repo" }),
      );
      const config = loadConfig();
      expect(config["default-target"]).toBe("owner/repo");
    });
  });
});
