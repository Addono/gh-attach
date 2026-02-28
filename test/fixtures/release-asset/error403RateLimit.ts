/**
 * Fixture: release-asset API rate limit (403)
 *
 * Covers: GitHub API returns a rate limit exceeded error for release lookup.
 */
export const releaseAssetError403RateLimit = {
  name: "release-asset/error-403-rate-limit",
  interactions: [
    {
      id: "get-release-by-tag",
      method: "GET",
      url: "https://api.github.com/repos/testowner/testrepo/releases/tags/_gh-attach-assets",
      response: {
        status: 403,
        headers: {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1234567890",
        },
        json: {
          message: "API rate limit exceeded for 192.0.2.1.",
          documentation_url:
            "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
        },
      },
    },
  ],
} as const;
