import { describe, expect, it } from "vitest";
import {
  formatToolArgs,
  getToolCategory,
  summariseToolResult,
} from "../../../src/ralph/toolLogging.js";

describe("getToolCategory", () => {
  it("categorises read tools", () => {
    expect(getToolCategory("view")).toBe("read");
    expect(getToolCategory("read_file")).toBe("read");
    expect(getToolCategory("open_file")).toBe("read");
  });

  it("categorises shell tools", () => {
    expect(getToolCategory("bash")).toBe("shell");
    expect(getToolCategory("run_terminal")).toBe("shell");
    expect(getToolCategory("shell")).toBe("shell");
  });

  it("categorises search tools", () => {
    expect(getToolCategory("grep")).toBe("search");
    expect(getToolCategory("grep_search")).toBe("search");
    expect(getToolCategory("glob")).toBe("search");
    expect(getToolCategory("list_dir")).toBe("search");
  });

  it("categorises write tools", () => {
    expect(getToolCategory("edit")).toBe("write");
    expect(getToolCategory("create")).toBe("write");
    expect(getToolCategory("replace_string_in_file")).toBe("write");
  });

  it("categorises intent tools", () => {
    expect(getToolCategory("report_intent")).toBe("intent");
    expect(getToolCategory("intent")).toBe("intent");
  });

  it("categorises git tools", () => {
    expect(getToolCategory("git")).toBe("git");
    expect(getToolCategory("git_commit")).toBe("git");
  });

  it("categorises db tools", () => {
    expect(getToolCategory("sql")).toBe("db");
    expect(getToolCategory("db_query")).toBe("db");
  });

  it("returns tool for unknown tools", () => {
    expect(getToolCategory("unknown_tool")).toBe("tool");
    expect(getToolCategory("custom_thing")).toBe("tool");
  });
});

describe("formatToolArgs", () => {
  it("formats view tool args with path", () => {
    const result = formatToolArgs("view", { path: "src/index.ts" });
    expect(result).toBe("src/index.ts");
  });

  it("formats view tool args with line range", () => {
    const result = formatToolArgs("view", {
      path: "src/index.ts",
      startLine: 10,
      endLine: 50,
    });
    expect(result).toBe("src/index.ts L10–50");
  });

  it("formats bash tool args", () => {
    const result = formatToolArgs("bash", { command: "npm test" });
    expect(result).toBe("npm test");
  });

  it("formats grep tool args", () => {
    const result = formatToolArgs("grep", {
      pattern: "AuthenticationError",
      path: "src/",
    });
    expect(result).toBe('"AuthenticationError" in src/');
  });

  it("formats edit tool args", () => {
    const result = formatToolArgs("edit", {
      path: "src/index.ts",
      description: "add login command",
    });
    expect(result).toBe("src/index.ts (add login command)");
  });

  it("formats report_intent args", () => {
    const result = formatToolArgs("report_intent", {
      intent: "Implementing release asset strategy",
    });
    expect(result).toBe("Implementing release asset strategy");
  });

  it("formats sql args", () => {
    const result = formatToolArgs("sql", {
      query: "SELECT * FROM todos WHERE status = 'pending'",
    });
    expect(result).toBe("SELECT * FROM todos WHERE status = 'pending'");
  });

  it("formats glob args", () => {
    const result = formatToolArgs("glob", { pattern: "src/**/*.ts" });
    expect(result).toBe("src/**/*.ts");
  });

  it("falls back to best-effort for unknown tools", () => {
    const result = formatToolArgs("unknown_tool", { path: "some/path" });
    expect(result).toBe("path=some/path");
  });

  it("returns empty string for null args", () => {
    expect(formatToolArgs("bash", null)).toBe("");
    expect(formatToolArgs("bash", undefined)).toBe("");
  });
});

describe("summariseToolResult", () => {
  it("returns empty for very short content", () => {
    expect(summariseToolResult("")).toBe("");
    expect(summariseToolResult("   ")).toBe("");
    expect(summariseToolResult("abc")).toBe("");
  });

  it("returns joined lines for short multi-line content", () => {
    const content = "line1\nline2\nline3";
    expect(summariseToolResult(content)).toBe("line1 ↵ line2 ↵ line3");
  });

  it("returns line count summary for many lines", () => {
    const content = Array.from({ length: 10 }, (_, i) => `line ${i}`).join(
      "\n",
    );
    const result = summariseToolResult(content);
    expect(result).toMatch(/^10 lines — line 0/);
  });

  it("applies head+tail sampling for content over 500 chars", () => {
    // Build a 600-char string
    const content = "A".repeat(200) + "MIDDLE".repeat(50) + "B".repeat(200);
    const result = summariseToolResult(content);
    expect(result).toContain("[... ");
    expect(result).toContain(" chars omitted ...]");
    // Head and tail should be present
    expect(result.startsWith("A".repeat(200))).toBe(true);
    expect(result.endsWith("B".repeat(200))).toBe(true);
  });

  it("sampling annotation includes correct omitted char count", () => {
    const head = "H".repeat(200);
    const middle = "M".repeat(300);
    const tail = "T".repeat(200);
    const content = head + middle + tail;
    const result = summariseToolResult(content);
    // omitted should be 300 (content.length - 200 - 200 = 300)
    expect(result).toContain("[... 300 chars omitted ...]");
  });
});
