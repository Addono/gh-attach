/**
 * Tool execution logging utilities for the Ralph Loop observer.
 *
 * Extracts human-readable summaries from tool invocation arguments and results,
 * with per-category formatting and proper result sampling for large outputs.
 */

/** Maximum length for a tool result before it is sampled. */
const RESULT_SAMPLE_THRESHOLD = 500;
/** Characters kept from the start of a large result. */
const RESULT_SAMPLE_HEAD = 200;
/** Characters kept from the end of a large result. */
const RESULT_SAMPLE_TAIL = 200;

/**
 * Maps a tool name to a short human-readable category label.
 * Used to produce `⚙ view (read)` style log lines.
 */
export function getToolCategory(toolName: string): string {
  switch (toolName) {
    case "view":
    case "read_file":
    case "open_file":
      return "read";
    case "bash":
    case "run_terminal":
    case "shell":
    case "terminal":
      return "shell";
    case "grep":
    case "grep_search":
    case "rg":
      return "search";
    case "edit":
    case "edit_file":
    case "create":
    case "create_file":
    case "write_file":
    case "replace_string_in_file":
    case "insert_edit_into_file":
      return "write";
    case "report_intent":
    case "intent":
      return "intent";
    case "git":
    case "git_commit":
    case "git_push":
      return "git";
    case "sql":
    case "sqlite":
    case "db_query":
      return "db";
    case "glob":
    case "find_files":
    case "list_dir":
      return "search";
    default:
      return "tool";
  }
}

/**
 * Formats tool arguments into a compact human-readable description.
 * Each tool exposes different argument shapes; we extract the most meaningful field.
 */
export function formatToolArgs(toolName: string, args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const a = args as Record<string, unknown>;

  switch (toolName) {
    // File viewing / reading
    case "view":
    case "read_file":
    case "open_file": {
      const file = String(a.path ?? a.filePath ?? a.file ?? "");
      const start = a.startLine ?? a.start_line ?? "";
      const end = a.endLine ?? a.end_line ?? "";
      return file
        ? `${file}${start ? ` L${start}–${end || "?"}` : ""}`
        : JSON.stringify(a).slice(0, 120);
    }

    // Shell execution
    case "bash":
    case "run_terminal":
    case "shell":
    case "terminal": {
      const cmd = String(a.command ?? a.cmd ?? a.input ?? "");
      return cmd ? cmd.slice(0, 200) : JSON.stringify(a).slice(0, 120);
    }

    // Grep / search
    case "grep":
    case "grep_search":
    case "rg": {
      const pattern = String(
        a.query ?? a.pattern ?? a.regex ?? a.search ?? "",
      );
      const path = a.path ?? a.directory ?? a.glob ?? "";
      return pattern
        ? `"${pattern}"${path ? ` in ${path}` : ""}`
        : JSON.stringify(a).slice(0, 120);
    }

    // File edit / create
    case "edit":
    case "edit_file":
    case "create":
    case "create_file":
    case "write_file":
    case "replace_string_in_file":
    case "insert_edit_into_file": {
      const file = String(a.path ?? a.filePath ?? a.file ?? "");
      const desc = a.explanation ?? a.description ?? "";
      return file
        ? `${file}${desc ? ` (${String(desc).slice(0, 80)})` : ""}`
        : JSON.stringify(a).slice(0, 120);
    }

    // Intent / plan reporting
    case "report_intent":
    case "intent": {
      const intent =
        a.intent ?? a.description ?? a.goal ?? a.plan ?? a.message ?? a.text;
      return intent
        ? String(intent).slice(0, 200)
        : JSON.stringify(a).slice(0, 120);
    }

    // Git operations
    case "git":
    case "git_commit":
    case "git_push": {
      const cmd = a.command ?? a.message ?? a.args;
      return cmd ? String(cmd).slice(0, 200) : JSON.stringify(a).slice(0, 120);
    }

    // Database / SQL
    case "sql":
    case "sqlite":
    case "db_query": {
      const query = String(a.query ?? a.sql ?? a.statement ?? "");
      return query ? query.slice(0, 150) : JSON.stringify(a).slice(0, 120);
    }

    // glob / find
    case "glob":
    case "find_files":
    case "list_dir": {
      const pattern = String(
        a.pattern ?? a.glob ?? a.path ?? a.directory ?? "",
      );
      return pattern || JSON.stringify(a).slice(0, 120);
    }

    default:
      // Best-effort: pick whichever single string field looks most useful
      for (const key of [
        "command",
        "query",
        "path",
        "message",
        "description",
        "prompt",
        "text",
        "input",
      ]) {
        if (typeof a[key] === "string" && (a[key] as string).length > 0) {
          return `${key}=${String(a[key]).slice(0, 160)}`;
        }
      }
      return JSON.stringify(a).slice(0, 120);
  }
}

/**
 * Distils a tool result into a one-line summary for the observer.
 *
 * When the result is large (> 500 chars) the head and tail are preserved and
 * the omitted middle is annotated:
 *   `first 200 chars... [... 1234 chars omitted ...] ...last 200 chars`
 *
 * Returns empty string if the result isn't worth logging.
 */
export function summariseToolResult(content: string): string {
  const c = content.trim();
  if (!c || c.length < 5) return "";

  // Apply head+tail sampling for large results per spec requirement
  if (c.length > RESULT_SAMPLE_THRESHOLD) {
    const head = c.slice(0, RESULT_SAMPLE_HEAD).trimEnd();
    const tail = c.slice(-RESULT_SAMPLE_TAIL).trimStart();
    const omitted = c.length - RESULT_SAMPLE_HEAD - RESULT_SAMPLE_TAIL;
    return `${head} [... ${omitted} chars omitted ...] ${tail}`;
  }

  const lines = c.split("\n").filter((l) => l.trim());

  // For multi-line results show line count + first meaningful line
  if (lines.length > 3) {
    return `${lines.length} lines — ${(lines[0] ?? "").slice(0, 120)}`;
  }
  return lines.join(" ↵ ").slice(0, 200);
}
