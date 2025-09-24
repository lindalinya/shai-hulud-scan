# Shai-Hulud Supply Chain Attack Detection Tool

🔍 A CLI tool for detecting the "Shai-Hulud" npm supply chain attack that occurred in September 2025.

## Features

- ✅ Support for detecting `package-lock.json`, `yarn.lock`, and `pnpm-lock.yaml` files
- ✅ Recursive directory scanning
- ✅ JSON format output support
- ✅ **Zero third-party dependencies** - Fully self-contained, no external packages required
- ✅ Support for npx direct execution
- ✅ Lightweight - Uses only Node.js built-in modules

## Installation

### Recommended: Use npx (no installation required)

```bash
npx shai-hulud-scan
```

### Global installation

```bash
npm install -g shai-hulud-scan
shai-hulud-scan
```

## Usage

### Basic scanning

```bash
# Scan current directory
shai-hulud-scan

# Scan specified directory
shai-hulud-scan /path/to/project
```

### Advanced options

```bash
# JSON format output
shai-hulud-scan --json

# List all scanned lock files
shai-hulud-scan --list-files

# List files in JSON format
shai-hulud-scan --list-files --json

# Specify directory and output JSON
shai-hulud-scan --dir ./src --json

# Show help information
shai-hulud-scan --help

# Show version information
shai-hulud-scan --version
```

## Output Format

### Standard output
```
❌ Found 3 packages affected by Shai-Hulud attack:

❌ ALERT: @ctrl/tinycolor@4.1.1 in /path/to/package-lock.json - Known risk
❌ ALERT: ngx-toastr@19.0.1 in /path/to/yarn.lock - Known risk
❌ ALERT: another-shai@1.0.1 in /path/to/pnpm-lock.yaml - Known risk
```

### JSON output
```json
[
  {
    "package": "@ctrl/tinycolor@4.1.1",
    "lockFile": "/path/to/package-lock.json",
    "severity": "high",
    "type": "shai-hulud-compromise"
  }
]
```

### List files output
```
Found 3 lock file(s):

📄 /path/to/package-lock.json (npm)
📄 /path/to/yarn.lock (yarn)
📄 /path/to/pnpm-lock.yaml (pnpm)
```

### List files JSON output
```json
[
  "/path/to/package-lock.json",
  "/path/to/yarn.lock",
  "/path/to/pnpm-lock.yaml"
]
```

## How it works

The tool recursively scans the following files in the specified directory:
- `package-lock.json` (npm) - Supports v1 and v2+ formats
- `yarn.lock` (Yarn) - Supports various yarn.lock formats
- `pnpm-lock.yaml` (pnpm) - Supports standard pnpm lock format

Checks for npm packages and versions that were compromised in the "Shai-Hulud" attack.

### Parsing capabilities

- ✅ **package-lock.json v1/v2+** - Full support for all npm lockfile versions
- ✅ **yarn.lock** - Supports standard yarn.lock format, including multi-package names and complex dependencies
- ✅ **pnpm-lock.yaml** - Supports standard pnpm lock format, including scoped packages
- ✅ **Zero-dependency parsing** - Uses custom parsers, no external YAML or JSON libraries required
- ✅ **Error handling** - Gracefully handles file parsing errors and permission issues

## Using in CI/CD

### GitHub Actions

```yaml
name: Shai-Hulud Security Scan

on:
  push:
    branches: [main]
  pull_request:

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Shai-Hulud Scan
        run: npx shai-hulud-scan
```


## License

MIT License

## Contributing

Issues and Pull Requests are welcome!