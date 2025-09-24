#!/usr/bin/env node

const ShaiHuludScanner = require("../lib/scanner");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    json: false,
    help: false,
    version: false,
    directory: process.cwd()
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case "--json":
        options.json = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--version":
      case "-v":
        options.version = true;
        break;
      case "--dir":
      case "-d":
        if (i + 1 < args.length) {
          options.directory = args[i + 1];
          i++; // Skip next argument
        }
        break;
      default:
        if (!arg.startsWith("-")) {
          options.directory = arg;
        }
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
🔍 Shai-Hulud Supply Chain Attack Detection Tool

Usage:
  shai-hulud-scan [options] [directory]

Options:
  --json, -j          Output results in JSON format
  --dir, -d <dir>     Specify directory to scan (default: current directory)
  --help, -h          Show help information
  --version, -v       Show version information

Examples:
  shai-hulud-scan                    # Scan current directory
  shai-hulud-scan --json            # JSON format output
  shai-hulud-scan /path/to/project  # Scan specified directory
  shai-hulud-scan -d ./src --json   # Scan src directory and output JSON

How it works:
  The tool recursively scans package-lock.json, yarn.lock, and pnpm-lock.yaml files
  in the specified directory to check for npm packages and versions that were
  compromised in the "Shai-Hulud" attack.

Output format:
  ❌ ALERT: package@version in path/to/lockfile - Known risk
`);
}

function showVersion() {
  const packageJson = require("../package.json");
  console.log(packageJson.version);
}

function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (options.version) {
    showVersion();
    process.exit(0);
  }

  if (!require("fs").existsSync(options.directory)) {
    console.error(`❌ Directory does not exist: ${options.directory}`);
    process.exit(1);
  }

  try {
    const scanner = new ShaiHuludScanner();
    const results = scanner.scan(options.directory, options);
    const output = scanner.formatOutput(results, options);
    
    console.log(output);
    
    if (results.total > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error occurred during scanning:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, parseArgs, showHelp, showVersion };
