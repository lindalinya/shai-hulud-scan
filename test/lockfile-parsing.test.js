const fs = require('fs');
const ShaiHuludScanner = require('../lib/scanner');

// Mock fs module
jest.mock('fs');

describe('Lockfile Parsing', () => {
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

  describe('checkPackageLock - v1 format', () => {
    test('should parse package-lock.json v1 and find attacked packages', () => {
      const mockLockContent = JSON.stringify({
        lockfileVersion: 1,
        dependencies: {
          '@ahmedhfarag/ngx-perfect-scrollbar': {
            version: '20.0.20',
            dependencies: {
              'lodash': { version: '4.17.21' }
            }
          },
          'safe-package': { version: '1.0.0' }
        }
      });

      fs.readFileSync.mockReturnValue(mockLockContent);

      const result = scanner.checkPackageLock('/path/to/package-lock.json');

      expect(result).toEqual({
        '@ahmedhfarag/ngx-perfect-scrollbar@20.0.20': true,
        'lodash@4.17.21': true
      });
    });

    test('should handle missing dependencies', () => {
      const mockLockContent = JSON.stringify({
        lockfileVersion: 1,
        dependencies: {}
      });

      fs.readFileSync.mockReturnValue(mockLockContent);

      const result = scanner.checkPackageLock('/path/to/package-lock.json');

      expect(result).toEqual({});
    });

    test('should handle invalid JSON gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      fs.readFileSync.mockReturnValue('invalid json');

      const result = scanner.checkPackageLock('/path/to/package-lock.json');

      expect(result).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing'),
        expect.any(String)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('checkPackageLock - v2 format', () => {
    test('should parse package-lock.json v2 and find attacked packages', () => {
      const mockLockContent = JSON.stringify({
        lockfileVersion: 2,
        packages: {
          '': { name: 'test-project', version: '1.0.0' },
          'node_modules/@ahmedhfarag/ngx-perfect-scrollbar': {
            version: '20.0.20'
          },
          'node_modules/lodash': {
            version: '4.17.21'
          },
          'node_modules/safe-package': {
            version: '1.0.0'
          }
        }
      });

      fs.readFileSync.mockReturnValue(mockLockContent);

      const result = scanner.checkPackageLock('/path/to/package-lock.json');

      expect(result).toEqual({
        '@ahmedhfarag/ngx-perfect-scrollbar@20.0.20': true,
        'lodash@4.17.21': true
      });
    });

    test('should handle missing packages section', () => {
      const mockLockContent = JSON.stringify({
        lockfileVersion: 2,
        packages: null
      });

      fs.readFileSync.mockReturnValue(mockLockContent);

      const result = scanner.checkPackageLock('/path/to/package-lock.json');

      expect(result).toEqual({});
    });
  });

  describe('checkYarnLock', () => {
    test('should parse yarn.lock and find attacked packages', () => {
      const mockYarnContent = `# yarn.lock
"@ahmedhfarag/ngx-perfect-scrollbar@20.0.20":
  version "20.0.20"
  resolved "https://registry.npmjs.org/@ahmedhfarag/ngx-perfect-scrollbar/-/ngx-perfect-scrollbar-20.0.20.tgz#sha512-test"
  integrity sha512-test

lodash@4.17.21:
  version "4.17.21"
  resolved "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz#sha512-test"
  integrity sha512-test

safe-package@1.0.0:
  version "1.0.0"
  resolved "https://registry.npmjs.org/safe-package/-/safe-package-1.0.0.tgz#sha512-test"
  integrity sha512-test`;

      fs.readFileSync.mockReturnValue(mockYarnContent);

      const result = scanner.checkYarnLock('/path/to/yarn.lock');

      expect(result).toEqual({
        '@ahmedhfarag/ngx-perfect-scrollbar@20.0.20': true,
        'lodash@4.17.21': true
      });
    });

    test('should handle complex yarn.lock formats', () => {
      const mockYarnContent = `# yarn.lock
"@scope/package@1.0.0", "@scope/package@^1.0.0":
  version "1.0.0"
  resolved "https://registry.npmjs.org/@scope/package/-/package-1.0.0.tgz#sha512-test"
  integrity sha512-test

# Comment line
package@1.0.0:
  version "1.0.0"
  resolved "https://registry.npmjs.org/package/-/package-1.0.0.tgz#sha512-test"
  integrity sha512-test`;

      fs.readFileSync.mockReturnValue(mockYarnContent);

      const result = scanner.checkYarnLock('/path/to/yarn.lock');

      expect(result).toEqual({});
    });

    test('should handle malformed yarn.lock gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = scanner.checkYarnLock('/path/to/yarn.lock');

      expect(result).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing'),
        expect.any(String)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('checkPnpmLock', () => {
    test('should parse pnpm-lock.yaml and find attacked packages', () => {
      const mockPnpmContent = `lockfileVersion: '6.0'

packages:
  /@ahmedhfarag/ngx-perfect-scrollbar@20.0.20:
    version: 20.0.20
    resolution: '@ahmedhfarag/ngx-perfect-scrollbar@20.0.20'
    integrity: sha512-test

  /lodash@4.17.21:
    version: 4.17.21
    resolution: 'lodash@4.17.21'
    integrity: sha512-test

  /safe-package@1.0.0:
    version: 1.0.0
    resolution: 'safe-package@1.0.0'
    integrity: sha512-test`;

      fs.readFileSync.mockReturnValue(mockPnpmContent);

      const result = scanner.checkPnpmLock('/path/to/pnpm-lock.yaml');

      expect(result).toEqual({
        '@ahmedhfarag/ngx-perfect-scrollbar@20.0.20': true,
        'lodash@4.17.21': true
      });
    });

    test('should handle pnpm-lock.yaml with version field', () => {
      const mockPnpmContent = `lockfileVersion: '6.0'

packages:
  /@scope/package@1.0.0:
    version: 1.0.0
    resolution: '@scope/package@1.0.0'
    integrity: sha512-test

  /package@1.0.0:
    version: 1.0.0
    resolution: 'package@1.0.0'
    integrity: sha512-test`;

      fs.readFileSync.mockReturnValue(mockPnpmContent);

      const result = scanner.checkPnpmLock('/path/to/pnpm-lock.yaml');

      expect(result).toEqual({});
    });

    test('should handle missing packages section', () => {
      const mockPnpmContent = `lockfileVersion: '6.0'

dependencies:
  package: 1.0.0`;

      fs.readFileSync.mockReturnValue(mockPnpmContent);

      const result = scanner.checkPnpmLock('/path/to/pnpm-lock.yaml');

      expect(result).toEqual({});
    });

    test('should handle malformed pnpm-lock.yaml gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = scanner.checkPnpmLock('/path/to/pnpm-lock.yaml');

      expect(result).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing'),
        expect.any(String)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('walkDeps', () => {
    test('should recursively walk dependencies', () => {
      const deps = {
        'package1': {
          version: '1.0.0',
          dependencies: {
            'package2': {
              version: '2.0.0',
              dependencies: {
                'lodash': { version: '4.17.21' }
              }
            }
          }
        }
      };

      const found = {};
      scanner.walkDeps(deps, found);

      expect(found).toEqual({
        'lodash@4.17.21': true
      });
    });

    test('should handle null dependencies', () => {
      const found = {};
      scanner.walkDeps(null, found);
      expect(found).toEqual({});
    });

    test('should handle empty dependencies', () => {
      const found = {};
      scanner.walkDeps({}, found);
      expect(found).toEqual({});
    });
  });

  describe('walkDepsV2', () => {
    test('should walk packages in v2 format', () => {
      const packages = {
        'node_modules/@ahmedhfarag/ngx-perfect-scrollbar': {
          version: '20.0.20'
        },
        'node_modules/lodash': {
          version: '4.17.21'
        },
        'node_modules/safe-package': {
          version: '1.0.0'
        }
      };

      const found = {};
      scanner.walkDepsV2(packages, found);

      expect(found).toEqual({
        '@ahmedhfarag/ngx-perfect-scrollbar@20.0.20': true,
        'lodash@4.17.21': true
      });
    });

    test('should handle null packages', () => {
      const found = {};
      scanner.walkDepsV2(null, found);
      expect(found).toEqual({});
    });

    test('should handle packages without version', () => {
      const packages = {
        'node_modules/package': {
          // no version field
        }
      };

      const found = {};
      scanner.walkDepsV2(packages, found);
      expect(found).toEqual({});
    });
  });
});
