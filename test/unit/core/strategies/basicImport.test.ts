import { describe, it, expect } from "vitest";
import {
  createReleaseAssetStrategy,
  createBrowserSessionStrategy,
  createCookieExtractionStrategy,
  createRepoBranchStrategy,
} from "../../../../src/core/strategies/index.js";

describe("Strategy barrel exports", () => {
  it("should export createReleaseAssetStrategy", () => {
    const strategy = createReleaseAssetStrategy("test-token");
    expect(strategy.name).toBe("release-asset");
    expect(typeof strategy.upload).toBe("function");
    expect(typeof strategy.isAvailable).toBe("function");
  });

  it("should export createBrowserSessionStrategy", () => {
    const strategy = createBrowserSessionStrategy("session=abc");
    expect(strategy.name).toBe("browser-session");
    expect(typeof strategy.upload).toBe("function");
    expect(typeof strategy.isAvailable).toBe("function");
  });

  it("should export createCookieExtractionStrategy", () => {
    const strategy = createCookieExtractionStrategy();
    expect(strategy.name).toBe("cookie-extraction");
    expect(typeof strategy.upload).toBe("function");
    expect(typeof strategy.isAvailable).toBe("function");
  });

  it("should export createRepoBranchStrategy", () => {
    const strategy = createRepoBranchStrategy("test-token");
    expect(strategy.name).toBe("repo-branch");
    expect(typeof strategy.upload).toBe("function");
    expect(typeof strategy.isAvailable).toBe("function");
  });
});
