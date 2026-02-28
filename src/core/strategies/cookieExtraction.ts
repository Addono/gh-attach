import { createBrowserSessionStrategy } from "./browserSession.js";
import type { UploadStrategy, UploadTarget } from "../types.js";

/**
 * Cookie Extraction upload strategy.
 * Extracts GitHub session cookies from locally installed browsers and uses the browser session strategy.
 *
 * @returns UploadStrategy implementation
 */
export function createCookieExtractionStrategy(): UploadStrategy {
  return {
    name: "cookie-extraction",

    async isAvailable(): Promise<boolean> {
      const cookies = await extractCookiesFromBrowsers();
      return !!cookies;
    },

    async upload(filePath: string, target: UploadTarget) {
      const cookies = await extractCookiesFromBrowsers();
      if (!cookies) {
        throw new Error("No GitHub cookies found in browsers");
      }
      const strategy = createBrowserSessionStrategy(cookies);
      return strategy.upload(filePath, target);
    },
  };
}

/**
 * Extracts GitHub session cookies from locally installed browsers.
 *
 * @internal
 */
async function extractCookiesFromBrowsers(): Promise<string | null> {
  // Try Chrome first
  const chromeCookies = await extractChromeCookies();
  if (chromeCookies) {
    return chromeCookies;
  }

  // Try Firefox
  const firefoxCookies = await extractFirefoxCookies();
  if (firefoxCookies) {
    return firefoxCookies;
  }

  return null;
}

/**
 * Extracts cookies from Chrome.
 *
 * @internal
 */
async function extractChromeCookies(): Promise<string | null> {
  // Chrome stores cookies in a SQLite database
  // This is a placeholder - actual implementation would require:
  // 1. Finding Chrome user data directory (OS-specific)
  // 2. Copying the encrypted cookie database
  // 3. Decrypting cookies (platform-specific)
  // 4. Extracting GitHub cookies

  // For now, return null (not implemented)
  return null;
}

/**
 * Extracts cookies from Firefox.
 *
 * @internal
 */
async function extractFirefoxCookies(): Promise<string | null> {
  // Firefox stores cookies in SQLite database
  // This is a placeholder - actual implementation would require:
  // 1. Finding Firefox profile directory (OS-specific)
  // 2. Accessing the cookie database
  // 3. Extracting GitHub cookies

  // For now, return null (not implemented)
  return null;
}
