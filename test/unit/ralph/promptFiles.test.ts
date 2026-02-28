/**
 * Unit tests verifying the Ralph Loop PROMPT files exist and contain the
 * required content per spec.
 *
 * @spec Ralph-loop/spec.md — Ralph Loop PROMPT Files, Plan mode, Build mode
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// Paths relative to project root
const PROJECT_ROOT = join(import.meta.dirname, "../../../");
const PROMPT_BUILD = join(PROJECT_ROOT, "PROMPT_build.md");
const PROMPT_PLAN = join(PROJECT_ROOT, "PROMPT_plan.md");

describe("PROMPT files — spec: Ralph Loop PROMPT Files", () => {
  it("PROMPT_build.md exists in project root (spec: Build mode prompt)", () => {
    expect(existsSync(PROMPT_BUILD)).toBe(true);
  });

  it("PROMPT_plan.md exists in project root (spec: Plan mode prompt)", () => {
    expect(existsSync(PROMPT_PLAN)).toBe(true);
  });

  it("PROMPT_build.md references IMPLEMENTATION_PLAN.md (spec: Build mode — implement tasks from plan)", () => {
    const content = readFileSync(PROMPT_BUILD, "utf-8");
    expect(content).toMatch(/IMPLEMENTATION_PLAN/i);
  });

  it("PROMPT_plan.md references openspec/specs (spec: Plan mode — gap analysis against specs)", () => {
    const content = readFileSync(PROMPT_PLAN, "utf-8");
    expect(content).toMatch(/openspec/i);
  });

  it("PROMPT_build.md instructs running tests before committing (spec: Build mode — run tests before committing)", () => {
    const content = readFileSync(PROMPT_BUILD, "utf-8");
    expect(content).toMatch(/npm test/i);
  });

  it("ralph-loop.ts reads PROMPT_build.md in build mode (spec: Build mode prompt selection)", () => {
    // Verify the prompt selection logic exists in ralph-loop.ts
    const ralphLoop = readFileSync(
      join(PROJECT_ROOT, "ralph-loop.ts"),
      "utf-8",
    );
    expect(ralphLoop).toContain("PROMPT_build.md");
    expect(ralphLoop).toContain('mode === "plan"');
    expect(ralphLoop).toContain("PROMPT_plan.md");
  });

  it("ralph-loop.ts selects mode from argv (spec: plan/build mode argument)", () => {
    const ralphLoop = readFileSync(
      join(PROJECT_ROOT, "ralph-loop.ts"),
      "utf-8",
    );
    expect(ralphLoop).toContain("process.argv");
    expect(ralphLoop).toContain('"plan"');
    expect(ralphLoop).toContain('"build"');
  });
});
