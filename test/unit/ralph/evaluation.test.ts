import { describe, expect, it } from "vitest";
import {
  isSessionIdleTimeoutError,
  resolveEvaluationTimeoutMs,
} from "../../../src/ralph/evaluation";

describe("resolveEvaluationTimeoutMs", () => {
  it("clamps to minimum when timeout is too low", () => {
    expect(resolveEvaluationTimeoutMs(60_000)).toBe(180_000);
  });

  it("uses provided timeout when in supported range", () => {
    expect(resolveEvaluationTimeoutMs(300_000)).toBe(300_000);
  });

  it("clamps to maximum when timeout is too high", () => {
    expect(resolveEvaluationTimeoutMs(900_000)).toBe(600_000);
  });

  it("uses default when timeout is invalid", () => {
    expect(resolveEvaluationTimeoutMs(Number.NaN)).toBe(480_000);
  });
});

describe("isSessionIdleTimeoutError", () => {
  it("detects session idle timeout errors", () => {
    const err = new Error("Timeout after 180000ms waiting for session.idle");
    expect(isSessionIdleTimeoutError(err)).toBe(true);
  });

  it("returns false for non-timeout errors", () => {
    expect(isSessionIdleTimeoutError(new Error("Network failure"))).toBe(false);
  });
});

