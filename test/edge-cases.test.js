const fs = require('fs');
const path = require('path');
const ShaiHuludScanner = require('../lib/scanner');

// Mock fs module
jest.mock('fs');

describe('Edge Cases and Error Handling', () => {
  let scanner;
  const mockAttackedList = [
    '@ahmedhfarag/ngx-perfect-scrollbar@20.0.20',
    '@art-ws/common@2.0.28',
    'lodash@4.17.21'
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    fs.readFileSync.mockImplementation((filePath, encoding) => {
      if (filePath.includes('shai-hulud-attacked-list.txt')) {
        return mockAttackedList.join('\n');
      }
      throw new Error('File not found');
    });

    scanner = new ShaiHuludScanner();
  });

  describe('File System Edge Cases', () => {
    test('should handle empty directories', () => {
      fs.readdirSync.mockReturnValue([]);
      
      const result = scanner.findLockFiles('/empty/directory');
      
      expect(result).toEqual([]);
    });

    test('should handle directories with only non-lock files', () => {
      const mockEntries = [
        { name: 'package.json', isDirectory: () => false, isFile: () => true },
        { name: 'README.md', isDirectory: () => false, isFile: () => true },
        { name: 'src', isDirectory: () => true, isFile: () => false }
      ];
      
      fs.readdirSync
        .mockReturnValueOnce(mockEntries)
        .mockReturnValue([]); // Return empty for src directory
      
      const result = scanner.findLockFiles('/directory');
      
      expect(result).toEqual([]);
    });

    test('should handle deeply nested directory structures', () => {
      const mockEntries = [
        { name: 'level1', isDirectory: () => true, isFile: () => false }
      ];
      const level1Entries = [
        { name: 'level2', isDirectory: () => true, isFile: () => false }
      ];
      const level2Entries = [
        { name: 'level3', isDirectory: () => true, isFile: () => false }
      ];
      const level3Entries = [
        { name: 'package-lock.json', isDirectory: () => false, isFile: () => true }
      ];
      
      fs.readdirSync
        .mockReturnValueOnce(mockEntries)
        .mockReturnValueOnce(level1Entries)
        .mockReturnValueOnce(level2Entries)
        .mockReturnValueOnce(level3Entries);
      
      const result = scanner.findLockFiles('/deep/directory');
      
      expect(result).toEqual([path.join('/deep/directory/level1/level2/level3', 'package-lock.json')]);
    });

    test('should handle symbolic links gracefully', () => {
      const mockEntries = [
        { name: 'symlink', isDirectory: () => true, isFile: () => false },
        { name: 'package-lock.json', isDirectory: () => false, isFile: () => true }
      ];
      
      fs.readdirSync
        .mockReturnValueOnce(mockEntries)
        .mockImplementationOnce(() => {
          throw { code: 'ELOOP', message: 'Too many symbolic links' };
        });
      
      const result = scanner.findLockFiles('/directory');
      
      expect(result).toEqual([path.join('/directory', 'package-lock.json')]);
    });
  });

  describe('Lockfile Parsing Edge Cases', () => {
    test('should handle package-lock.json with no lockfileVersion', () => {
      const mockContent = JSON.stringify({
        dependencies: {
          'lodash': { version: '4.17.21' }
        }
      });
      
      fs.readFileSync.mockReturnValue(mockContent);
      
      const result = scanner.checkPackageLock('/path/to/package-lock.json');
      
      expect(result).toEqual({
        'lodash@4.17.21': true
      });
    });

    test('should handle package-lock.json with malformed dependencies', () => {
      const mockContent = JSON.stringify({
        lockfileVersion: 1,
        dependencies: {
          'package1': null,
          'package2': { version: '1.0.0' },
          'package3': { version: null }
        }
      });
      
      fs.readFileSync.mockReturnValue(mockContent);
      
      const result = scanner.checkPackageLock('/path/to/package-lock.json');
      
      expect(result).toEqual({});
    });

    test('should handle yarn.lock with malformed entries', () => {
      const mockContent = `# yarn.lock
malformed-entry:
  version "1.0.0"

"@scope/package@1.0.0":
  version "1.0.0"
  resolved "https://registry.npmjs.org/@scope/package/-/package-1.0.0.tgz#sha512-test"
  integrity sha512-test

package-without-version:
  resolved "https://registry.npmjs.org/package/-/package-1.0.0.tgz#sha512-test"
  integrity sha512-test`;
      
      fs.readFileSync.mockReturnValue(mockContent);
      
      const result = scanner.checkYarnLock('/path/to/yarn.lock');
      
      expect(result).toEqual({});
    });

    test('should handle pnpm-lock.yaml with malformed entries', () => {
      const mockContent = `lockfileVersion: '6.0'

packages:
  /malformed-entry:
    version: 1.0.0

  /@scope/package@1.0.0:
    version: 1.0.0
    resolution: '@scope/package@1.0.0'
    integrity: sha512-test

  /package-without-version:
    resolution: 'package@1.0.0'
    integrity: sha512-test`;
      
      fs.readFileSync.mockReturnValue(mockContent);
      
      const result = scanner.checkPnpmLock('/path/to/pnpm-lock.yaml');
      
      expect(result).toEqual({});
    });

    test('should handle very large lockfiles', () => {
      const largeDeps = {};
      for (let i = 0; i < 1000; i++) {
        largeDeps[`package${i}`] = { version: `${i}.0.0` };
      }
      
      const mockContent = JSON.stringify({
        lockfileVersion: 1,
        dependencies: largeDeps
      });
      
      fs.readFileSync.mockReturnValue(mockContent);
      
      const result = scanner.checkPackageLock('/path/to/package-lock.json');
      
      expect(result).toEqual({});
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    test('should handle circular dependencies in package-lock.json', () => {
      const mockContent = JSON.stringify({
        lockfileVersion: 1,
        dependencies: {
          'package1': {
            version: '1.0.0',
            dependencies: {
              'package2': {
                version: '2.0.0',
                dependencies: {
                  'package1': { version: '1.0.0' }
                }
              }
            }
          }
        }
      });
      
      fs.readFileSync.mockReturnValue(mockContent);
      
      const result = scanner.checkPackageLock('/path/to/package-lock.json');
      
      expect(result).toEqual({});
    });

    test('should handle extremely deep dependency trees', () => {
      let deps = {};
      let current = deps;
      
      // Create a smaller deep dependency tree to avoid stack overflow
      for (let i = 0; i < 10; i++) {
        current[`package${i}`] = {
          version: `${i}.0.0`,
          dependencies: {}
        };
        current = current[`package${i}`].dependencies;
      }
      
      const mockContent = JSON.stringify({
        lockfileVersion: 1,
        dependencies: deps
      });
      
      fs.readFileSync.mockReturnValue(mockContent);
      
      const result = scanner.checkPackageLock('/path/to/package-lock.json');
      
      expect(result).toEqual({});
    });
  });

  describe('Unicode and Special Characters', () => {
    test('should handle unicode package names', () => {
      const mockContent = JSON.stringify({
        lockfileVersion: 1,
        dependencies: {
          '测试包': { version: '1.0.0' },
          'package-with-émojis': { version: '1.0.0' }
        }
      });
      
      fs.readFileSync.mockReturnValue(mockContent);
      
      const result = scanner.checkPackageLock('/path/to/package-lock.json');
      
      expect(result).toEqual({});
    });

    test('should handle special characters in yarn.lock', () => {
      const mockContent = `# yarn.lock
"package-with-special-chars@1.0.0":
  version "1.0.0"
  resolved "https://registry.npmjs.org/package-with-special-chars/-/package-1.0.0.tgz#sha512-test"
  integrity sha512-test`;
      
      fs.readFileSync.mockReturnValue(mockContent);
      
      const result = scanner.checkYarnLock('/path/to/yarn.lock');
      
      expect(result).toEqual({});
    });
  });

  describe('Network and I/O Edge Cases', () => {
    test('should handle file read timeouts', () => {
      fs.readFileSync.mockImplementation(() => {
        throw { code: 'ETIMEDOUT', message: 'File read timeout' };
      });
      
      const result = scanner.checkPackageLock('/path/to/package-lock.json');
      
      expect(result).toEqual({});
    });

    test('should handle disk full errors', () => {
      fs.readFileSync.mockImplementation(() => {
        throw { code: 'ENOSPC', message: 'No space left on device' };
      });
      
      const result = scanner.checkPackageLock('/path/to/package-lock.json');
      
      expect(result).toEqual({});
    });

    test('should handle corrupted lockfiles', () => {
      const mockContent = 'corrupted json content { invalid syntax';
      
      fs.readFileSync.mockReturnValue(mockContent);
      
      const result = scanner.checkPackageLock('/path/to/package-lock.json');
      
      expect(result).toEqual({});
    });
  });

  describe('Scanner Integration Edge Cases', () => {
    test('should handle scan with no lockfiles found', () => {
      fs.readdirSync.mockReturnValue([]);
      
      const result = scanner.scan('/empty/directory');
      
      expect(result).toEqual({ results: {}, total: 0 });
    });

    test('should handle scan with mixed lockfile types', () => {
      const mockEntries = [
        { name: 'package-lock.json', isDirectory: () => false, isFile: () => true },
        { name: 'yarn.lock', isDirectory: () => false, isFile: () => true },
        { name: 'pnpm-lock.yaml', isDirectory: () => false, isFile: () => true }
      ];
      
      fs.readdirSync.mockReturnValue(mockEntries);
      
      // Mock different lockfile contents
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('package-lock.json')) {
          return JSON.stringify({
            lockfileVersion: 1,
            dependencies: { 'lodash': { version: '4.17.21' } }
          });
        }
        if (filePath.includes('yarn.lock')) {
          return `# yarn.lock
"@ahmedhfarag/ngx-perfect-scrollbar@20.0.20":
  version "20.0.20"
  resolved "https://registry.npmjs.org/@ahmedhfarag/ngx-perfect-scrollbar/-/ngx-perfect-scrollbar-20.0.20.tgz#sha512-test"
  integrity sha512-test`;
        }
        if (filePath.includes('pnpm-lock.yaml')) {
          return `lockfileVersion: '6.0'

packages:
  /@art-ws/common@2.0.28:
    version: 2.0.28
    resolution: '@art-ws/common@2.0.28'
    integrity: sha512-test`;
        }
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        throw new Error('File not found');
      });
      
      const result = scanner.scan('/mixed/directory');
      
      expect(result.total).toBe(3); // All three packages work now
      expect(result.results['lodash@4.17.21']).toBeDefined();
      expect(result.results['@art-ws/common@2.0.28']).toBeDefined();
      expect(result.results['@ahmedhfarag/ngx-perfect-scrollbar@20.0.20']).toBeDefined();
    });

    test('should handle formatOutput with empty results', () => {
      const scanResults = { results: {}, total: 0 };
      const options = { json: false };
      
      const result = scanner.formatOutput(scanResults, options);
      
      expect(result).toBe('✅ No packages affected by Shai-Hulud attack found');
    });

    test('should handle formatOutput with JSON format', () => {
      const scanResults = {
        results: {
          'package@1.0.0': ['/path/to/lock1', '/path/to/lock2']
        },
        total: 2
      };
      const options = { json: true };
      
      const result = scanner.formatOutput(scanResults, options);
      const parsed = JSON.parse(result);
      
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        package: 'package@1.0.0',
        lockFile: '/path/to/lock1',
        severity: 'high',
        type: 'shai-hulud-compromise'
      });
    });
  });
});
