/**
 * Fixture: release-asset invalid token (401)
 *
 * Covers: GitHub API returns 401 for release lookup.
 */
export const releaseAssetError401InvalidToken = {
  name: "release-asset/error-401-invalid-token",
  interactions: [
    {
      id: "get-release-by-tag",
      method: "GET",
      url: "https://api.github.com/repos/testowner/testrepo/releases/tags/_gh-attach-assets",
      response: { status: 401, json: { message: "Bad credentials" } },
    },
  ],
} as const;
