import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GRACE_PERIOD_MS,
  registerShutdownHandler,
} from "../../../src/ralph/shutdown.js";

describe("registerShutdownHandler — spec: Ralph Loop Graceful Shutdown", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("sets shuttingDown flag on first SIGINT (spec: Graceful Shutdown — SIGINT handling)", () => {
    let isShuttingDown = false;
    const saveState = vi.fn().mockResolvedValue(undefined);
    const log = vi.fn();

    const remove = registerShutdownHandler(
      (v) => {
        isShuttingDown = v;
      },
      saveState,
      log,
    );

    process.emit("SIGINT");

    expect(isShuttingDown).toBe(true);
    expect(log).toHaveBeenCalledWith(
      "SIGINT received, finishing current iteration…",
      "WARN",
    );

    remove();
  });

  it("logs a WARN on SIGINT (spec: Graceful Shutdown — SIGINT handling)", () => {
    const log = vi.fn();
    const remove = registerShutdownHandler(
      () => {},
      vi.fn().mockResolvedValue(undefined),
      log,
    );

    process.emit("SIGINT");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("SIGINT"), "WARN");

    remove();
  });

  it("saves state and exits after grace period expires (spec: Graceful Shutdown — timeout management)", async () => {
    vi.useFakeTimers();
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as (code?: number) => never);
    const saveState = vi.fn().mockResolvedValue(undefined);
    const log = vi.fn();

    const remove = registerShutdownHandler(() => {}, saveState, log);

    process.emit("SIGINT");

    // Advance past the grace period
    await vi.advanceTimersByTimeAsync(GRACE_PERIOD_MS + 100);

    expect(saveState).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("Grace period expired"),
      "WARN",
    );
    expect(exitSpy).toHaveBeenCalledWith(0);

    remove();
  });

  it("exits immediately with code 1 on second SIGINT (spec: Graceful Shutdown — force exit)", () => {
    vi.useFakeTimers();
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as (code?: number) => never);

    const remove = registerShutdownHandler(
      () => {},
      vi.fn().mockResolvedValue(undefined),
      vi.fn(),
    );

    process.emit("SIGINT"); // first — starts grace period
    process.emit("SIGINT"); // second — force exit

    expect(exitSpy).toHaveBeenCalledWith(1);

    remove();
  });

  it("returns a function that removes the handler (spec: Graceful Shutdown — handler cleanup)", () => {
    let callCount = 0;
    const remove = registerShutdownHandler(
      () => {
        callCount++;
      },
      vi.fn().mockResolvedValue(undefined),
      vi.fn(),
    );

    remove();

    // Handler removed — should NOT be called
    process.emit("SIGINT");
    expect(callCount).toBe(0);
  });

  it("GRACE_PERIOD_MS is 5000 (spec: Graceful Shutdown — grace period)", () => {
    expect(GRACE_PERIOD_MS).toBe(5_000);
  });
});
