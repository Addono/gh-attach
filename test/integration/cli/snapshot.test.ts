import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { resolve } from "path";

const CLI_PATH = resolve(import.meta.dirname, "../../../dist/cli.js");

/**
 * Executes the CLI with given arguments and returns stdout.
 */
function runCli(args: string): string {
  const result = execSync(`node ${CLI_PATH} ${args}`, {
    encoding: "utf8",
    cwd: resolve(import.meta.dirname, "../../.."),
  });
  return result.trim();
}

describe("CLI Help Output Snapshots", () => {
  it("should match main help output", () => {
    const output = runCli("--help");
    expect(output).toMatchSnapshot();
  });

  it("should match upload command help output", () => {
    const output = runCli("upload --help");
    expect(output).toMatchSnapshot();
  });

  it("should match login command help output", () => {
    const output = runCli("login --help");
    expect(output).toMatchSnapshot();
  });

  it("should match config command help output", () => {
    const output = runCli("config --help");
    expect(output).toMatchSnapshot();
  });

  it("should match mcp command help output", () => {
    const output = runCli("mcp --help");
    expect(output).toMatchSnapshot();
  });
});

describe("CLI Version Output", () => {
  it("should output version in expected format", () => {
    const output = runCli("--version");
    // Version output should be a semver-ish pattern
    expect(output).toMatch(/^\d+\.\d+\.\d+(-\w+)?$/);
  });
});
