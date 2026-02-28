/**
 * Fixture: release-asset server error (500)
 *
 * Covers: GitHub API returns 500 for release lookup.
 */
export const releaseAssetError500ServerError = {
  name: "release-asset/error-500-server-error",
  interactions: [
    {
      id: "get-release-by-tag",
      method: "GET",
      url: "https://api.github.com/repos/testowner/testrepo/releases/tags/_gh-attach-assets",
      response: { status: 500, json: { message: "Server Error" } },
    },
  ],
} as const;
