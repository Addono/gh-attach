import { describe, it, expect } from "vitest";
import { createReleaseAssetStrategy } from "../../../../src/core/strategies/releaseAsset.js";

describe("Release Asset Strategy - Basic", () => {
  it("should create a strategy with correct name", () => {
    const strategy = createReleaseAssetStrategy("test-token");
    expect(strategy.name).toBe("release-asset");
    expect(typeof strategy.upload).toBe("function");
    expect(typeof strategy.isAvailable).toBe("function");
  });
});
