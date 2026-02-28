import { execSync } from "child_process";
import { ValidationError } from "./types.js";
import type { UploadTarget } from "./types.js";

/**
 * Parses a GitHub issue/PR target from various input formats:
 * - Full URL: https://github.com/owner/repo/issues/42 or .../pull/42
 * - Shorthand: owner/repo#42 or owner/repo#pull/42
 * - Local ref: #42 (infers owner/repo from git remote)
 *
 * @param target Target string in various formats
 * @param getGitRemoteImpl Optional function to retrieve git remote (for testing)
 * @returns Parsed UploadTarget with owner, repo, type, and number
 * @throws ValidationError with code INVALID_TARGET if parsing fails
 */
export function parseTarget(
  target: string,
  getGitRemoteImpl: () => [string, string] = getGitRemote,
): UploadTarget {
  // Try URL format: https://github.com/owner/repo/issues/42 or .../pull/42
  const urlMatch = target.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/,
  );
  if (urlMatch) {
    return {
      owner: urlMatch[1] || "",
      repo: urlMatch[2] || "",
      type: urlMatch[3] === "pull" ? "pull" : "issue",
      number: parseInt(urlMatch[4] || "0", 10),
    };
  }

  // Try shorthand: owner/repo#42 or owner/repo#pull/42
  const shorthandMatch = target.match(/^([^/]+)\/([^#]+)#(pull\/)?(\d+)$/);
  if (shorthandMatch) {
    return {
      owner: shorthandMatch[1] || "",
      repo: shorthandMatch[2] || "",
      type: shorthandMatch[3] ? "pull" : "issue",
      number: parseInt(shorthandMatch[4] || "0", 10),
    };
  }

  // Try local ref: #42 (infer from git remote)
  const localRefMatch = target.match(/^#(pull\/)?(\d+)$/);
  if (localRefMatch) {
    const [owner, repo] = getGitRemoteImpl();
    return {
      owner,
      repo,
      type: localRefMatch[1] ? "pull" : "issue",
      number: parseInt(localRefMatch[2] || "0", 10),
    };
  }

  throw new ValidationError(
    `Invalid target: ${target}. Expected format: https://github.com/owner/repo/issues/42, owner/repo#42, or #42`,
    "INVALID_TARGET",
    { target },
  );
}

/**
 * Extracts owner and repo from the current directory's git remote.
 *
 * @returns [owner, repo] tuple
 * @throws ValidationError if git remote is not found or invalid
 */
function getGitRemote(): [string, string] {
  try {
    const remoteUrl = execSync("git config --get remote.origin.url", {
      encoding: "utf-8",
    }).trim();

    // Parse git@github.com:owner/repo.git or https://github.com/owner/repo.git
    const sshMatch = remoteUrl.match(
      /git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
    );
    if (sshMatch) {
      return [sshMatch[1] || "", sshMatch[2] || ""];
    }

    const httpsMatch = remoteUrl.match(
      /https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
    );
    if (httpsMatch) {
      return [httpsMatch[1] || "", httpsMatch[2] || ""];
    }

    throw new Error("Could not parse git remote URL");
  } catch {
    throw new ValidationError(
      "Could not infer repository from git remote. Use full target format: owner/repo#42 or https://github.com/owner/repo/issues/42",
      "INVALID_TARGET",
      { reason: "git_remote_not_found" },
    );
  }
}
