#!/usr/bin/env node

/**
 * gh-attach CLI entry point.
 */

import { readFileSync } from "fs";
import { Command } from "commander";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

const program = new Command();

program
  .name("gh-attach")
  .description("Upload images to GitHub issues, PRs, and comments")
  .version(pkg.version);

program
  .command("upload")
  .description("Upload an image and get a markdown embed URL")
  .argument("<files...>", "Image file(s) to upload")
  .requiredOption("--target <ref>", "GitHub issue/PR reference (owner/repo#N, #N, or URL)")
  .option("--strategy <name>", "Upload strategy to use")
  .option("--format <type>", "Output format: markdown, url, json", "markdown")
  .option("--stdin", "Read image from stdin")
  .option("--filename <name>", "Filename when using --stdin")
  .action(async (files, options) => {
    try {
      const { uploadCommand } = await import("./commands/upload.js");
      await uploadCommand(files, options);
    } catch (err) {
      if (err instanceof Error) {
        console.error(`Error: ${err.message}`);
      } else {
        console.error(`Error: ${String(err)}`);
      }
      process.exit(1);
    }
  });

program
  .command("login")
  .description("Authenticate with GitHub via browser")
  .option("--state-path <path>", "Path to save session state")
  .option("--status", "Check current authentication status")
  .action(async (options) => {
    try {
      const { loginCommand } = await import("./commands/login.js");
      await loginCommand(options);
    } catch (err) {
      if (err instanceof Error) {
        console.error(`Error: ${err.message}`);
      } else {
        console.error(`Error: ${String(err)}`);
      }
      process.exit(1);
    }
  });

program
  .command("config")
  .description("Manage gh-attach configuration")
  .argument("<action>", "Action: list, set, get")
  .argument("[key]", "Configuration key")
  .argument("[value]", "Configuration value")
  .action(async (action, key, value) => {
    try {
      const { configCommand } = await import("./commands/config.js");
      await configCommand(action, key, value);
    } catch (err) {
      if (err instanceof Error) {
        console.error(`Error: ${err.message}`);
      } else {
        console.error(`Error: ${String(err)}`);
      }
      process.exit(1);
    }
  });

program
  .command("mcp")
  .description("Start the MCP server")
  .option("--transport <type>", "Transport: stdio, http", "stdio")
  .option("--port <number>", "Port for HTTP transport", "3000")
  .action(async (options) => {
    try {
      const { mcpCommand } = await import("./commands/mcp.js");
      await mcpCommand(options);
    } catch (err) {
      if (err instanceof Error) {
        console.error(`Error: ${err.message}`);
      } else {
        console.error(`Error: ${String(err)}`);
      }
      process.exit(1);
    }
  });

program.parse();

