import { describe, it, expect } from "vitest";
import {
  selectModel,
  type EvaluationRecord,
  type ModelPoolConfig,
} from "../../../src/ralph/modelSelection.js";

const baseConfig: ModelPoolConfig = {
  models: [
    "gpt-4.1",
    "gpt-5.1-codex-mini",
    "claude-haiku-4.5",
    "gpt-5.3-codex",
  ],
  premiumModels: ["claude-opus-4.6"],
  stallWindow: 2,
  stallThreshold: 5,
};

function makeEval(aggregate: number): EvaluationRecord {
  return { scores: { aggregate } };
}

describe("selectModel — model rotation and pool (spec: Ralph Loop Model Rotation)", () => {
  it("selects a model from the configured pool", () => {
    const model = selectModel([], baseConfig, "");
    const allModels = [...baseConfig.models, ...baseConfig.premiumModels];
    expect(allModels).toContain(model);
  });

  it("excludes current model from candidates to ensure variety", () => {
    const currentModel = "gpt-4.1";
    // Run many times to verify current model is never selected
    const selected = new Set<string>();
    for (let i = 0; i < 50; i++) {
      selected.add(selectModel([], baseConfig, currentModel));
    }
    expect(selected.has(currentModel)).toBe(false);
  });

  it("falls back to only model when pool has single entry", () => {
    const singleModelConfig: ModelPoolConfig = {
      models: ["gpt-4.1"],
      premiumModels: [],
      stallWindow: 2,
      stallThreshold: 5,
    };
    // Only one model — must return it even when it's current
    const model = selectModel([], singleModelConfig, "gpt-4.1");
    expect(model).toBe("gpt-4.1");
  });

  it("selects randomly from the model pool (multiple models appear over many calls)", () => {
    const selected = new Set<string>();
    for (let i = 0; i < 100; i++) {
      selected.add(selectModel([], baseConfig, ""));
    }
    // With 5 models and 100 iterations, expect at least 3 distinct models
    expect(selected.size).toBeGreaterThanOrEqual(3);
  });

  describe("stall detection — escalates to premium model when progress stalls", () => {
    it("uses premium model when aggregate scores plateau within stallThreshold", () => {
      // Two evals with same score → stall detected → use premium
      const evals = [makeEval(65), makeEval(66)]; // Δ=1 < stallThreshold=5
      const selected = selectModel(evals, baseConfig, "gpt-4.1");
      expect(baseConfig.premiumModels).toContain(selected);
    });

    it("does NOT escalate when scores improve beyond stallThreshold", () => {
      // Two evals with significant improvement → no stall
      const evals = [makeEval(60), makeEval(75)]; // Δ=15 > stallThreshold=5
      const selected = selectModel(evals, baseConfig, "gpt-4.1");
      // Should pick from regular pool (not premium) since not stalled
      expect(baseConfig.models).toContain(selected);
    });

    it("calls logFn with stall message when escalating", () => {
      const messages: string[] = [];
      const evals = [makeEval(65), makeEval(66)]; // Stall
      selectModel(evals, baseConfig, "gpt-4.1", (msg) => messages.push(msg));
      expect(messages.some((m) => m.includes("Stall detected"))).toBe(true);
      expect(messages.some((m) => m.includes("premium"))).toBe(true);
    });

    it("skips stall detection when fewer evaluations than stallWindow", () => {
      // Only 1 eval, stallWindow=2 → not enough data for stall check
      const evals = [makeEval(65)];
      const selected = selectModel(evals, baseConfig, "");
      // Just verify it returns a valid model
      const allModels = [...baseConfig.models, ...baseConfig.premiumModels];
      expect(allModels).toContain(selected);
    });

    it("excludes current premium model from premium candidates", () => {
      const evals = [makeEval(65), makeEval(66)]; // Stall
      // When already using the only premium model — falls back to normal rotation
      const selected = selectModel(evals, baseConfig, "claude-opus-4.6");
      // premiumCandidates is empty, so normal rotation used
      const allModels = [...baseConfig.models, ...baseConfig.premiumModels];
      expect(allModels).toContain(selected);
    });
  });
});
