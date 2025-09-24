const fs = require('fs');
const path = require('path');
const ShaiHuludScanner = require('../lib/scanner');

// Mock fs module
jest.mock('fs');

describe('ShaiHuludScanner', () => {
  let scanner;
  const mockAttackedList = [
    '@ahmedhfarag/ngx-perfect-scrollbar@20.0.20',
    '@art-ws/common@2.0.28',
    'lodash@4.17.21',
    '@babel/core@7.16.7',
    'base64-js@1.5.1'
  ];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock attacked packages list loading
    fs.readFileSync.mockImplementation((filePath, encoding) => {
      if (filePath.includes('shai-hulud-attacked-list.txt')) {
        return mockAttackedList.join('\n');
      }
      throw new Error('File not found');
    });

    scanner = new ShaiHuludScanner();
  });

  describe('constructor and initialization', () => {
    test('should load attacked packages list on initialization', () => {
      expect(scanner.attackedPackages).toEqual(mockAttackedList);
    });

    test('should handle missing attacked packages file gracefully', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const newScanner = new ShaiHuludScanner();
      
      expect(newScanner.attackedPackages).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unable to load attacked packages list'),
        expect.any(String)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('findLockFiles', () => {
    test('should find all lock files in directory', () => {
      const mockDir = '/test/project';
      const mockEntries = [
        { name: 'package-lock.json', isDirectory: () => false, isFile: () => true },
        { name: 'yarn.lock', isDirectory: () => false, isFile: () => true },
        { name: 'pnpm-lock.yaml', isDirectory: () => false, isFile: () => true },
        { name: 'package.json', isDirectory: () => false, isFile: () => true },
        { name: 'node_modules', isDirectory: () => true, isFile: () => false },
        { name: '.git', isDirectory: () => true, isFile: () => false }
      ];

      fs.readdirSync.mockReturnValue(mockEntries);

      const result = scanner.findLockFiles(mockDir);
      
      expect(result).toEqual([
        path.join('/test/project', 'package-lock.json'),
        path.join('/test/project', 'yarn.lock'),
        path.join('/test/project', 'pnpm-lock.yaml')
      ]);
    });

    test('should recursively search subdirectories', () => {
      const mockDir = '/test/project';
      const mockSubDir = '/test/project/src';
      
      fs.readdirSync
        .mockReturnValueOnce([
          { name: 'src', isDirectory: () => true, isFile: () => false },
          { name: 'package.json', isDirectory: () => false, isFile: () => true }
        ])
        .mockReturnValueOnce([
          { name: 'package-lock.json', isDirectory: () => false, isFile: () => true }
        ]);

      const result = scanner.findLockFiles(mockDir);
      
      expect(result).toEqual([path.join('/test/project/src', 'package-lock.json')]);
    });

    test('should skip node_modules and hidden directories', () => {
      const mockDir = '/test/project';
      const mockEntries = [
        { name: 'node_modules', isDirectory: () => true, isFile: () => false },
        { name: '.git', isDirectory: () => true, isFile: () => false },
        { name: '.hidden', isDirectory: () => true, isFile: () => false },
        { name: 'package-lock.json', isDirectory: () => false, isFile: () => true }
      ];

      fs.readdirSync.mockReturnValue(mockEntries);

      const result = scanner.findLockFiles(mockDir);
      
      expect(result).toEqual([path.join('/test/project', 'package-lock.json')]);
    });

    test('should handle permission errors gracefully', () => {
      const mockDir = '/test/project';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      fs.readdirSync.mockImplementation((dir) => {
        if (dir === '/test/project') {
          throw { code: 'EACCES', message: 'Permission denied' };
        }
        return [];
      });

      const result = scanner.findLockFiles(mockDir);
      
      expect(result).toEqual([]);
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should warn on non-permission errors', () => {
      const mockDir = '/test/project';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      fs.readdirSync.mockImplementation(() => {
        throw { code: 'ENOENT', message: 'Directory not found' };
      });

      const result = scanner.findLockFiles(mockDir);
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unable to access directory')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('extractPackageNameFromPath', () => {
    test('should extract regular package names', () => {
      expect(scanner.extractPackageNameFromPath('lodash')).toBe('lodash');
      expect(scanner.extractPackageNameFromPath('node_modules/lodash')).toBe('lodash');
      expect(scanner.extractPackageNameFromPath('/node_modules/lodash')).toBe('lodash');
    });

    test('should extract scoped package names', () => {
      expect(scanner.extractPackageNameFromPath('@scope/package')).toBe('@scope/package');
      expect(scanner.extractPackageNameFromPath('node_modules/@scope/package')).toBe('@scope/package');
      expect(scanner.extractPackageNameFromPath('/node_modules/@scope/package')).toBe('@scope/package');
    });

    test('should handle edge cases', () => {
      expect(scanner.extractPackageNameFromPath('')).toBe(null);
      expect(scanner.extractPackageNameFromPath(null)).toBe(null);
      expect(scanner.extractPackageNameFromPath(undefined)).toBe(null);
      expect(scanner.extractPackageNameFromPath('@')).toBe(null);
      expect(scanner.extractPackageNameFromPath('@scope')).toBe(null);
      expect(scanner.extractPackageNameFromPath('   ')).toBe(null);
      expect(scanner.extractPackageNameFromPath('@/')).toBe(null);
    });

    test('should handle whitespace and trim properly', () => {
      expect(scanner.extractPackageNameFromPath('  lodash  ')).toBe('lodash');
      expect(scanner.extractPackageNameFromPath('  @scope/package  ')).toBe('@scope/package');
    });
  });

  describe('extractPackageInfoFromYarnLockLine', () => {
    test('should extract package info from quoted lines', () => {
      const result = scanner.extractPackageInfoFromYarnLockLine('"@ahmedhfarag/ngx-perfect-scrollbar@20.0.20":');
      expect(result).toEqual({ name: '@ahmedhfarag/ngx-perfect-scrollbar', version: '20.0.20' });
    });

    test('should extract package info from unquoted lines', () => {
      const result = scanner.extractPackageInfoFromYarnLockLine('lodash@4.17.21:');
      expect(result).toEqual({ name: 'lodash', version: '4.17.21' });
    });

    test('should handle scoped packages', () => {
      const result = scanner.extractPackageInfoFromYarnLockLine('@scope/package@1.0.0:');
      expect(result).toEqual({ name: '@scope/package', version: '1.0.0' });
    });

    test('should handle lines without version', () => {
      const result = scanner.extractPackageInfoFromYarnLockLine('lodash:');
      expect(result).toEqual({ name: 'lodash', version: null });
    });

    test('should handle edge cases', () => {
      expect(scanner.extractPackageInfoFromYarnLockLine('')).toEqual({ name: null, version: null });
      expect(scanner.extractPackageInfoFromYarnLockLine(null)).toEqual({ name: null, version: null });
      expect(scanner.extractPackageInfoFromYarnLockLine(undefined)).toEqual({ name: null, version: null });
      expect(scanner.extractPackageInfoFromYarnLockLine('   ')).toEqual({ name: null, version: null });
    });
  });

  describe('extractPackageNamesFromYarnLock', () => {
    test('should extract quoted package names', () => {
      const line = '"@ahmedhfarag/ngx-perfect-scrollbar@20.0.20":';
      const result = scanner.extractPackageNamesFromYarnLock(line);
      expect(result).toEqual(['@ahmedhfarag/ngx-perfect-scrollbar']);
    });

    test('should extract unquoted package names', () => {
      const line = 'lodash@4.17.21:';
      const result = scanner.extractPackageNamesFromYarnLock(line);
      expect(result).toEqual(['lodash']);
    });

    test('should handle multiple package names', () => {
      const line = '"package1@1.0.0", "package2@2.0.0":';
      const result = scanner.extractPackageNamesFromYarnLock(line);
      expect(result).toEqual(['package1', 'package2']);
    });

    test('should handle scoped packages', () => {
      const line = '"@scope/package@1.0.0":';
      const result = scanner.extractPackageNamesFromYarnLock(line);
      expect(result).toEqual(['@scope/package']);
    });
  });

  describe('parsePnpmPackagePath', () => {
    test('should parse regular packages', () => {
      const result = scanner.parsePnpmPackagePath('lodash@4.17.21');
      expect(result).toEqual({ name: 'lodash', version: '4.17.21' });
    });

    test('should parse scoped packages', () => {
      const result = scanner.parsePnpmPackagePath('@scope/package@1.0.0');
      expect(result).toEqual({ name: '@scope/package', version: '1.0.0' });
    });

    test('should handle packages with hash', () => {
      const result = scanner.parsePnpmPackagePath('lodash@4.17.21@hash123');
      expect(result).toEqual({ name: 'lodash', version: '4.17.21' });
    });

    test('should handle scoped packages with hash', () => {
      const result = scanner.parsePnpmPackagePath('@babel/core@7.16.7@hash456');
      expect(result).toEqual({ name: '@babel/core', version: '7.16.7' });
    });

    test('should handle edge cases', () => {
      expect(scanner.parsePnpmPackagePath('invalid')).toEqual({ name: null, version: null });
      expect(scanner.parsePnpmPackagePath('')).toEqual({ name: null, version: null });
      expect(scanner.parsePnpmPackagePath('@')).toEqual({ name: '@', version: null });
      expect(scanner.parsePnpmPackagePath('package@')).toEqual({ name: 'package', version: null });
    });
  });

  describe('extractVersionFromVersionWithHash', () => {
    test('should extract version from version with hash', () => {
      expect(scanner.extractVersionFromVersionWithHash('4.17.21@hash123')).toBe('4.17.21');
      expect(scanner.extractVersionFromVersionWithHash('1.0.0@abc123')).toBe('1.0.0');
    });

    test('should return version as-is when no hash', () => {
      expect(scanner.extractVersionFromVersionWithHash('4.17.21')).toBe('4.17.21');
      expect(scanner.extractVersionFromVersionWithHash('1.0.0')).toBe('1.0.0');
    });

    test('should handle edge cases', () => {
      expect(scanner.extractVersionFromVersionWithHash('')).toBe(null);
      expect(scanner.extractVersionFromVersionWithHash(null)).toBe(null);
      expect(scanner.extractVersionFromVersionWithHash(undefined)).toBe(null);
    });
  });

  describe('checkPackageLock', () => {
    test('should handle package-lock.json v1 format', () => {
      const mockLockData = {
        lockfileVersion: 1,
        dependencies: {
          'lodash': {
            version: '4.17.21',
            dependencies: {
              'base64-js': { version: '1.5.1' }
            }
          }
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(mockLockData));

      const result = scanner.checkPackageLock('/path/to/package-lock.json');

      expect(result).toEqual({
        'lodash@4.17.21': true,
        'base64-js@1.5.1': true
      });
    });

    test('should handle package-lock.json v2 format', () => {
      const mockLockData = {
        lockfileVersion: 2,
        packages: {
          '': { name: 'test-project', version: '1.0.0' },
          'node_modules/lodash': { version: '4.17.21' },
          'node_modules/@babel/core': { version: '7.16.7' }
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(mockLockData));

      const result = scanner.checkPackageLock('/path/to/package-lock.json');

      expect(result).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });

    test('should handle package-lock.json v3 format', () => {
      const mockLockData = {
        lockfileVersion: 3,
        packages: {
          '': { name: 'test-project', version: '1.0.0' },
          'node_modules/lodash': { version: '4.17.21' },
          'node_modules/@babel/core': { version: '7.16.7' }
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(mockLockData));

      const result = scanner.checkPackageLock('/path/to/package-lock.json');

      expect(result).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });

    test('should handle invalid JSON gracefully', () => {
      fs.readFileSync.mockReturnValue('invalid json');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = scanner.checkPackageLock('/path/to/package-lock.json');

      expect(result).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing'),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('checkYarnLock', () => {
    test('should parse yarn.lock with version in package name line', () => {
      const mockYarnLock = `
# yarn lockfile v1

lodash@4.17.21:
  version "4.17.21"
  resolved "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz"

"@babel/core@7.16.7":
  version "7.16.7"
  resolved "https://registry.npmjs.org/@babel/core/-/core-7.16.7.tgz"
`;

      fs.readFileSync.mockReturnValue(mockYarnLock);

      const result = scanner.checkYarnLock('/path/to/yarn.lock');

      expect(result).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });

    test('should parse yarn.lock with version in version line', () => {
      const mockYarnLock = `
# yarn lockfile v1

lodash:
  version "4.17.21"
  resolved "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz"

@babel/core:
  version "7.16.7"
  resolved "https://registry.npmjs.org/@babel/core/-/core-7.16.7.tgz"
`;

      fs.readFileSync.mockReturnValue(mockYarnLock);

      const result = scanner.checkYarnLock('/path/to/yarn.lock');

      expect(result).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });

    test('should handle multiple version ranges', () => {
      const mockYarnLock = `
# yarn lockfile v1

"lodash@^4.17.0", "lodash@^4.17.21":
  version "4.17.21"
  resolved "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz"
`;

      fs.readFileSync.mockReturnValue(mockYarnLock);

      const result = scanner.checkYarnLock('/path/to/yarn.lock');

      expect(result).toEqual({
        'lodash@4.17.21': true
      });
    });
  });

  describe('checkPnpmLock', () => {
    test('should parse pnpm-lock.yaml with standard format', () => {
      const mockPnpmLock = `
lockfileVersion: '9.0'

packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-...}
  
  @babel/core@7.16.7:
    resolution: {integrity: sha512-...}
`;

      fs.readFileSync.mockReturnValue(mockPnpmLock);

      const result = scanner.checkPnpmLock('/path/to/pnpm-lock.yaml');

      expect(result).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });

    test('should parse pnpm-lock.yaml with hash format', () => {
      const mockPnpmLock = `
lockfileVersion: '9.0'

packages:
  lodash@4.17.21@hash123:
    resolution: {integrity: sha512-...}
  
  @babel/core@7.16.7@hash456:
    resolution: {integrity: sha512-...}
`;

      fs.readFileSync.mockReturnValue(mockPnpmLock);

      const result = scanner.checkPnpmLock('/path/to/pnpm-lock.yaml');

      expect(result).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });

    test('should parse pnpm-lock.yaml with version field', () => {
      const mockPnpmLock = `
lockfileVersion: '9.0'

packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-...}
  
  @babel/core@7.16.7:
    resolution: {integrity: sha512-...}
`;

      fs.readFileSync.mockReturnValue(mockPnpmLock);

      const result = scanner.checkPnpmLock('/path/to/pnpm-lock.yaml');

      expect(result).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });
  });

  describe('formatOutput', () => {
    test('should format JSON output correctly', () => {
      const scanResults = {
        results: {
          '@ahmedhfarag/ngx-perfect-scrollbar@20.0.20': ['/path/to/package-lock.json']
        },
        total: 1,
        lockFiles: ['/path/to/package-lock.json']
      };
      const options = { json: true };

      const result = scanner.formatOutput(scanResults, options);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual([{
        package: '@ahmedhfarag/ngx-perfect-scrollbar@20.0.20',
        lockFile: '/path/to/package-lock.json',
        severity: 'high',
        type: 'shai-hulud-compromise'
      }]);
    });

    test('should format text output correctly', () => {
      const scanResults = {
        results: {
          '@ahmedhfarag/ngx-perfect-scrollbar@20.0.20': ['/path/to/package-lock.json']
        },
        total: 1,
        lockFiles: ['/path/to/package-lock.json']
      };
      const options = { json: false };

      const result = scanner.formatOutput(scanResults, options);

      expect(result).toContain('Found 1 packages affected');
      expect(result).toContain('@ahmedhfarag/ngx-perfect-scrollbar@20.0.20');
      expect(result).toContain('/path/to/package-lock.json');
    });

    test('should group results by lock file in order', () => {
      const scanResults = {
        results: {
          'lodash@4.17.21': ['/path/to/package-lock.json', '/path/to/yarn.lock'],
          '@babel/core@7.16.7': ['/path/to/yarn.lock'],
          'base64-js@1.5.1': ['/path/to/pnpm-lock.yaml']
        },
        total: 4,
        lockFiles: ['/path/to/package-lock.json', '/path/to/yarn.lock', '/path/to/pnpm-lock.yaml']
      };
      const options = { json: false };

      const result = scanner.formatOutput(scanResults, options);

      // Check that results are grouped by lock file
      expect(result).toContain('📄 /path/to/package-lock.json (npm):');
      expect(result).toContain('📄 /path/to/yarn.lock (yarn):');
      expect(result).toContain('📄 /path/to/pnpm-lock.yaml (pnpm):');
      
      // Check that packages are listed under their respective lock files
      const lines = result.split('\n');
      const packageLockIndex = lines.findIndex(line => line.includes('package-lock.json'));
      const yarnLockIndex = lines.findIndex(line => line.includes('yarn.lock'));
      const pnpmLockIndex = lines.findIndex(line => line.includes('pnpm-lock.yaml'));
      
      expect(packageLockIndex).toBeLessThan(yarnLockIndex);
      expect(yarnLockIndex).toBeLessThan(pnpmLockIndex);
    });

    test('should sort JSON output by lock file order', () => {
      const scanResults = {
        results: {
          'lodash@4.17.21': ['/path/to/package-lock.json', '/path/to/yarn.lock'],
          '@babel/core@7.16.7': ['/path/to/yarn.lock']
        },
        total: 3,
        lockFiles: ['/path/to/package-lock.json', '/path/to/yarn.lock']
      };
      const options = { json: true };

      const result = scanner.formatOutput(scanResults, options);
      const parsed = JSON.parse(result);

      // Check that results are ordered by lock file
      expect(parsed[0].lockFile).toBe('/path/to/package-lock.json');
      expect(parsed[0].package).toBe('lodash@4.17.21');
      expect(parsed[1].lockFile).toBe('/path/to/yarn.lock');
      expect(parsed[1].package).toBe('lodash@4.17.21');
      expect(parsed[2].lockFile).toBe('/path/to/yarn.lock');
      expect(parsed[2].package).toBe('@babel/core@7.16.7');
    });

    test('should show success message when no issues found', () => {
      const scanResults = { results: {}, total: 0, lockFiles: [] };
      const options = { json: false };

      const result = scanner.formatOutput(scanResults, options);

      expect(result).toBe('✅ No packages affected by Shai-Hulud attack found');
    });

    test('should format listFiles output correctly', () => {
      const scanResults = {
        results: {},
        total: 0,
        lockFiles: [
          '/path/to/package-lock.json',
          '/path/to/yarn.lock',
          '/path/to/pnpm-lock.yaml'
        ]
      };
      const options = { listFiles: true, json: false };

      const result = scanner.formatOutput(scanResults, options);

      expect(result).toContain('Found 3 lock file(s)');
      expect(result).toContain('📄 /path/to/package-lock.json (npm)');
      expect(result).toContain('📄 /path/to/yarn.lock (yarn)');
      expect(result).toContain('📄 /path/to/pnpm-lock.yaml (pnpm)');
    });

    test('should format listFiles JSON output correctly', () => {
      const scanResults = {
        results: {},
        total: 0,
        lockFiles: [
          '/path/to/package-lock.json',
          '/path/to/yarn.lock'
        ]
      };
      const options = { listFiles: true, json: true };

      const result = scanner.formatOutput(scanResults, options);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual([
        '/path/to/package-lock.json',
        '/path/to/yarn.lock'
      ]);
    });

    test('should show no files message when no lock files found', () => {
      const scanResults = {
        results: {},
        total: 0,
        lockFiles: []
      };
      const options = { listFiles: true, json: false };

      const result = scanner.formatOutput(scanResults, options);

      expect(result).toBe('No lock files found in the specified directory');
    });
  });

  describe('scan integration', () => {
    test('should scan all lock file types', () => {
      const mockDir = '/test/project';
      const mockEntries = [
        { name: 'package-lock.json', isDirectory: () => false, isFile: () => true },
        { name: 'yarn.lock', isDirectory: () => false, isFile: () => true },
        { name: 'pnpm-lock.yaml', isDirectory: () => false, isFile: () => true }
      ];

      fs.readdirSync.mockReturnValue(mockEntries);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('package-lock.json')) {
          return JSON.stringify({
            lockfileVersion: 2,
            packages: {
              'node_modules/lodash': { version: '4.17.21' }
            }
          });
        } else if (filePath.includes('yarn.lock')) {
          return 'lodash@4.17.21:\n  version "4.17.21"';
        } else if (filePath.includes('pnpm-lock.yaml')) {
          return 'packages:\n  lodash@4.17.21:\n    resolution: {integrity: sha512-...}';
        }
        return '';
      });

      const result = scanner.scan(mockDir);

      expect(result.total).toBe(3); // lodash appears in all three files
      expect(result.lockFiles).toHaveLength(3);
      expect(result.results['lodash@4.17.21']).toHaveLength(3);
    });

    test('should handle no lock files found', () => {
      const mockDir = '/test/project';
      const mockEntries = [
        { name: 'package.json', isDirectory: () => false, isFile: () => true }
      ];

      fs.readdirSync.mockReturnValue(mockEntries);

      const result = scanner.scan(mockDir);

      expect(result.total).toBe(0);
      expect(result.lockFiles).toHaveLength(0);
      expect(result.results).toEqual({});
    });

    test('should handle listFiles option', () => {
      const mockDir = '/test/project';
      const mockEntries = [
        { name: 'package-lock.json', isDirectory: () => false, isFile: () => true },
        { name: 'yarn.lock', isDirectory: () => false, isFile: () => true }
      ];

      fs.readdirSync.mockReturnValue(mockEntries);

      const result = scanner.scan(mockDir, { listFiles: true });

      expect(result.total).toBe(0);
      expect(result.results).toEqual({});
      expect(result.lockFiles).toHaveLength(2);
    });
  });

  describe('walkDeps methods', () => {
    test('walkDeps should handle nested dependencies', () => {
      const deps = {
        'lodash': {
          version: '4.17.21',
          dependencies: {
            'base64-js': { version: '1.5.1' }
          }
        }
      };
      const found = {};

      scanner.walkDeps(deps, found);

      expect(found).toEqual({
        'lodash@4.17.21': true,
        'base64-js@1.5.1': true
      });
    });

    test('walkDepsV2 should handle packages object', () => {
      const packages = {
        'node_modules/lodash': { version: '4.17.21' },
        'node_modules/@babel/core': { version: '7.16.7' }
      };
      const found = {};

      scanner.walkDepsV2(packages, found);

      expect(found).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });

    test('walkDepsV3 should handle packages object', () => {
      const packages = {
        'node_modules/lodash': { version: '4.17.21' },
        'node_modules/@babel/core': { version: '7.16.7' }
      };
      const found = {};

      scanner.walkDepsV3(packages, found);

      expect(found).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });
  });

  describe('Enhanced Compatibility Features', () => {
    test('readLockFile should handle different encodings', () => {
      const mockContent = 'test content';
      fs.readFileSync.mockImplementation((filePath, encoding) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        if (encoding === 'utf-8') {
          return mockContent;
        }
        throw new Error('Encoding not supported');
      });

      const result = scanner.readLockFile('/test/file.txt');
      expect(result).toBe(mockContent);
    });

    test('readLockFileWithFallback should handle encoding failures', () => {
      const mockBuffer = Buffer.from('fallback content');
      fs.readFileSync.mockImplementation((filePath, encoding) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        if (encoding) {
          throw new Error('All encodings failed');
        }
        return mockBuffer;
      });

      const result = scanner.readLockFileWithFallback('/test/file.txt');
      expect(result).toBe('fallback content');
    });

    test('fallbackParsePackageLock should handle malformed JSON', () => {
      fs.readFileSync
        .mockImplementationOnce((filePath) => {
          if (filePath.includes('shai-hulud-attacked-list.txt')) {
            return mockAttackedList.join('\n');
          }
          throw new Error('Invalid JSON');
        })
        .mockImplementationOnce((filePath) => {
          if (filePath.includes('shai-hulud-attacked-list.txt')) {
            return mockAttackedList.join('\n');
          }
          return JSON.stringify({
            packages: {
              'node_modules/lodash': { version: '4.17.21' }
            }
          });
        });

      const result = scanner.fallbackParsePackageLock('/path/to/package-lock.json');
      expect(result).toEqual({
        'lodash@4.17.21': true
      });
    });

    test('fallbackParseYarn should handle parsing failures', () => {
      fs.readFileSync
        .mockImplementationOnce((filePath) => {
          if (filePath.includes('shai-hulud-attacked-list.txt')) {
            return mockAttackedList.join('\n');
          }
          throw new Error('Invalid file');
        })
        .mockImplementationOnce((filePath) => {
          if (filePath.includes('shai-hulud-attacked-list.txt')) {
            return mockAttackedList.join('\n');
          }
          return 'lodash@4.17.21:\n  version "4.17.21"';
        });

      const result = scanner.fallbackParseYarn('/path/to/yarn.lock');
      expect(result).toEqual({
        'lodash@4.17.21': true
      });
    });

    test('fallbackParsePnpm should handle parsing failures', () => {
      fs.readFileSync
        .mockImplementationOnce((filePath) => {
          if (filePath.includes('shai-hulud-attacked-list.txt')) {
            return mockAttackedList.join('\n');
          }
          throw new Error('Invalid YAML');
        })
        .mockImplementationOnce((filePath) => {
          if (filePath.includes('shai-hulud-attacked-list.txt')) {
            return mockAttackedList.join('\n');
          }
          return 'packages:\n  lodash@4.17.21:\n    resolution: {integrity: sha512-...}';
        });

      const result = scanner.fallbackParsePnpm('/path/to/pnpm-lock.yaml');
      expect(result).toEqual({
        'lodash@4.17.21': true
      });
    });

    test('parseYarnLockV1 should handle Yarn v1 format', () => {
      const mockYarnLock = `# yarn lockfile v1

lodash@4.17.21:
  version "4.17.21"`;

      const result = scanner.parseYarnLockV1(mockYarnLock, {});
      expect(result).toEqual({
        'lodash@4.17.21': true
      });
    });

    test('parseYarnLockV2Plus should handle Yarn v2+ format', () => {
      const mockYarnLock = `# yarn lockfile v2

lodash@4.17.21:
  version "4.17.21"`;

      const result = scanner.parseYarnLockV2Plus(mockYarnLock, {});
      expect(result).toEqual({
        'lodash@4.17.21': true
      });
    });

    test('parsePnpmLockV6Plus should handle pnpm v6+ format', () => {
      const mockPnpmLock = `lockfileVersion: '6.0'

packages:
  /lodash@4.17.21:
    resolution: {integrity: sha512-...}`;

      const result = scanner.parsePnpmLockV6Plus(mockPnpmLock, {});
      expect(result).toEqual({
        'lodash@4.17.21': true
      });
    });

    test('parsePnpmLockV5 should handle pnpm v5 format', () => {
      const mockPnpmLock = `lockfileVersion: '5.0'

packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-...}`;

      const result = scanner.parsePnpmLockV5(mockPnpmLock, {});
      expect(result).toEqual({
        'lodash@4.17.21': true
      });
    });
  });
});
