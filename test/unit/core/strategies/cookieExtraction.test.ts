import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCookieExtractionStrategy } from "../../../../src/core/strategies/cookieExtraction.js";

const mockTarget = {
  owner: "testowner",
  repo: "testrepo",
  type: "issue" as const,
  number: 42,
};

describe("Cookie Extraction Strategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isAvailable", () => {
    it("returns false when no cookies are available", async () => {
      const strategy = createCookieExtractionStrategy();
      const available = await strategy.isAvailable();
      // Should return false since extraction is not implemented
      expect(available).toBe(false);
    });
  });

  describe("strategy name", () => {
    it("returns correct name", () => {
      const strategy = createCookieExtractionStrategy();
      expect(strategy.name).toBe("cookie-extraction");
    });
  });
});
