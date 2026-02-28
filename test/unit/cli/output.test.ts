import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debug, info, globalOptions } from "../../../src/cli/output.js";

describe("CLI output helpers", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    globalOptions.verbose = false;
    globalOptions.quiet = false;
    globalOptions.noColor = false;
  });

  afterEach(() => {
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  describe("debug", () => {
    it("prints to stderr when verbose is enabled", () => {
      globalOptions.verbose = true;
      debug("test message");
      expect(errorSpy).toHaveBeenCalledWith("[debug] test message");
    });

    it("does not print when verbose is disabled", () => {
      globalOptions.verbose = false;
      debug("test message");
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("does not print when quiet overrides verbose", () => {
      globalOptions.verbose = true;
      globalOptions.quiet = true;
      debug("test message");
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe("info", () => {
    it("prints to stdout when not in quiet mode", () => {
      info("info message");
      expect(logSpy).toHaveBeenCalledWith("info message");
    });

    it("does not print when quiet mode is enabled", () => {
      globalOptions.quiet = true;
      info("info message");
      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
