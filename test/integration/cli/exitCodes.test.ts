import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "child_process";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

const CLI_PATH = resolve(import.meta.dirname, "../../../dist/cli.js");

/**
 * Spawns the CLI with given args, returning exit code and stderr.
 */
function runCli(
  args: string[],
  env?: Record<string, string>,
): { status: number; stderr: string; stdout: string } {
  const result = spawnSync("node", [CLI_PATH, ...args], {
    encoding: "utf8",
    cwd: resolve(import.meta.dirname, "../../.."),
    env: {
      ...process.env,
      ...env,
      // Ensure no stale auth leaks in
      GITHUB_TOKEN: undefined,
      GH_TOKEN: undefined,
      GH_ATTACH_COOKIES: undefined,
      ...env,
    },
  });
  return {
    status: result.status ?? 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

describe("CLI exit code integration", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `gh-attach-exitcode-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("exits 0 on --help", () => {
    const { status } = runCli(["--help"]);
    expect(status).toBe(0);
  });

  it("exits 0 on --version", () => {
    const { status, stdout } = runCli(["--version"]);
    expect(status).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("exits 0 on upload --help", () => {
    const { status } = runCli(["upload", "--help"]);
    expect(status).toBe(0);
  });

  it("exits 3 (validation) when no files and no --stdin", () => {
    const { status, stderr } = runCli(
      ["upload", "--target", "owner/repo#42"],
      { GITHUB_TOKEN: "test-token" },
    );
    expect(status).toBe(3);
    expect(stderr).toContain("At least one file is required");
  });

  it("exits 3 (validation) for unsupported file format", () => {
    const txtFile = join(testDir, "test.txt");
    writeFileSync(txtFile, "not an image");

    const { status, stderr } = runCli(
      ["upload", txtFile, "--target", "owner/repo#42"],
      { GITHUB_TOKEN: "test-token" },
    );
    expect(status).toBe(3);
    expect(stderr).toContain("Unsupported file format");
  });

  it("exits 3 (validation) for non-existent file", () => {
    const { status, stderr } = runCli(
      ["upload", "/tmp/does-not-exist-abc.png", "--target", "owner/repo#42"],
      { GITHUB_TOKEN: "test-token" },
    );
    expect(status).toBe(3);
    expect(stderr).toContain("File not found");
  });

  it("exits 3 (validation) when --stdin used without --filename", () => {
    const { status, stderr } = runCli(
      ["upload", "--stdin", "--target", "owner/repo#42"],
      { GITHUB_TOKEN: "test-token" },
    );
    expect(status).toBe(3);
    expect(stderr).toContain("--filename is required");
  });

  it("exits 3 (validation) for invalid target", () => {
    const pngFile = join(testDir, "test.png");
    writeFileSync(
      pngFile,
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
        0x0d, 0x49, 0x48, 0x44, 0x52,
      ]),
    );

    const { status, stderr } = runCli(
      ["upload", pngFile, "--target", "invalid"],
      { GITHUB_TOKEN: "test-token" },
    );
    expect(status).toBe(3);
    expect(stderr).toContain("Invalid target");
  });

  it("exits 1 (general) when no strategy is available without auth", () => {
    const pngFile = join(testDir, "test.png");
    writeFileSync(
      pngFile,
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
        0x0d, 0x49, 0x48, 0x44, 0x52,
      ]),
    );

    const { status, stderr } = runCli(
      ["upload", pngFile, "--target", "owner/repo#42"],
      {
        GH_ATTACH_STATE_PATH: join(testDir, "no-session.json"),
      },
    );
    expect(status).toBe(1);
    expect(stderr).toContain("No upload strategy available");
  });
});
