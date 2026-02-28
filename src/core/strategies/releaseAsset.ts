import { Octokit } from "@octokit/rest";
import { createReadStream } from "fs";
import { basename } from "path";
import { AuthenticationError, UploadError } from "../types.js";
import type { UploadResult, UploadStrategy, UploadTarget } from "../types.js";

const ASSETS_TAG = "_gh-attach-assets";

/**
 * Release Asset upload strategy using GitHub's official REST API.
 * Uploads images as assets to a special draft release in the repository.
 *
 * @param token GitHub API token with `contents:write` permission
 * @returns UploadStrategy implementation
 */
export function createReleaseAssetStrategy(token: string): UploadStrategy {
  const octokit = new Octokit({ auth: token });

  return {
    name: "release-asset",

    async isAvailable(): Promise<boolean> {
      if (!token) return false;
      try {
        await octokit.rest.users.getAuthenticated();
        return true;
      } catch {
        return false;
      }
    },

    async upload(filePath: string, target: UploadTarget): Promise<UploadResult> {
      try {
        // Find or create the assets release
        const release = await findOrCreateAssetsRelease(octokit, target);

        // Upload the file as a release asset
        const filename = basename(filePath);
        const url = await uploadAsset(
          octokit,
          target,
          release.id,
          filePath,
          filename,
        );

        // Generate markdown
        const markdown = `![${filename}](${url})`;

        return {
          url,
          markdown,
          strategy: "release-asset",
        };
      } catch (err) {
        // Re-throw authentication errors
        if (err instanceof AuthenticationError) {
          throw err;
        }
        // Re-throw upload errors
        if (err instanceof UploadError) {
          throw err;
        }
        // Wrap other errors
        throw new UploadError(
          `Release asset upload failed: ${err instanceof Error ? err.message : String(err)}`,
          "RELEASE_ASSET_FAILED",
          { filePath, target, originalError: String(err) },
        );
      }
    },
  };
}

/**
 * Finds or creates the assets release.
 *
 * @internal
 */
async function findOrCreateAssetsRelease(
  octokit: InstanceType<typeof Octokit>,
  target: UploadTarget,
) {
  try {
    // Try to get the assets release
    const { data: release } = await octokit.rest.repos.getReleaseByTag({
      owner: target.owner,
      repo: target.repo,
      tag: ASSETS_TAG,
    });
    return release;
  } catch (err: unknown) {
    // If release doesn't exist, create it
    if (
      err instanceof Error &&
      err.message.includes("404") &&
      "status" in err &&
      err.status === 404
    ) {
      try {
        const { data: newRelease } = await octokit.rest.repos.createRelease({
          owner: target.owner,
          repo: target.repo,
          tag_name: ASSETS_TAG,
          name: "Image Assets",
          draft: true,
        });
        return newRelease;
      } catch (createErr) {
        throw new AuthenticationError(
          `Cannot create release: insufficient permissions or repository access`,
          "INSUFFICIENT_PERMISSIONS",
          { target, originalError: String(createErr) },
        );
      }
    }

    // Check for permission-related errors
    if (
      err instanceof Error &&
      (err.message.includes("403") ||
        err.message.includes("Forbidden") ||
        err.message.includes("403 Forbidden"))
    ) {
      throw new AuthenticationError(
        `Insufficient permissions to access releases in ${target.owner}/${target.repo}`,
        "INSUFFICIENT_PERMISSIONS",
        { target, originalError: String(err) },
      );
    }

    throw new UploadError(
      `Failed to find or create assets release: ${err instanceof Error ? err.message : String(err)}`,
      "RELEASE_LOOKUP_FAILED",
      { target, originalError: String(err) },
    );
  }
}

/**
 * Uploads a file as a release asset.
 *
 * @internal
 */
async function uploadAsset(
  octokit: InstanceType<typeof Octokit>,
  target: UploadTarget,
  releaseId: number,
  filePath: string,
  filename: string,
): Promise<string> {
  const stream = createReadStream(filePath);

  try {
    // Check if file already exists and handle collision
    let finalFilename = filename;
    try {
      const { data: assets } = await octokit.rest.repos.listReleaseAssets({
        owner: target.owner,
        repo: target.repo,
        release_id: releaseId,
      });

      const existing = assets.find((a) => a.name === filename);
      if (existing) {
        // Append a hash suffix to avoid collision
        const ext = filename.includes(".") ? filename.substring(filename.lastIndexOf(".")) : "";
        const base = filename.includes(".") ? filename.substring(0, filename.lastIndexOf(".")) : filename;
        const hash = Math.random().toString(36).substring(2, 8);
        finalFilename = `${base}-${hash}${ext}`;
      }
    } catch {
      // Continue with original filename if we can't list assets
    }

    const { data: asset } = await octokit.rest.repos.uploadReleaseAsset({
      owner: target.owner,
      repo: target.repo,
      release_id: releaseId,
      name: finalFilename,
      data: stream as any, // octokit expects any type here
    });

    return asset.browser_download_url;
  } catch (err) {
    throw new UploadError(
      `Failed to upload asset: ${err instanceof Error ? err.message : String(err)}`,
      "ASSET_UPLOAD_FAILED",
      { filePath, target, originalError: String(err) },
    );
  }
}
