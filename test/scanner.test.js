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
    'lodash@4.17.21'
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
      expect(scanner.extractPackageNameFromPath('@')).toBe(null);
      expect(scanner.extractPackageNameFromPath('@scope')).toBe(null);
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

    test('should handle edge cases', () => {
      expect(scanner.parsePnpmPackagePath('invalid')).toEqual({ name: null, version: null });
      expect(scanner.parsePnpmPackagePath('')).toEqual({ name: null, version: null });
    });
  });

  describe('formatOutput', () => {
    test('should format JSON output correctly', () => {
      const scanResults = {
        results: {
          '@ahmedhfarag/ngx-perfect-scrollbar@20.0.20': ['/path/to/package-lock.json']
        },
        total: 1
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
        total: 1
      };
      const options = { json: false };

      const result = scanner.formatOutput(scanResults, options);

      expect(result).toContain('Found 1 packages affected');
      expect(result).toContain('@ahmedhfarag/ngx-perfect-scrollbar@20.0.20');
      expect(result).toContain('/path/to/package-lock.json');
    });

    test('should show success message when no issues found', () => {
      const scanResults = { results: {}, total: 0 };
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
});
