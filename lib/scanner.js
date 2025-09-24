const fs = require("fs");
const path = require("path");

class ShaiHuludScanner {
  constructor() {
    this.attackedPackages = this.loadAttackedPackages();
  }

  loadAttackedPackages() {
    const dataPath = path.join(__dirname, "../data/shai-hulud-attacked-list.txt");
    try {
      const content = fs.readFileSync(dataPath, "utf-8");
      return content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    } catch (error) {
      console.error("❌ Unable to load attacked packages list:", error.message);
      return [];
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
      const raw = fs.readFileSync(lockPath, "utf-8");
      const json = JSON.parse(raw);
      const found = {};
      
      // Support different package-lock.json versions
      const lockfileVersion = json.lockfileVersion || 1;
      
      if (lockfileVersion >= 2) {
        // package-lock.json v2+ format
        this.walkDepsV2(json.packages, found);
      } else {
        // package-lock.json v1 format
        this.walkDeps(json.dependencies, found);
      }
      
      return found;
    } catch (e) {
      console.error(`❌ Error parsing ${lockPath}:`, e.message);
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

  extractPackageNameFromPath(path) {
    if (!path || path === '') return null;
    
    // Remove leading node_modules/ or /
    let cleanPath = path.replace(/^\/?node_modules\//, '');
    
    // Handle scoped packages
    if (cleanPath.startsWith('@')) {
      const parts = cleanPath.split('/');
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
    } else {
      // Regular packages
      const parts = cleanPath.split('/');
      return parts[0];
    }
    
    return null;
  }

  checkYarnLock(lockPath) {
    try {
      const raw = fs.readFileSync(lockPath, "utf-8");
      const found = {};
      
      // Robust yarn.lock parsing
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
        // Format 1: "package@version:"
        // Format 2: package@version:
        // Format 3: "package@version", "package@version2":
        if (trimmed.endsWith(':') && !trimmed.startsWith(' ')) {
          // Extract package name from the line
          const packageName = this.extractPackageNameFromYarnLockLine(trimmed);
          if (packageName) {
            currentPackage = packageName;
            inPackageBlock = true;
            currentVersion = null;
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
    } catch (e) {
      console.error(`❌ Error parsing ${lockPath}:`, e.message);
      return {};
    }
  }

  extractPackageNameFromYarnLockLine(line) {
    // Remove trailing colon
    const cleanLine = line.replace(/:$/, '');
    
    // Handle quoted package names like "@ahmedhfarag/ngx-perfect-scrollbar@20.0.20"
    if (cleanLine.startsWith('"') && cleanLine.endsWith('"')) {
      const name = cleanLine.slice(1, -1); // Remove quotes
      if (name.includes('@')) {
        if (name.startsWith('@')) {
          // For @scope/package@version, extract @scope/package
          // Split by @ and rejoin first two parts with @
          const atIndex = name.indexOf('@', 1); // Find second @
          if (atIndex > 0) {
            return name.substring(0, atIndex);
          }
          return name; // fallback
        } else {
          // For package@version, extract package
          return name.split('@')[0];
        }
      }
    }
    
    // Handle unquoted package names like "lodash@4.17.21"
    if (cleanLine.includes('@')) {
      if (cleanLine.startsWith('@')) {
        // For @scope/package@version, extract @scope/package
        const atIndex = cleanLine.indexOf('@', 1); // Find second @
        if (atIndex > 0) {
          return cleanLine.substring(0, atIndex);
        }
        return cleanLine; // fallback
      } else {
        // For package@version, extract package
        return cleanLine.split('@')[0];
      }
    }
    
    return null;
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
      const raw = fs.readFileSync(lockPath, "utf-8");
      const found = {};
      
      // Robust YAML parsing, supports multiple formats
      const lines = raw.split('\n');
      let inPackages = false;
      let currentPackage = null;
      let currentVersion = null;
      let currentIndent = 0;
      
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
          currentIndent = 0;
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
          // Detect package name line (format: "/package@version:" or "/package@version@hash:")
          if (trimmed.endsWith(':') && trimmed.startsWith('/')) {
            const packagePath = trimmed.slice(1, -1); // Remove leading / and trailing :
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
    } catch (e) {
      console.error(`❌ Error parsing ${lockPath}:`, e.message);
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
      // Scoped package: @scope/package@version
      // Find the second @ to separate package name from version
      const secondAtIndex = packagePath.indexOf('@', 1);
      if (secondAtIndex > 0) {
        name = packagePath.substring(0, secondAtIndex);
        version = packagePath.substring(secondAtIndex + 1);
      } else {
        name = packagePath;
        version = null;
      }
    } else {
      // Regular package: package@version
      name = parts[0];
      version = parts[1];
    }
    
    return { name, version };
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
      if (!options.json) {
        console.log("⚠️ No package-lock.json, yarn.lock, or pnpm-lock.yaml found in current directory");
      }
      return { results: {}, total: 0 };
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

    return { results, total: totalFound };
  }

  formatOutput(scanResults, options = {}) {
    const { results, total } = scanResults;
    
    if (options.json) {
      const jsonResults = [];
      for (const [pkg, lockFiles] of Object.entries(results)) {
        for (const lockFile of lockFiles) {
          jsonResults.push({
            package: pkg,
            lockFile: lockFile,
            severity: "high",
            type: "shai-hulud-compromise"
          });
        }
      }
      return JSON.stringify(jsonResults, null, 2);
    }

    if (total === 0) {
      return "✅ No packages affected by Shai-Hulud attack found";
    }

    let output = `❌ Found ${total} packages affected by Shai-Hulud attack:\n\n`;
    
    for (const [pkg, lockFiles] of Object.entries(results)) {
      for (const lockFile of lockFiles) {
        const lockFileName = path.basename(lockFile);
        output += `❌ ALERT: ${pkg} in ${lockFile} - Known risk\n`;
      }
    }

    return output;
  }
}

module.exports = ShaiHuludScanner;
