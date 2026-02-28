import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";

const CLI_PATH = resolve(import.meta.dirname, "../../../dist/cli.js");

function runCli(args: string[], env?: NodeJS.ProcessEnv) {
  return spawnSync("node", [CLI_PATH, ...args], {
    encoding: "utf8",
    cwd: resolve(import.meta.dirname, "../../.."),
    env: {
      ...process.env,
      ...env,
    },
  });
}

describe("CLI global options", () => {
  it("prints debug output with --verbose", () => {
    const result = runCli(
      ["--verbose", "upload", "missing.png", "--target", "owner/repo#1"],
      { GITHUB_TOKEN: "test-token" },
    );

    expect(result.stderr).toContain("[debug]");
    expect(result.stderr).toContain("Error:");
  });

  it("suppresses debug output with --quiet", () => {
    const result = runCli(
      [
        "--verbose",
        "--quiet",
        "upload",
        "missing.png",
        "--target",
        "owner/repo#1",
      ],
      { GITHUB_TOKEN: "test-token" },
    );

    expect(result.stderr).not.toContain("[debug]");
    expect(result.stderr).toContain("Error:");
  });

  it("does not emit ANSI color codes with --no-color", () => {
    const result = runCli(["--no-color", "--help"]);
    expect(result.stdout).not.toContain("\u001b[");
  });

  it("does not emit ANSI color codes when NO_COLOR is set", () => {
    const result = runCli(["--help"], { NO_COLOR: "1" });
    expect(result.stdout).not.toContain("\u001b[");
  });
});
