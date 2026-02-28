import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface SessionData {
  cookies?: string;
  username?: string;
  expires?: number;
}

/**
 * Get the session state file path (XDG compliant).
 */
function getStatePath(): string {
  const envPath = process.env.GH_ATTACH_STATE_PATH;
  if (envPath) {
    return envPath;
  }
  const stateDir =
    process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
  return join(stateDir, "gh-attach", "session.json");
}

/**
 * Load session data from file.
 */
function loadSession(): SessionData | null {
  const path = getStatePath();
  if (!existsSync(path)) {
    return null;
  }
  try {
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Save session data to file.
 * @internal
 */
export function saveSession(session: SessionData): void {
  const path = getStatePath();
  const dir = path.substring(0, path.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(session, null, 2), "utf-8");
}

interface LoginOptions {
  status?: boolean;
  statePath?: string;
}

/**
 * Login command implementation.
 */
export async function loginCommand(options: LoginOptions) {
  if (options.status) {
    // Check current auth status
    const session = loadSession();
    if (!session) {
      console.log("Status: not authenticated");
      process.exit(1);
    }

    // Check if session is expired
    if (session.expires && session.expires < Date.now()) {
      console.log("Status: session expired");
      process.exit(1);
    }

    if (session.username) {
      console.log(`Status: authenticated as ${session.username}`);
    } else {
      console.log("Status: session found but username not set");
    }
  } else {
    // Interactive login - for now, provide instructions
    throw new Error(
      "Interactive browser login is not yet implemented. " +
        "Please set GH_ATTACH_COOKIES environment variable with your GitHub session cookies, " +
        "or use GITHUB_TOKEN with a personal access token.",
    );
  }
}
