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
  const messages = collectErrorMessages(error);
  return messages.some((message) =>
    /(timeout.*session\.idle|session\.idle.*timeout)/i.test(message),
  );
}

function collectErrorMessages(error: unknown, depth = 0): string[] {
  if (depth > 4 || error === null || error === undefined) return [];

  if (typeof error === "string") {
    return [error];
  }

  if (error instanceof Error) {
    return [
      error.message,
      String(error),
      ...collectErrorMessages(error.cause, depth + 1),
    ].filter((value) => value.length > 0);
  }

  if (typeof error === "object") {
    const raw = error as Record<string, unknown>;
    const messages = [
      typeof raw.message === "string" ? raw.message : "",
      typeof raw.error === "string" ? raw.error : "",
      typeof raw.details === "string" ? raw.details : "",
      String(error),
      ...collectErrorMessages(raw.cause, depth + 1),
    ];
    return messages.filter((value) => value.length > 0);
  }

  return [String(error)];
}
