/**
 * Global CLI options that apply to all commands.
 */
export interface GlobalOptions {
  verbose?: boolean;
  quiet?: boolean;
  noColor?: boolean;
}

/**
 * Global state for CLI options.
 */
export const globalOptions: GlobalOptions = {};

/**
 * Log debug information (only in verbose mode).
 */
export function debug(message: string): void {
  if (globalOptions.verbose && !globalOptions.quiet) {
    console.error(`[debug] ${message}`);
  }
}

/**
 * Log informational message (suppressed in quiet mode).
 */
export function info(message: string): void {
  if (!globalOptions.quiet) {
    console.log(message);
  }
}
