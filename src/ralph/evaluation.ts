const DEFAULT_EVALUATION_TIMEOUT_MS = 480_000;
const MIN_EVALUATION_TIMEOUT_MS = 180_000;
const MAX_EVALUATION_TIMEOUT_MS = 600_000;

/**
 * Resolve a bounded timeout for the fitness-evaluation session.
 * Using the iteration timeout as a source keeps evaluation behavior aligned with loop configuration.
 */
export function resolveEvaluationTimeoutMs(iterationTimeoutMs: number): number {
  const baseTimeout =
    Number.isFinite(iterationTimeoutMs) && iterationTimeoutMs > 0
      ? iterationTimeoutMs
      : DEFAULT_EVALUATION_TIMEOUT_MS;
  return Math.min(
    MAX_EVALUATION_TIMEOUT_MS,
    Math.max(MIN_EVALUATION_TIMEOUT_MS, baseTimeout),
  );
}

/**
 * Detect the Copilot SDK timeout shape emitted when waiting for session idle.
 */
export function isSessionIdleTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message) : "";
  return /timeout.*session\.idle/i.test(message);
}

