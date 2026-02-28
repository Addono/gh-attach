import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
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
  // Handle stdin input
  if (options.stdin) {
    if (!options.filename) {
      throw new Error("--filename is required when using --stdin");
    }
    const stdinBuffer = await readStdin();
    const tempFile = join(tmpdir(), options.filename);
    writeFileSync(tempFile, stdinBuffer);
    files = [tempFile];
  }

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
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const cookies = process.env.GH_ATTACH_COOKIES;

    switch (options.strategy) {
      case "release-asset":
        if (!token) {
          throw new Error(
            "release-asset strategy requires GITHUB_TOKEN or GH_TOKEN environment variable",
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
            "repo-branch strategy requires GITHUB_TOKEN or GH_TOKEN environment variable",
          );
        }
        strategies.push(createRepoBranchStrategy(token));
        break;
      default:
        throw new Error(`Unknown strategy: ${options.strategy}`);
    }
  } else {
    // Default strategy order: browser-session, cookie-extraction, release-asset, repo-branch
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
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
      "No authentication available. Set GITHUB_TOKEN (or GH_TOKEN) or GH_ATTACH_COOKIES",
    );
  }

  // Process files
  const results = [];
  try {
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
  } finally {
    // Clean up temp files from stdin
    if (options.stdin) {
      for (const file of files) {
        try {
          unlinkSync(file);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }
}

/**
 * Reads image data from stdin.
 */
async function readStdin(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => {
      chunks.push(chunk);
    });
    process.stdin.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    process.stdin.on("error", reject);
  });
}
