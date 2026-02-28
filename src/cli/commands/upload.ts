import { createReleaseAssetStrategy } from "../../core/strategies/releaseAsset.js";
import { createBrowserSessionStrategy } from "../../core/strategies/browserSession.js";
import { createCookieExtractionStrategy } from "../../core/strategies/cookieExtraction.js";
import { createRepoBranchStrategy } from "../../core/strategies/repoBranch.js";
import { parseTarget } from "../../core/target.js";
import { validateFile } from "../../core/validation.js";
import { upload } from "../../core/upload.js";
import type { UploadStrategy } from "../../core/types.js";

interface UploadOptions {
  target: string;
  strategy?: string;
  format?: "markdown" | "url" | "json";
  stdin?: boolean;
  filename?: string;
}

/**
 * Upload command implementation.
 */
export async function uploadCommand(files: string[], options: UploadOptions) {
  // Parse target
  let uploadTarget;
  try {
    uploadTarget = parseTarget(options.target);
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`Invalid target: ${err.message}`);
    }
    throw err;
  }

  // Build strategies list
  const strategies: UploadStrategy[] = [];

  // If a specific strategy is requested, only use that one
  if (options.strategy) {
    const token = process.env.GITHUB_TOKEN;
    const cookies = process.env.GH_ATTACH_COOKIES;

    switch (options.strategy) {
      case "release-asset":
        if (!token) {
          throw new Error(
            "release-asset strategy requires GITHUB_TOKEN environment variable",
          );
        }
        strategies.push(createReleaseAssetStrategy(token));
        break;
      case "browser-session":
        if (!cookies) {
          throw new Error(
            "browser-session strategy requires GH_ATTACH_COOKIES environment variable",
          );
        }
        strategies.push(createBrowserSessionStrategy(cookies));
        break;
      case "cookie-extraction":
        strategies.push(createCookieExtractionStrategy());
        break;
      case "repo-branch":
        if (!token) {
          throw new Error(
            "repo-branch strategy requires GITHUB_TOKEN environment variable",
          );
        }
        strategies.push(createRepoBranchStrategy(token));
        break;
      default:
        throw new Error(`Unknown strategy: ${options.strategy}`);
    }
  } else {
    // Default strategy order: browser-session, cookie-extraction, release-asset, repo-branch
    const token = process.env.GITHUB_TOKEN;
    const cookies = process.env.GH_ATTACH_COOKIES;

    if (cookies) {
      strategies.push(createBrowserSessionStrategy(cookies));
    }
    strategies.push(createCookieExtractionStrategy());
    if (token) {
      strategies.push(createReleaseAssetStrategy(token));
      strategies.push(createRepoBranchStrategy(token));
    }
  }

  if (strategies.length === 0) {
    throw new Error(
      "No authentication available. Set GITHUB_TOKEN or GH_ATTACH_COOKIES",
    );
  }

  // Process files
  const results = [];
  for (const file of files) {
    // Validate file
    try {
      await validateFile(file);
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(`File validation failed: ${err.message}`);
      }
      throw err;
    }

    // Upload file
    try {
      const result = await upload(file, uploadTarget, strategies);
      results.push(result);
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(`Upload failed: ${err.message}`);
      }
      throw err;
    }
  }

  // Output results
  const format = options.format || "markdown";
  for (const result of results) {
    switch (format) {
      case "url":
        console.log(result.url);
        break;
      case "json":
        console.log(JSON.stringify(result, null, 2));
        break;
      case "markdown":
      default:
        console.log(result.markdown);
    }
  }
}
