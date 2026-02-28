/**
 * Fixture: release-asset first upload (success)
 *
 * Covers: auth check → release lookup (404) → release creation → asset list → upload asset.
 */
export const releaseAssetFirstUploadSuccess = {
  name: "release-asset/first-upload-success",
  interactions: [
    {
      id: "get-authenticated",
      method: "GET",
      url: "https://api.github.com/user",
      response: { status: 200, json: { login: "octocat" } },
    },
    {
      id: "get-release-by-tag",
      method: "GET",
      url: "https://api.github.com/repos/testowner/testrepo/releases/tags/_gh-attach-assets",
      response: { status: 404, json: { message: "Not Found" } },
    },
    {
      id: "create-release",
      method: "POST",
      url: "https://api.github.com/repos/testowner/testrepo/releases",
      response: {
        status: 201,
        json: { id: 456, tag_name: "_gh-attach-assets", draft: true },
      },
    },
    {
      id: "list-release-assets",
      method: "GET",
      url: "https://api.github.com/repos/testowner/testrepo/releases/456/assets",
      response: { status: 200, json: [] },
    },
    {
      id: "upload-release-asset",
      method: "POST",
      url: /^https:\/\/uploads\.github\.com\/repos\/testowner\/testrepo\/releases\/456\/assets\?name=test-image\.png(&.*)?$/,
      response: {
        status: 201,
        json: {
          browser_download_url:
            "https://github.com/testowner/testrepo/releases/download/_gh-attach-assets/test-image.png",
        },
      },
    },
  ],
} as const;
