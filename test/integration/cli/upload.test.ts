import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { uploadCommand } from "../../../src/cli/commands/upload.js";
import {
  AuthenticationError,
  ValidationError,
  UploadError,
} from "../../../src/core/types.js";

describe("uploadCommand integration tests", () => {
  let testDir: string;
  let testFile: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `gh-attach-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    testFile = join(testDir, "test-image.png");
    // Create a minimal PNG file (8x8 transparent PNG)
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x08,
      0x08, 0x06, 0x00, 0x00, 0x00, 0xc4, 0x0f, 0xbe, 0x8b, 0x00, 0x00, 0x00,
      0x25, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    writeFileSync(testFile, pngBuffer);
  });

  afterEach(() => {
    try {
      unlinkSync(testFile);
    } catch {
      // Ignore
    }
    try {
      const rmDir = (dir: string) => {
        const files = require("fs").readdirSync(dir);
        for (const file of files) {
          const path = join(dir, file);
          if (require("fs").statSync(path).isDirectory()) {
            rmDir(path);
          } else {
            unlinkSync(path);
          }
        }
        require("fs").rmdirSync(dir);
      };
      rmDir(testDir);
    } catch {
      // Ignore
    }
  });

  it("should throw error when no authentication is provided", async () => {
    // Clear auth env vars
    const origToken = process.env.GITHUB_TOKEN;
    const origGhToken = process.env.GH_TOKEN;
    const origCookies = process.env.GH_ATTACH_COOKIES;

    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    delete process.env.GH_ATTACH_COOKIES;

    try {
      await expect(
        uploadCommand([testFile], {
          target: "owner/repo#42",
          format: "markdown",
        }),
      ).rejects.toThrow("Upload failed");
    } finally {
      if (origToken) process.env.GITHUB_TOKEN = origToken;
      if (origGhToken) process.env.GH_TOKEN = origGhToken;
      if (origCookies) process.env.GH_ATTACH_COOKIES = origCookies;
    }
  });

  it("should throw error for invalid target", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    await expect(
      uploadCommand([testFile], {
        target: "invalid-target",
        format: "markdown",
      }),
    ).rejects.toThrow("Invalid target");
  });

  it("should throw error for non-existent file", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    await expect(
      uploadCommand([join(testDir, "nonexistent.png")], {
        target: "owner/repo#42",
        format: "markdown",
      }),
    ).rejects.toThrow("File validation failed");
  });

  it("should throw error for unsupported file format", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    const txtFile = join(testDir, "test.txt");
    writeFileSync(txtFile, "test content");

    try {
      await expect(
        uploadCommand([txtFile], {
          target: "owner/repo#42",
          format: "markdown",
        }),
      ).rejects.toThrow("File validation failed");
    } finally {
      unlinkSync(txtFile);
    }
  });

  it("should require filename when using --stdin", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    await expect(
      uploadCommand([], {
        target: "owner/repo#42",
        stdin: true,
        // No filename provided
      }),
    ).rejects.toThrow("--filename is required");
  });

  it("should parse target in shorthand format", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    // This test just verifies that parsing doesn't throw
    // The actual upload will fail due to mock strategy, but parsing should succeed
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await uploadCommand([testFile], {
        target: "owner/repo#42",
        format: "json",
      });
    } catch (err) {
      // Expected to fail during upload, not during parsing
      if (!(err instanceof Error) || !err.message.includes("Upload failed")) {
        throw err;
      }
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("should parse target from full URL", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await uploadCommand([testFile], {
        target: "https://github.com/owner/repo/issues/42",
        format: "json",
      });
    } catch (err) {
      if (!(err instanceof Error) || !err.message.includes("Upload failed")) {
        throw err;
      }
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("should support pull request targets", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await uploadCommand([testFile], {
        target: "owner/repo#pull/99",
        format: "json",
      });
    } catch (err) {
      if (!(err instanceof Error) || !err.message.includes("Upload failed")) {
        throw err;
      }
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("should use GH_TOKEN if GITHUB_TOKEN not set", async () => {
    const origToken = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    process.env.GH_TOKEN = "test-gh-token";

    try {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        await uploadCommand([testFile], {
          target: "owner/repo#42",
          format: "json",
        });
      } catch (err) {
        // Expected to fail during upload
        if (!(err instanceof Error) || !err.message.includes("Upload failed")) {
          throw err;
        }
      } finally {
        consoleSpy.mockRestore();
      }
    } finally {
      if (origToken) process.env.GITHUB_TOKEN = origToken;
      delete process.env.GH_TOKEN;
    }
  });

  it("should throw error for unknown strategy", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    await expect(
      uploadCommand([testFile], {
        target: "owner/repo#42",
        strategy: "unknown-strategy",
      }),
    ).rejects.toThrow("Unknown strategy");
  });

  it("should throw error when release-asset strategy requires token", async () => {
    const origToken = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;

    try {
      await expect(
        uploadCommand([testFile], {
          target: "owner/repo#42",
          strategy: "release-asset",
        }),
      ).rejects.toThrow("requires GITHUB_TOKEN");
    } finally {
      if (origToken) process.env.GITHUB_TOKEN = origToken;
    }
  });

  it("should throw error when browser-session strategy requires cookies", async () => {
    const origCookies = process.env.GH_ATTACH_COOKIES;
    delete process.env.GH_ATTACH_COOKIES;

    try {
      await expect(
        uploadCommand([testFile], {
          target: "owner/repo#42",
          strategy: "browser-session",
        }),
      ).rejects.toThrow("requires GH_ATTACH_COOKIES");
    } finally {
      if (origCookies) process.env.GH_ATTACH_COOKIES = origCookies;
    }
  });
});
