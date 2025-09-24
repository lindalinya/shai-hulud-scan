const fs = require('fs');
const path = require('path');
const ShaiHuludScanner = require('../lib/scanner');

// Mock fs module
jest.mock('fs');

describe('Compatibility Tests', () => {
  let scanner;
  const mockAttackedList = [
    '@ahmedhfarag/ngx-perfect-scrollbar@20.0.20',
    '@art-ws/common@2.0.28',
    'lodash@4.17.21',
    '@babel/core@7.16.7',
    'base64-js@1.5.1'
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    fs.readFileSync.mockImplementation((filePath, encoding) => {
      if (filePath.includes('shai-hulud-attacked-list.txt')) {
        return mockAttackedList.join('\n');
      }
      throw new Error('File not found');
    });

    fs.statSync.mockReturnValue({ size: 1024 }); // Default file size

    scanner = new ShaiHuludScanner();
  });

  describe('File Encoding Compatibility', () => {
    test('should handle UTF-8 encoding', () => {
      const mockContent = '{"lockfileVersion": 2, "packages": {}}';
      fs.readFileSync.mockImplementation((filePath, encoding) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        if (encoding === 'utf-8') {
          return mockContent;
        }
        throw new Error('Encoding not supported');
      });

      const result = scanner.readLockFile('/test/package-lock.json');
      expect(result).toBe(mockContent);
    });

    test('should fallback to UTF-16LE encoding', () => {
      const mockContent = '{"lockfileVersion": 2, "packages": {}}';
      fs.readFileSync.mockImplementation((filePath, encoding) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        if (encoding === 'utf-8') {
          throw new Error('UTF-8 not supported');
        }
        if (encoding === 'utf-16le') {
          return mockContent;
        }
        throw new Error('Encoding not supported');
      });

      const result = scanner.readLockFile('/test/package-lock.json');
      expect(result).toBe(mockContent);
    });

    test('should fallback to latin1 encoding', () => {
      const mockContent = '{"lockfileVersion": 2, "packages": {}}';
      fs.readFileSync.mockImplementation((filePath, encoding) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        if (encoding === 'utf-8' || encoding === 'utf-16le') {
          throw new Error('Encoding not supported');
        }
        if (encoding === 'latin1') {
          return mockContent;
        }
        throw new Error('Encoding not supported');
      });

      const result = scanner.readLockFile('/test/package-lock.json');
      expect(result).toBe(mockContent);
    });

    test('should use fallback reading when all encodings fail', () => {
      const mockBuffer = Buffer.from('{"lockfileVersion": 2, "packages": {}}');
      fs.readFileSync.mockImplementation((filePath, encoding) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        if (encoding) {
          throw new Error('All encodings failed');
        }
        return mockBuffer;
      });

      const result = scanner.readLockFileWithFallback('/test/package-lock.json');
      expect(result).toBe('{"lockfileVersion": 2, "packages": {}}');
    });
  });

  describe('npm package-lock.json Version Compatibility', () => {
    test('should handle lockfileVersion 0 (npm v4 and earlier)', () => {
      const mockLockData = {
        dependencies: {
          'lodash': {
            version: '4.17.21',
            dependencies: {
              'base64-js': { version: '1.5.1' }
            }
          }
        }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        return JSON.stringify(mockLockData);
      });

      const result = scanner.checkPackageLock('/path/to/package-lock.json');
      expect(result).toEqual({
        'lodash@4.17.21': true,
        'base64-js@1.5.1': true
      });
    });

    test('should handle lockfileVersion 4 (npm v10+)', () => {
      const mockLockData = {
        lockfileVersion: 4,
        packages: {
          '': { name: 'test-project', version: '1.0.0' },
          'node_modules/lodash': { version: '4.17.21' },
          'node_modules/@babel/core': { version: '7.16.7' }
        }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        return JSON.stringify(mockLockData);
      });

      const result = scanner.checkPackageLock('/path/to/package-lock.json');
      expect(result).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });

    test('should handle malformed package-lock.json with fallback', () => {
      // Test fallback parsing directly
      fs.readFileSync.mockImplementation((filePath) => {
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
  });

  describe('Yarn lockfile Version Compatibility', () => {
    test('should handle Yarn v1 lockfile', () => {
      const mockYarnLock = `# yarn lockfile v1

lodash@4.17.21:
  version "4.17.21"
  resolved "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz"

"@babel/core@7.16.7":
  version "7.16.7"
  resolved "https://registry.npmjs.org/@babel/core/-/core-7.16.7.tgz"
`;

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        return mockYarnLock;
      });

      const result = scanner.checkYarnLock('/path/to/yarn.lock');
      expect(result).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });

    test('should handle Yarn v2+ lockfile', () => {
      const mockYarnLock = `# yarn lockfile v2

lodash@4.17.21:
  version "4.17.21"
  resolved "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz"

"@babel/core@7.16.7":
  version "7.16.7"
  resolved "https://registry.npmjs.org/@babel/core/-/core-7.16.7.tgz"
`;

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        return mockYarnLock;
      });

      const result = scanner.checkYarnLock('/path/to/yarn.lock');
      expect(result).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });

    test('should warn about large yarn.lock files', () => {
      const mockYarnLock = `# yarn lockfile v1
lodash@4.17.21:
  version "4.17.21"`;

      fs.statSync.mockReturnValue({ size: 15 * 1024 * 1024 }); // 15MB
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        return mockYarnLock;
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      scanner.checkYarnLock('/path/to/yarn.lock');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Large yarn.lock file detected')
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle Yarn lockfile with fallback parsing', () => {
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

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = scanner.checkYarnLock('/path/to/yarn.lock');
      
      expect(result).toEqual({
        'lodash@4.17.21': true
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('pnpm lockfile Version Compatibility', () => {
    test('should handle pnpm v5 lockfile', () => {
      const mockPnpmLock = `lockfileVersion: '5.0'

packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-...}
  
  @babel/core@7.16.7:
    resolution: {integrity: sha512-...}
`;

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        return mockPnpmLock;
      });

      const result = scanner.checkPnpmLock('/path/to/pnpm-lock.yaml');
      expect(result).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });

    test('should handle pnpm v6+ lockfile', () => {
      const mockPnpmLock = `lockfileVersion: '6.0'

packages:
  /lodash@4.17.21:
    resolution: {integrity: sha512-...}
  
  /@babel/core@7.16.7:
    resolution: {integrity: sha512-...}
`;

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        return mockPnpmLock;
      });

      const result = scanner.checkPnpmLock('/path/to/pnpm-lock.yaml');
      expect(result).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });

    test('should handle pnpm v9+ lockfile', () => {
      const mockPnpmLock = `lockfileVersion: '9.0'

packages:
  /lodash@4.17.21@hash123:
    resolution: {integrity: sha512-...}
  
  /@babel/core@7.16.7@hash456:
    resolution: {integrity: sha512-...}
`;

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        return mockPnpmLock;
      });

      const result = scanner.checkPnpmLock('/path/to/pnpm-lock.yaml');
      expect(result).toEqual({
        'lodash@4.17.21': true,
        '@babel/core@7.16.7': true
      });
    });

    test('should handle pnpm lockfile with fallback parsing', () => {
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

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = scanner.checkPnpmLock('/path/to/pnpm-lock.yaml');
      
      expect(result).toEqual({
        'lodash@4.17.21': true
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty lock files', () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        return '';
      });

      const result = scanner.checkPackageLock('/path/to/empty-lock.json');
      expect(result).toEqual({});
    });

    test('should handle lock files with only comments', () => {
      const mockYarnLock = `# This is a comment
# Another comment
# yarn lockfile v1
`;

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        return mockYarnLock;
      });

      const result = scanner.checkYarnLock('/path/to/yarn.lock');
      expect(result).toEqual({});
    });

    test('should handle malformed package names', () => {
      const mockLockData = {
        lockfileVersion: 2,
        packages: {
          'node_modules/@': { version: '1.0.0' },
          'node_modules/': { version: '2.0.0' },
          'node_modules/valid-package': { version: '3.0.0' }
        }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        return JSON.stringify(mockLockData);
      });

      const result = scanner.checkPackageLock('/path/to/package-lock.json');
      // Should only process valid package names
      expect(result).toEqual({});
    });

    test('should handle special characters in package names', () => {
      const mockLockData = {
        lockfileVersion: 2,
        packages: {
          'node_modules/package-with-dashes': { version: '1.0.0' },
          'node_modules/package_with_underscores': { version: '2.0.0' },
          'node_modules/package.with.dots': { version: '3.0.0' }
        }
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        return JSON.stringify(mockLockData);
      });

      const result = scanner.checkPackageLock('/path/to/package-lock.json');
      // Should handle special characters gracefully
      expect(result).toEqual({});
    });

    test('should handle very large lock files efficiently', () => {
      // Simulate a very large lock file
      const largePackages = {};
      for (let i = 0; i < 10000; i++) {
        largePackages[`node_modules/package-${i}`] = { version: '1.0.0' };
      }

      const mockLockData = {
        lockfileVersion: 2,
        packages: largePackages
      };

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('shai-hulud-attacked-list.txt')) {
          return mockAttackedList.join('\n');
        }
        return JSON.stringify(mockLockData);
      });

      const startTime = Date.now();
      const result = scanner.checkPackageLock('/path/to/large-lock.json');
      const endTime = Date.now();

      expect(result).toEqual({});
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Version Detection', () => {
    test('should detect npm lockfileVersion correctly', () => {
      const testCases = [
        { version: 0, expected: 'fallback' },
        { version: 1, expected: 'v1' },
        { version: 2, expected: 'v2' },
        { version: 3, expected: 'v3' },
        { version: 4, expected: 'v3' } // v4+ uses v3 parsing
      ];

      testCases.forEach(({ version, expected }) => {
        const mockLockData = {
          lockfileVersion: version,
          packages: version >= 2 ? { 'node_modules/lodash': { version: '4.17.21' } } : undefined,
          dependencies: version < 2 ? { 'lodash': { version: '4.17.21' } } : undefined
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath.includes('shai-hulud-attacked-list.txt')) {
            return mockAttackedList.join('\n');
          }
          return JSON.stringify(mockLockData);
        });

        const result = scanner.checkPackageLock('/path/to/package-lock.json');
        expect(result).toEqual({ 'lodash@4.17.21': true });
      });
    });

    test('should detect Yarn version correctly', () => {
      const testCases = [
        { version: 1, header: '# yarn lockfile v1' },
        { version: 2, header: '# yarn lockfile v2' },
        { version: 3, header: '# yarn lockfile v3' }
      ];

      testCases.forEach(({ version, header }) => {
        const mockYarnLock = `${header}

lodash@4.17.21:
  version "4.17.21"`;

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath.includes('shai-hulud-attacked-list.txt')) {
            return mockAttackedList.join('\n');
          }
          return mockYarnLock;
        });

        const result = scanner.checkYarnLock('/path/to/yarn.lock');
        expect(result).toEqual({ 'lodash@4.17.21': true });
      });
    });

    test('should detect pnpm lockfileVersion correctly', () => {
      const testCases = [
        { version: '5.0', expected: 'v5' },
        { version: '6.0', expected: 'v6+' },
        { version: '7.0', expected: 'v6+' },
        { version: '8.0', expected: 'v6+' },
        { version: '9.0', expected: 'v6+' }
      ];

      testCases.forEach(({ version, expected }) => {
        const mockPnpmLock = `lockfileVersion: '${version}'

packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-...}`;

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath.includes('shai-hulud-attacked-list.txt')) {
            return mockAttackedList.join('\n');
          }
          return mockPnpmLock;
        });

        const result = scanner.checkPnpmLock('/path/to/pnpm-lock.yaml');
        expect(result).toEqual({ 'lodash@4.17.21': true });
      });
    });
  });
});
