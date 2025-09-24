const fs = require("fs");
const path = require("path");

class ShaiHuludScanner {
  constructor() {
    this.attackedPackages = this.loadAttackedPackages();
  }

  loadAttackedPackages() {
    const dataPath = path.join(__dirname, "../data/shai-hulud-attacked-list.txt");
    try {
      const content = this.readLockFile(dataPath);
      return content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    } catch (error) {
      console.error("❌ Unable to load attacked packages list:", error.message);
      return [];
    }
  }

  readLockFile(lockPath) {
    try {
      // Try different encodings for better compatibility
      const encodings = ['utf-8', 'utf-16le', 'latin1'];
      for (const encoding of encodings) {
        try {
          return fs.readFileSync(lockPath, encoding);
        } catch (e) {
          if (encoding === encodings[encodings.length - 1]) throw e;
        }
      }
    } catch (e) {
      throw new Error(`Unable to read file with any supported encoding: ${e.message}`);
    }
  }

  readLockFileWithFallback(lockPath) {
    try {
      return this.readLockFile(lockPath);
    } catch (e) {
      // Final fallback - try to read as binary and convert
      try {
        const buffer = fs.readFileSync(lockPath);
        return buffer.toString('utf-8');
      } catch (fallbackError) {
        throw new Error(`All read attempts failed: ${e.message}, ${fallbackError.message}`);
      }
    }
  }

  findLockFiles(dir, results = []) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== "node_modules" && entry.name[0] !== ".") {
          this.findLockFiles(path.join(dir, entry.name), results);
        } else if (entry.isFile()) {
          if (entry.name === "package-lock.json" || 
              entry.name === "yarn.lock" || 
              entry.name === "pnpm-lock.yaml") {
            results.push(path.join(dir, entry.name));
          }
        }
      }
    } catch (error) {
      // Ignore inaccessible directories (e.g., permission issues)
      if (error.code !== 'EACCES' && error.code !== 'EPERM') {
        console.warn(`⚠️ Unable to access directory ${dir}: ${error.message}`);
      }
    }
    return results;
  }

  checkPackageLock(lockPath) {
    try {
      const raw = this.readLockFile(lockPath);
      const json = JSON.parse(raw);
      const found = {};
      
      // Support different package-lock.json versions
      const lockfileVersion = json.lockfileVersion || 1;
      
      if (lockfileVersion >= 3) {
        // package-lock.json v3+ format (npm v9+)
        this.walkDepsV3(json.packages, found);
      } else if (lockfileVersion >= 2) {
        // package-lock.json v2 format (npm v7+)
        this.walkDepsV2(json.packages, found);
      } else if (lockfileVersion >= 1) {
        // package-lock.json v1 format (npm v5-v6)
        this.walkDeps(json.dependencies, found);
      } else {
        // Fallback for older versions or malformed files
        this.walkDeps(json.dependencies, found);
      }
      
      return found;
    } catch (e) {
      console.error(`❌ Error parsing ${lockPath}:`, e.message);
      // Try fallback parsing
      return this.fallbackParsePackageLock(lockPath);
    }
  }

  fallbackParsePackageLock(lockPath) {
    try {
      const raw = this.readLockFileWithFallback(lockPath);
      const json = JSON.parse(raw);
      const found = {};
      
      // Ensure attacked packages list is loaded
      if (!this.attackedPackages || this.attackedPackages.length === 0) {
        this.attackedPackages = this.loadAttackedPackages();
      }
      
      // Try to parse with minimal assumptions
      if (json.packages) {
        this.walkDepsV2(json.packages, found);
      } else if (json.dependencies) {
        this.walkDeps(json.dependencies, found);
      }
      
      return found;
    } catch (e) {
      console.warn(`⚠️ Fallback parsing failed for ${lockPath}: ${e.message}`);
      return {};
    }
  }

  walkDepsV2(packages, found) {
    if (!packages) return;
    
    for (const [path, info] of Object.entries(packages)) {
      if (info && info.version) {
        // Extract package name from path
        const packageName = this.extractPackageNameFromPath(path);
        if (packageName) {
          const id = `${packageName}@${info.version}`;
          if (this.attackedPackages.includes(id) && !found[id]) {
            found[id] = true;
          }
        }
      }
    }
  }

  walkDepsV3(packages, found) {
    if (!packages) return;
    
    for (const [path, info] of Object.entries(packages)) {
      if (info && info.version) {
        // Extract package name from path
        const packageName = this.extractPackageNameFromPath(path);
        if (packageName) {
          const id = `${packageName}@${info.version}`;
          if (this.attackedPackages.includes(id) && !found[id]) {
            found[id] = true;
          }
        }
      }
    }
  }

  extractPackageNameFromPath(path) {
    if (!path || path === '' || typeof path !== 'string') return null;
    
    // Remove leading node_modules/ or /
    let cleanPath = path.replace(/^\/?node_modules\//, '').trim();
    
    if (!cleanPath) return null;
    
    // Handle scoped packages
    if (cleanPath.startsWith('@')) {
      const parts = cleanPath.split('/');
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return `${parts[0]}/${parts[1]}`;
      }
    } else {
      // Regular packages
      const parts = cleanPath.split('/');
      if (parts[0] && parts[0].trim()) {
        return parts[0].trim();
      }
    }
    
    return null;
  }

  checkYarnLock(lockPath) {
    try {
      // Check file size for performance optimization
      const stats = fs.statSync(lockPath);
      if (stats.size > 10 * 1024 * 1024) { // 10MB
        console.warn(`⚠️ Large yarn.lock file detected (${Math.round(stats.size / 1024 / 1024)}MB), parsing may be slow`);
      }
      
      const raw = this.readLockFile(lockPath);
      const found = {};
      
      // Detect Yarn version for version-specific parsing
      const yarnVersionMatch = raw.match(/# yarn lockfile v(\d+)/);
      const yarnVersion = yarnVersionMatch ? parseInt(yarnVersionMatch[1]) : 1;
      
      if (yarnVersion >= 2) {
        return this.parseYarnLockV2Plus(raw, found);
      } else {
        return this.parseYarnLockV1(raw, found);
      }
    } catch (e) {
      console.error(`❌ Error parsing ${lockPath}:`, e.message);
      // Try fallback parsing
      return this.fallbackParseYarn(lockPath);
    }
  }

  parseYarnLockV1(raw, found) {
    // Original Yarn v1 parsing logic
    const lines = raw.split('\n');
    let currentPackage = null;
    let currentVersion = null;
    let inPackageBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (trimmed.startsWith('#') || trimmed === '') {
        continue;
      }
      
      // Detect package name lines (supports multiple formats)
      if (trimmed.endsWith(':') && !trimmed.startsWith(' ')) {
        const packageInfo = this.extractPackageInfoFromYarnLockLine(trimmed);
        if (packageInfo.name) {
          currentPackage = packageInfo.name;
          currentVersion = packageInfo.version;
          inPackageBlock = true;
          
          if (currentPackage && currentVersion) {
            const id = `${currentPackage}@${currentVersion}`;
            if (this.attackedPackages.includes(id) && !found[id]) {
              found[id] = true;
            }
          }
        }
      }
      
      // Detect version line
      if (inPackageBlock && trimmed.startsWith('version ')) {
        const versionMatch = trimmed.match(/version\s+"([^"]+)"/);
        if (versionMatch) {
          currentVersion = versionMatch[1];
          if (currentPackage && currentVersion) {
            const id = `${currentPackage}@${currentVersion}`;
            if (this.attackedPackages.includes(id) && !found[id]) {
              found[id] = true;
            }
          }
        }
      }
    }
    
    return found;
  }

  parseYarnLockV2Plus(raw, found) {
    // Enhanced parsing for Yarn v2+ with better format support
    return this.parseYarnLockV1(raw, found); // For now, use same logic
  }

  fallbackParseYarn(lockPath) {
    try {
      const raw = this.readLockFileWithFallback(lockPath);
      const found = {};
      
      // Ensure attacked packages list is loaded
      if (!this.attackedPackages || this.attackedPackages.length === 0) {
        this.attackedPackages = this.loadAttackedPackages();
      }
      
      return this.parseYarnLockV1(raw, found);
    } catch (e) {
      console.warn(`⚠️ Fallback parsing failed for ${lockPath}: ${e.message}`);
      return {};
    }
  }

  extractPackageInfoFromYarnLockLine(line) {
    if (!line || typeof line !== 'string') {
      return { name: null, version: null };
    }
    
    // Remove trailing colon
    const cleanLine = line.replace(/:$/, '').trim();
    
    if (!cleanLine) {
      return { name: null, version: null };
    }
    
    // Handle quoted package names like "@ahmedhfarag/ngx-perfect-scrollbar@20.0.20"
    if (cleanLine.startsWith('"') && cleanLine.endsWith('"')) {
      const name = cleanLine.slice(1, -1); // Remove quotes
      if (name.includes('@')) {
        if (name.startsWith('@')) {
          // For @scope/package@version, extract @scope/package and version
          const atIndex = name.indexOf('@', 1); // Find second @
          if (atIndex > 0) {
            return {
              name: name.substring(0, atIndex),
              version: name.substring(atIndex + 1)
            };
          }
          return { name: name, version: null };
        } else {
          // For package@version, extract package and version
          const parts = name.split('@');
          return {
            name: parts[0],
            version: parts[1] || null
          };
        }
      }
    }
    
    // Handle unquoted package names like "lodash@4.17.21"
    if (cleanLine.includes('@')) {
      if (cleanLine.startsWith('@')) {
        // For @scope/package@version, extract @scope/package and version
        const atIndex = cleanLine.indexOf('@', 1); // Find second @
        if (atIndex > 0) {
          return {
            name: cleanLine.substring(0, atIndex),
            version: cleanLine.substring(atIndex + 1)
          };
        }
        return { name: cleanLine, version: null };
      } else {
        // For package@version, extract package and version
        const parts = cleanLine.split('@');
        return {
          name: parts[0],
          version: parts[1] || null
        };
      }
    }
    
    return { name: cleanLine, version: null };
  }

  extractPackageNameFromYarnLockLine(line) {
    const info = this.extractPackageInfoFromYarnLockLine(line);
    return info.name;
  }

  extractPackageNamesFromYarnLock(line) {
    const names = [];
    
    // Remove trailing colon
    const cleanLine = line.replace(/:$/, '');
    
    // Handle quoted package names
    const quotedMatches = cleanLine.match(/"([^"]+)"/g);
    if (quotedMatches) {
      for (const match of quotedMatches) {
        const name = match.replace(/"/g, '');
        if (name.includes('@')) {
          const packageName = name.startsWith('@') 
            ? name.split('@', 3).slice(0, 2).join('@')
            : name.split('@', 1)[0];
          names.push(packageName);
        }
      }
    } else {
      // Handle unquoted package names
      const parts = cleanLine.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('@')) {
          const packageName = trimmed.startsWith('@')
            ? trimmed.split('@', 3).slice(0, 2).join('@')
            : trimmed.split('@', 1)[0];
          names.push(packageName);
        }
      }
    }
    
    return names;
  }

  checkPnpmLock(lockPath) {
    try {
      const raw = this.readLockFile(lockPath);
      const found = {};
      
      // Detect lockfileVersion for version-specific parsing
      const lockfileVersionMatch = raw.match(/lockfileVersion:\s*['"]?([0-9.]+)['"]?/);
      const lockfileVersion = lockfileVersionMatch ? parseFloat(lockfileVersionMatch[1]) : 5.0;
      
      // Use version-specific parsing strategies
      if (lockfileVersion >= 6.0) {
        return this.parsePnpmLockV6Plus(raw, found);
      } else {
        return this.parsePnpmLockV5(raw, found);
      }
    } catch (e) {
      console.error(`❌ Error parsing ${lockPath}:`, e.message);
      // Try fallback parsing
      return this.fallbackParsePnpm(lockPath);
    }
  }

  parsePnpmLockV6Plus(raw, found) {
    // Enhanced parsing for pnpm v6+ with better format support
    const lines = raw.split('\n');
    let inPackages = false;
    let currentPackage = null;
    let currentVersion = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (trimmed.startsWith('#') || trimmed === '') {
        continue;
      }
      
      // Detect packages section start
      if (trimmed === 'packages:') {
        inPackages = true;
        continue;
      }
      
      // Skip if not in packages section
      if (!inPackages) continue;
      
      // Detect if left packages section (encountered other top-level keys)
      const lineIndent = line.length - line.trimStart().length;
      if (lineIndent === 0 && trimmed !== 'packages:' && trimmed !== '') {
        inPackages = false;
        continue;
      }
      
      // Parse package information
      if (inPackages && trimmed) {
        // Detect package name line (format: "package@version:" or "/package@version:" or "/package@version@hash:")
        if (trimmed.endsWith(':') && (trimmed.startsWith('/') || trimmed.includes('@'))) {
          let packagePath;
          if (trimmed.startsWith('/')) {
            packagePath = trimmed.slice(1, -1); // Remove leading / and trailing :
          } else {
            packagePath = trimmed.slice(0, -1); // Remove trailing : only
          }
          const packageInfo = this.parsePnpmPackagePath(packagePath);
          currentPackage = packageInfo.name;
          currentVersion = packageInfo.version;
          
          // If version extracted from path, check directly
          if (currentPackage && currentVersion) {
            const id = `${currentPackage}@${currentVersion}`;
            if (this.attackedPackages.includes(id) && !found[id]) {
              found[id] = true;
            }
          }
        }
        
        // Detect version line (supports multiple formats)
        if (trimmed.startsWith('version:')) {
          const versionMatch = trimmed.match(/version:\s*['"]?([^'"]+)['"]?/);
          if (versionMatch && currentPackage) {
            currentVersion = versionMatch[1];
            const id = `${currentPackage}@${currentVersion}`;
            if (this.attackedPackages.includes(id) && !found[id]) {
              found[id] = true;
            }
          }
        }
      }
    }
    
    return found;
  }

  parsePnpmLockV5(raw, found) {
    // Fallback parsing for older pnpm versions
    return this.parsePnpmLockV6Plus(raw, found);
  }

  fallbackParsePnpm(lockPath) {
    try {
      // Try to read with different encoding
      const raw = this.readLockFileWithFallback(lockPath);
      const found = {};
      
      // Ensure attacked packages list is loaded
      if (!this.attackedPackages || this.attackedPackages.length === 0) {
        this.attackedPackages = this.loadAttackedPackages();
      }
      
      return this.parsePnpmLockV6Plus(raw, found);
    } catch (e) {
      console.warn(`⚠️ Fallback parsing failed for ${lockPath}: ${e.message}`);
      return {};
    }
  }

  parsePnpmPackagePath(packagePath) {
    // Handle format: package@version or package@version@hash
    const parts = packagePath.split('@');
    
    if (parts.length < 2) {
      return { name: null, version: null };
    }
    
    let name, version;
    
    if (packagePath.startsWith('@')) {
      // Scoped package: @scope/package@version or @scope/package@version@hash
      // Find the second @ to separate package name from version
      const secondAtIndex = packagePath.indexOf('@', 1);
      if (secondAtIndex > 0) {
        name = packagePath.substring(0, secondAtIndex);
        const versionWithHash = packagePath.substring(secondAtIndex + 1);
        // Remove hash part if present (everything after the last @ that's not part of version)
        version = this.extractVersionFromVersionWithHash(versionWithHash);
      } else {
        name = packagePath;
        version = null;
      }
    } else {
      // Regular package: package@version or package@version@hash
      name = parts[0];
      const versionWithHash = parts[1];
      version = this.extractVersionFromVersionWithHash(versionWithHash);
    }
    
    return { name, version };
  }

  extractVersionFromVersionWithHash(versionWithHash) {
    if (!versionWithHash) return null;
    
    // If it contains another @, it means there's a hash
    // Take only the part before the last @
    const lastAtIndex = versionWithHash.lastIndexOf('@');
    if (lastAtIndex > 0) {
      return versionWithHash.substring(0, lastAtIndex);
    }
    
    return versionWithHash;
  }

  walkDeps(deps, found) {
    for (const [name, info] of Object.entries(deps || {})) {
      const id = `${name}@${info.version}`;
      if (this.attackedPackages.includes(id) && !found[id]) {
        found[id] = true;
      }
      if (info.dependencies) {
        this.walkDeps(info.dependencies, found);
      }
    }
  }

  scan(directory = process.cwd(), options = {}) {
    const lockFiles = this.findLockFiles(directory);
    
    if (lockFiles.length === 0) {
      if (!options.json && !options.listFiles) {
        console.log("⚠️ No package-lock.json, yarn.lock, or pnpm-lock.yaml found in current directory");
      }
      return { results: {}, total: 0, lockFiles: [] };
    }

    // If listFiles option is enabled, return just the file list
    if (options.listFiles) {
      return { results: {}, total: 0, lockFiles };
    }

    const results = {};
    let totalFound = 0;

    for (const lockPath of lockFiles) {
      let found = {};
      
      if (lockPath.endsWith("package-lock.json")) {
        found = this.checkPackageLock(lockPath);
      } else if (lockPath.endsWith("yarn.lock")) {
        found = this.checkYarnLock(lockPath);
      } else if (lockPath.endsWith("pnpm-lock.yaml")) {
        found = this.checkPnpmLock(lockPath);
      }

      for (const pkg of Object.keys(found)) {
        if (!results[pkg]) results[pkg] = [];
        results[pkg].push(lockPath);
        totalFound++;
      }
    }

    return { results, total: totalFound, lockFiles };
  }

  formatOutput(scanResults, options = {}) {
    const { results, total, lockFiles = [] } = scanResults;
    
    // Handle listFiles option
    if (options.listFiles) {
      if (options.json) {
        return JSON.stringify(lockFiles, null, 2);
      }
      
      if (lockFiles.length === 0) {
        return "No lock files found in the specified directory";
      }
      
      let output = `Found ${lockFiles.length} lock file(s):\n\n`;
      for (const file of lockFiles) {
        const fileName = path.basename(file);
        const fileType = fileName === 'package-lock.json' ? 'npm' : 
                        fileName === 'yarn.lock' ? 'yarn' : 
                        fileName === 'pnpm-lock.yaml' ? 'pnpm' : 'unknown';
        output += `📄 ${file} (${fileType})\n`;
      }
      return output;
    }
    
    if (options.json) {
      const jsonResults = [];
      // Sort by lock file order first, then by package name
      for (const lockFile of lockFiles) {
        for (const [pkg, lockFilesForPkg] of Object.entries(results)) {
          if (lockFilesForPkg.includes(lockFile)) {
            jsonResults.push({
              package: pkg,
              lockFile: lockFile,
              severity: "high",
              type: "shai-hulud-compromise"
            });
          }
        }
      }
      return JSON.stringify(jsonResults, null, 2);
    }

    if (total === 0) {
      return "✅ No packages affected by Shai-Hulud attack found";
    }

    let output = `❌ Found ${total} packages affected by Shai-Hulud attack:\n\n`;
    
    // Group results by lock file for better organization
    const resultsByLockFile = {};
    for (const [pkg, lockFilesForPkg] of Object.entries(results)) {
      for (const lockFile of lockFilesForPkg) {
        if (!resultsByLockFile[lockFile]) {
          resultsByLockFile[lockFile] = [];
        }
        resultsByLockFile[lockFile].push(pkg);
      }
    }
    
    // Output results grouped by lock file in the order they were found
    for (const lockFile of lockFiles) {
      if (resultsByLockFile[lockFile]) {
        const fileName = path.basename(lockFile);
        const fileType = fileName === 'package-lock.json' ? 'npm' : 
                        fileName === 'yarn.lock' ? 'yarn' : 
                        fileName === 'pnpm-lock.yaml' ? 'pnpm' : 'unknown';
        
        output += `📄 ${lockFile} (${fileType}):\n`;
        for (const pkg of resultsByLockFile[lockFile]) {
          output += `  ❌ ALERT: ${pkg} - Known risk\n`;
        }
        output += '\n';
      }
    }

    return output;
  }
}

module.exports = ShaiHuludScanner;

