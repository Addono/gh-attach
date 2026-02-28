import { execFile as execFileCallback } from "child_process";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  unlinkSync,
} from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { createBrowserSessionStrategy } from "./browserSession.js";
import {
  AuthenticationError,
  UploadError,
  type UploadStrategy,
  type UploadTarget,
} from "../types.js";

const execFile = promisify(execFileCallback);
const REQUIRED_COOKIE_NAMES = ["user_session", "logged_in", "_gh_sess"];

type BrowserName = "chrome" | "firefox";

interface BrowserCookieSource {
  browser: BrowserName;
  path: string;
  hostColumn: "host_key" | "host";
}

interface ExtractionResult {
  cookies: string | null;
  errors: string[];
}

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
      const { cookies } = await extractCookiesFromBrowsers();
      return cookies !== null;
    },

    async upload(filePath: string, target: UploadTarget) {
      const { cookies, errors } = await extractCookiesFromBrowsers();
      if (!cookies) {
        if (errors.length > 0) {
          throw new UploadError(
            "Failed to extract GitHub cookies from local browsers.",
            "COOKIE_EXTRACTION_FAILED",
            { errors },
          );
        }

        throw new AuthenticationError(
          "No GitHub browser session found. Run `gh-attach login` first.",
          "SESSION_EXPIRED",
        );
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
async function extractCookiesFromBrowsers(): Promise<ExtractionResult> {
  const sources = findCookieSources();
  const errors: string[] = [];

  for (const source of sources) {
    try {
      const cookies = await extractCookiesFromDatabase(source);
      if (cookies) {
        return { cookies, errors };
      }
    } catch (error) {
      errors.push(
        `${source.browser}:${source.path}:${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { cookies: null, errors };
}

/**
 * Finds browser cookie database candidates for current platform.
 *
 * @internal
 */
function findCookieSources(): BrowserCookieSource[] {
  const home = homedir();
  const localAppData = process.env.LOCALAPPDATA ?? "";
  const appData = process.env.APPDATA ?? "";

  const chromePaths =
    process.platform === "darwin"
      ? [
          join(
            home,
            "Library/Application Support/Google/Chrome/Default/Cookies",
          ),
          join(home, "Library/Application Support/Chromium/Default/Cookies"),
        ]
      : process.platform === "win32"
        ? [
            join(
              localAppData,
              "Google/Chrome/User Data/Default/Network/Cookies",
            ),
            join(localAppData, "Google/Chrome/User Data/Default/Cookies"),
            join(localAppData, "Chromium/User Data/Default/Network/Cookies"),
            join(localAppData, "Chromium/User Data/Default/Cookies"),
          ]
        : [
            join(home, ".config/google-chrome/Default/Cookies"),
            join(home, ".config/chromium/Default/Cookies"),
          ];

  const firefoxBaseDir =
    process.platform === "darwin"
      ? join(home, "Library/Application Support/Firefox/Profiles")
      : process.platform === "win32"
        ? join(appData, "Mozilla/Firefox/Profiles")
        : join(home, ".mozilla/firefox");

  const sources: BrowserCookieSource[] = [];

  for (const chromePath of chromePaths) {
    if (existsSync(chromePath)) {
      sources.push({
        browser: "chrome",
        path: chromePath,
        hostColumn: "host_key",
      });
    }
  }

  for (const firefoxPath of findFirefoxCookiePaths(firefoxBaseDir)) {
    if (existsSync(firefoxPath)) {
      sources.push({
        browser: "firefox",
        path: firefoxPath,
        hostColumn: "host",
      });
    }
  }

  return sources;
}

function findFirefoxCookiePaths(baseDir: string): string[] {
  if (!existsSync(baseDir)) {
    return [];
  }

  const profilesIniPath = join(baseDir, "profiles.ini");
  if (existsSync(profilesIniPath)) {
    return parseFirefoxProfilesIni(profilesIniPath, baseDir);
  }

  return readdirSync(baseDir)
    .map((entry) => join(baseDir, entry, "cookies.sqlite"))
    .filter((path) => existsSync(path));
}

function parseFirefoxProfilesIni(
  profilesIniPath: string,
  baseDir: string,
): string[] {
  const content = readFileSync(profilesIniPath, "utf-8");
  const lines = content.split(/\r?\n/);

  const results: string[] = [];
  let currentPath: string | null = null;
  let isRelative = true;

  const pushCurrentProfile = () => {
    if (!currentPath) {
      return;
    }

    const profilePath = isRelative
      ? join(baseDir, currentPath)
      : currentPath.replace(/^~(?=$|\/|\\)/, homedir());

    const cookiePath = join(profilePath, "cookies.sqlite");
    if (existsSync(cookiePath)) {
      results.push(cookiePath);
    }
  };

  for (const line of lines) {
    if (line.startsWith("[Profile")) {
      pushCurrentProfile();
      currentPath = null;
      isRelative = true;
      continue;
    }

    if (line.startsWith("Path=")) {
      currentPath = line.slice(5).trim();
      continue;
    }

    if (line.startsWith("IsRelative=")) {
      isRelative = line.slice(11).trim() !== "0";
    }
  }

  pushCurrentProfile();
  return results;
}

async function extractCookiesFromDatabase(
  source: BrowserCookieSource,
): Promise<string | null> {
  const tempDbPath = join(
    tmpdir(),
    `gh-attach-${source.browser}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`,
  );

  copyFileSync(source.path, tempDbPath);

  try {
    const query = [
      "SELECT name, value",
      "FROM cookies",
      `WHERE ${source.hostColumn} LIKE '%.github.com' OR ${source.hostColumn} = 'github.com'`,
      "ORDER BY CASE name",
      "WHEN 'user_session' THEN 1",
      "WHEN '_gh_sess' THEN 2",
      "WHEN 'logged_in' THEN 3",
      "ELSE 100 END",
      "LIMIT 20;",
    ].join(" ");

    const { stdout } = await execFile("sqlite3", [
      "-separator",
      "\t",
      tempDbPath,
      query,
    ]);

    return buildCookieHeader(stdout);
  } catch (error) {
    throw new UploadError(
      `Failed reading ${source.browser} cookie database`,
      "COOKIE_EXTRACTION_FAILED",
      { browser: source.browser, dbPath: source.path, cause: String(error) },
    );
  } finally {
    if (existsSync(tempDbPath)) {
      unlinkSync(tempDbPath);
    }
  }
}

function buildCookieHeader(rawRows: string): string | null {
  const rows = rawRows
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [name = "", ...valueParts] = line.split("\t");
      return {
        name,
        value: valueParts.join("\t"),
      };
    })
    .filter((cookie) => cookie.name.length > 0 && cookie.value.length > 0);

  if (rows.length === 0) {
    return null;
  }

  const byName = new Map<string, string>();
  for (const row of rows) {
    byName.set(row.name, row.value);
  }

  if (!byName.has("user_session")) {
    return null;
  }

  const orderedNames = [
    ...REQUIRED_COOKIE_NAMES.filter((name) => byName.has(name)),
    ...Array.from(byName.keys()).filter(
      (name) => !REQUIRED_COOKIE_NAMES.includes(name),
    ),
  ];

  return orderedNames.map((name) => `${name}=${byName.get(name)}`).join("; ");
}

/**
 * Testing hooks for cookie extraction internals.
 *
 * @internal
 */
export const cookieExtractionInternals = {
  findCookieSources,
  findFirefoxCookiePaths,
  parseFirefoxProfilesIni,
  extractCookiesFromDatabase,
  extractCookiesFromBrowsers,
  buildCookieHeader,
};
