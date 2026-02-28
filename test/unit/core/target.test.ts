import { describe, it, expect, vi, afterEach } from "vitest";
import { parseTarget } from "../../../src/core/target.js";
import { ValidationError } from "../../../src/core/types.js";

describe("parseTarget", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Full URL parsing", () => {
    it("parses GitHub issue URL", () => {
      const result = parseTarget("https://github.com/owner/repo/issues/42");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        type: "issue",
        number: 42,
      });
    });

    it("parses GitHub pull URL", () => {
      const result = parseTarget("https://github.com/owner/repo/pull/99");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        type: "pull",
        number: 99,
      });
    });

    it("handles multiple digits in issue number", () => {
      const result = parseTarget(
        "https://github.com/my-org/my-repo/issues/12345",
      );
      expect(result.number).toBe(12345);
    });

    it("handles hyphens in owner and repo names", () => {
      const result = parseTarget("https://github.com/my-org/my-repo/issues/1");
      expect(result.owner).toBe("my-org");
      expect(result.repo).toBe("my-repo");
    });
  });

  describe("Shorthand reference parsing", () => {
    it("parses owner/repo#issue format", () => {
      const result = parseTarget("owner/repo#42");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        type: "issue",
        number: 42,
      });
    });

    it("parses owner/repo#pull/number format", () => {
      const result = parseTarget("owner/repo#pull/42");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        type: "pull",
        number: 42,
      });
    });

    it("handles hyphens in shorthand", () => {
      const result = parseTarget("my-org/my-repo#pull/100");
      expect(result.owner).toBe("my-org");
      expect(result.repo).toBe("my-repo");
      expect(result.type).toBe("pull");
      expect(result.number).toBe(100);
    });
  });

  describe("Local reference with git remote inference", () => {
    it("parses #42 and infers from git remote (SSH format)", () => {
      const mockGetGitRemote = () => ["owner", "repo"] as [string, string];
      const result = parseTarget("#42", mockGetGitRemote);
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        type: "issue",
        number: 42,
      });
    });

    it("parses #42 and infers from git remote (HTTPS format)", () => {
      const mockGetGitRemote = () => ["owner", "repo"] as [string, string];
      const result = parseTarget("#42", mockGetGitRemote);
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        type: "issue",
        number: 42,
      });
    });

    it("parses #pull/42 and infers from git remote", () => {
      const mockGetGitRemote = () => ["owner", "repo"] as [string, string];
      const result = parseTarget("#pull/42", mockGetGitRemote);
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        type: "pull",
        number: 42,
      });
    });

    it("handles git remote without .git suffix (SSH)", () => {
      const mockGetGitRemote = () => ["owner", "repo"] as [string, string];
      const result = parseTarget("#42", mockGetGitRemote);
      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
    });

    it("handles git remote without .git suffix (HTTPS)", () => {
      const mockGetGitRemote = () => ["owner", "repo"] as [string, string];
      const result = parseTarget("#42", mockGetGitRemote);
      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
    });

    it("throws INVALID_TARGET when git remote is not found", () => {
      const mockGetGitRemote = () => {
        throw new ValidationError(
          "Could not infer repository from git remote.",
          "INVALID_TARGET",
          { reason: "git_remote_not_found" },
        );
      };
      expect(() => parseTarget("#42", mockGetGitRemote)).toThrow(
        ValidationError,
      );
    });

    it("throws INVALID_TARGET when git remote is invalid", () => {
      const mockGetGitRemote = () => {
        throw new ValidationError(
          "Could not infer repository from git remote.",
          "INVALID_TARGET",
          { reason: "git_remote_not_found" },
        );
      };
      expect(() => parseTarget("#42", mockGetGitRemote)).toThrow(
        ValidationError,
      );
    });

    it("includes git_remote_not_found in error details", () => {
      const mockGetGitRemote = () => {
        throw new ValidationError(
          "Could not infer repository from git remote.",
          "INVALID_TARGET",
          { reason: "git_remote_not_found" },
        );
      };
      try {
        parseTarget("#42", mockGetGitRemote);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).code).toBe("INVALID_TARGET");
        expect((err as ValidationError).details?.reason).toBe(
          "git_remote_not_found",
        );
      }
    });
  });

  describe("Invalid input handling", () => {
    it("throws INVALID_TARGET for random strings", () => {
      expect(() => parseTarget("invalid target format")).toThrow(
        ValidationError,
      );
      expect(() => parseTarget("invalid target format")).toThrow(
        "Invalid target",
      );
    });

    it("throws INVALID_TARGET for malformed URLs", () => {
      expect(() => parseTarget("https://example.com/invalid")).toThrow(
        ValidationError,
      );
    });

    it("throws INVALID_TARGET for empty string", () => {
      expect(() => parseTarget("")).toThrow(ValidationError);
    });

    it("includes target in error details", () => {
      try {
        parseTarget("bad format");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).details?.target).toBe("bad format");
      }
    });

    it("throws INVALID_TARGET for #pull without number", () => {
      const mockGetGitRemote = () => ["owner", "repo"] as [string, string];
      expect(() => parseTarget("#pull", mockGetGitRemote)).toThrow(
        ValidationError,
      );
    });

    it("throws INVALID_TARGET for malformed shorthand", () => {
      expect(() => parseTarget("owner#42")).toThrow(ValidationError);
      expect(() => parseTarget("owner/repo/issue/42")).toThrow(ValidationError);
    });
  });

  describe("Edge cases", () => {
    it("handles large issue numbers", () => {
      const result = parseTarget("owner/repo#999999999");
      expect(result.number).toBe(999999999);
    });

    it("handles single-digit issue numbers", () => {
      const result = parseTarget("owner/repo#1");
      expect(result.number).toBe(1);
    });

    it("accepts pull/0 (edge case)", () => {
      const result = parseTarget("owner/repo#pull/0");
      expect(result.type).toBe("pull");
      expect(result.number).toBe(0);
    });
  });
});
