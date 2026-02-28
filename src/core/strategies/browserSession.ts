import { createReadStream } from "fs";
import { basename } from "path";
import { AuthenticationError, UploadError } from "../types.js";
import type { UploadResult, UploadStrategy, UploadTarget } from "../types.js";

/**
 * Browser Session upload strategy using GitHub's undocumented browser upload flow.
 * Requires a valid session cookie to be provided.
 *
 * @param cookies Session cookies (from browser or other source)
 * @returns UploadStrategy implementation
 */
export function createBrowserSessionStrategy(cookies: string): UploadStrategy {
  return {
    name: "browser-session",

    async isAvailable(): Promise<boolean> {
      return !!cookies;
    },

    async upload(filePath: string, target: UploadTarget): Promise<UploadResult> {
      try {
        // Get repository ID from GitHub
        const repoId = await getRepositoryId(target, cookies);

        // Get upload policy and CSRF token
        const { uploadUrl, formData, csrfToken } = await getUploadPolicy(
          target,
          repoId,
          cookies,
        );

        // Upload file to S3
        await uploadToS3(uploadUrl, formData, filePath);

        // Confirm upload
        const url = await confirmUpload(target, csrfToken, basename(filePath), cookies);

        // Generate markdown
        const markdown = `![${basename(filePath)}](${url})`;

        return {
          url,
          markdown,
          strategy: "browser-session",
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
          `Browser session upload failed: ${err instanceof Error ? err.message : String(err)}`,
          "BROWSER_SESSION_FAILED",
          { filePath, target, originalError: String(err) },
        );
      }
    },
  };
}

/**
 * Gets the repository ID from GitHub.
 *
 * @internal
 */
async function getRepositoryId(target: UploadTarget, cookies: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${target.owner}/${target.repo}`,
      {
        headers: {
          Cookie: cookies,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    if (!response.ok) {
      throw new AuthenticationError(
        "Cannot access repository. Session may have expired.",
        "SESSION_EXPIRED",
        { target, status: response.status },
      );
    }

    const data = (await response.json()) as { id: number };
    return String(data.id);
  } catch (err) {
    if (err instanceof AuthenticationError) {
      throw err;
    }
    throw new UploadError(
      `Failed to get repository ID: ${err instanceof Error ? err.message : String(err)}`,
      "REPO_ID_FETCH_FAILED",
      { target, originalError: String(err) },
    );
  }
}

/**
 * Gets the upload policy and CSRF token from GitHub.
 *
 * @internal
 */
async function getUploadPolicy(
  target: UploadTarget,
  repoId: string,
  cookies: string,
): Promise<{
  uploadUrl: string;
  formData: Record<string, string>;
  csrfToken: string;
}> {
  try {
    const response = await fetch(
      `https://github.com/${target.owner}/${target.repo}/upload/policies/assets`,
      {
        method: "POST",
        headers: {
          Cookie: cookies,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repository_id: repoId }),
      },
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError(
        "Session expired or invalid. Please login again.",
        "SESSION_EXPIRED",
        { status: response.status },
      );
    }

    if (!response.ok) {
      const text = await response.text();
      throw new UploadError(
        `Failed to get upload policy: ${response.statusText}`,
        "CSRF_EXTRACTION_FAILED",
        { status: response.status, responseBody: text.substring(0, 200) },
      );
    }

    const data = (await response.json()) as {
      upload_url: string;
      form: Record<string, string>;
      token: string;
    };

    return {
      uploadUrl: data.upload_url,
      formData: data.form,
      csrfToken: data.token,
    };
  } catch (err) {
    if (err instanceof AuthenticationError || err instanceof UploadError) {
      throw err;
    }
    throw new UploadError(
      `Failed to get upload policy: ${err instanceof Error ? err.message : String(err)}`,
      "CSRF_EXTRACTION_FAILED",
      { originalError: String(err) },
    );
  }
}

/**
 * Uploads the file to S3 using the provided policy.
 *
 * @internal
 */
async function uploadToS3(
  uploadUrl: string,
  formData: Record<string, string>,
  filePath: string,
): Promise<void> {
  try {
    const file = createReadStream(filePath);
    const form = new FormData();

    // Add form fields
    for (const [key, value] of Object.entries(formData)) {
      form.append(key, value);
    }

    // Add file
    form.append("file", file as any); // File as Blob

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      throw new UploadError(
        `Failed to upload to S3: ${response.statusText}`,
        "S3_UPLOAD_FAILED",
        { status: response.status },
      );
    }
  } catch (err) {
    if (err instanceof UploadError) {
      throw err;
    }
    throw new UploadError(
      `Failed to upload to S3: ${err instanceof Error ? err.message : String(err)}`,
      "S3_UPLOAD_FAILED",
      { originalError: String(err) },
    );
  }
}

/**
 * Confirms the upload with GitHub.
 *
 * @internal
 */
async function confirmUpload(
  target: UploadTarget,
  csrfToken: string,
  filename: string,
  cookies: string,
): Promise<string> {
  try {
    const response = await fetch(
      `https://github.com/${target.owner}/${target.repo}/upload/policies/assets/${csrfToken}/confirm`,
      {
        method: "PUT",
        headers: {
          Cookie: cookies,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: filename }),
      },
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError(
        "Session expired or invalid.",
        "SESSION_EXPIRED",
        { status: response.status },
      );
    }

    if (!response.ok) {
      throw new UploadError(
        `Failed to confirm upload: ${response.statusText}`,
        "CONFIRM_UPLOAD_FAILED",
        { status: response.status },
      );
    }

    const data = (await response.json()) as { url: string };
    return data.url;
  } catch (err) {
    if (err instanceof AuthenticationError || err instanceof UploadError) {
      throw err;
    }
    throw new UploadError(
      `Failed to confirm upload: ${err instanceof Error ? err.message : String(err)}`,
      "CONFIRM_UPLOAD_FAILED",
      { originalError: String(err) },
    );
  }
}
