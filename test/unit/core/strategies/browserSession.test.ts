import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBrowserSessionStrategy } from "../../../../src/core/strategies/browserSession.js";
import { AuthenticationError, UploadError } from "../../../../src/core/types.js";
import type { UploadTarget } from "../../../../src/core/types.js";

const mockTarget: UploadTarget = {
  owner: "testowner",
  repo: "testrepo",
  type: "issue",
  number: 42,
};

// Mock fetch globally
global.fetch = vi.fn();
global.FormData = class FormData {
  append() {}
} as any;

describe("Browser Session Strategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isAvailable", () => {
    it("returns true when cookies are present", async () => {
      const strategy = createBrowserSessionStrategy("test-cookie");
      const available = await strategy.isAvailable();
      expect(available).toBe(true);
    });

    it("returns false when cookies are empty", async () => {
      const strategy = createBrowserSessionStrategy("");
      const available = await strategy.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe("upload", () => {
    it("throws AuthenticationError on 401 response", async () => {
      const strategy = createBrowserSessionStrategy("test-cookie");
      const mockFilePath = "/tmp/test.png";

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(strategy.upload(mockFilePath, mockTarget)).rejects.toThrow(
        AuthenticationError,
      );
    });

    it("throws AuthenticationError on 403 response", async () => {
      const strategy = createBrowserSessionStrategy("test-cookie");
      const mockFilePath = "/tmp/test.png";

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await expect(strategy.upload(mockFilePath, mockTarget)).rejects.toThrow(
        AuthenticationError,
      );
    });

    it("throws UploadError on policy fetch failure", async () => {
      const strategy = createBrowserSessionStrategy("test-cookie");
      const mockFilePath = "/tmp/test.png";

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 12345 }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => "Internal Server Error",
        });

      await expect(strategy.upload(mockFilePath, mockTarget)).rejects.toThrow(
        UploadError,
      );
    });
  });

  describe("strategy name", () => {
    it("returns correct name", () => {
      const strategy = createBrowserSessionStrategy("test-cookie");
      expect(strategy.name).toBe("browser-session");
    });
  });
});
