/**
 * Graceful shutdown utilities for the Ralph Loop.
 *
 * Provides a factory for registering a SIGINT handler that:
 * 1. Sets a "shutting down" flag so the main loop can exit cleanly after the
 *    current iteration.
 * 2. Starts a 5-second grace period.  If the loop has not exited by then,
 *    state is saved and the process exits with code 0.
 * 3. On a second SIGINT during the grace period, exits immediately with code 1.
 */

/** Callback signature for persisting loop state before exit. */
export type SaveStateFn = () => Promise<void>;

/** Logger callback — same shape as the Ralph loop's `log()` helper. */
export type LogFn = (message: string, level?: string) => void;

/** How long (ms) to wait for a clean exit before forcing state save + exit. */
export const GRACE_PERIOD_MS = 5_000;

/**
 * Registers a SIGINT handler that gives the loop up to {@link GRACE_PERIOD_MS}
 * to finish its current iteration before saving state and exiting cleanly.
 *
 * @param setShuttingDown - Setter that marks the loop as shutting down.
 * @param saveState - Async callback that persists loop state to disk.
 * @param log - Logging callback for shutdown messages.
 * @returns A function that removes the registered handler (for test teardown).
 */
export function registerShutdownHandler(
  setShuttingDown: (value: boolean) => void,
  saveState: SaveStateFn,
  log: LogFn,
): () => void {
  let shuttingDown = false;

  const handler = () => {
    if (shuttingDown) {
      // Second SIGINT — force immediate exit
      process.exit(1);
    }
    shuttingDown = true;
    setShuttingDown(true);
    log("SIGINT received, finishing current iteration…", "WARN");

    // Grace period: allow the current iteration to complete naturally.
    // If it hasn't exited within GRACE_PERIOD_MS, save state and exit cleanly.
    const timer = setTimeout(() => {
      log("Grace period expired, saving state and exiting", "WARN");
      saveState()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    }, GRACE_PERIOD_MS);

    // Allow the Node.js event loop to exit if only the timer is pending
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  };

  process.on("SIGINT", handler);

  return () => {
    process.off("SIGINT", handler);
  };
}
