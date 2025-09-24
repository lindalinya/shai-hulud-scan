const { main, parseArgs, showHelp, showVersion } = require('../bin/shai-hulud-scan');
const ShaiHuludScanner = require('../lib/scanner');

// Mock dependencies
jest.mock('../lib/scanner');
jest.mock('fs');

describe('CLI Interface', () => {
  let mockScanner;
  let originalArgv;
  let originalExit;
  let originalConsole;

  beforeEach(() => {
    // Store original values
    originalArgv = process.argv;
    originalExit = process.exit;
    originalConsole = { ...console };

    // Mock process.exit
    process.exit = jest.fn();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Mock scanner
    mockScanner = {
      scan: jest.fn(),
      formatOutput: jest.fn()
    };
    ShaiHuludScanner.mockImplementation(() => mockScanner);

    // Mock fs
    const fs = require('fs');
    fs.existsSync = jest.fn().mockReturnValue(true);
  });

  afterEach(() => {
    // Restore original values
    process.argv = originalArgv;
    process.exit = originalExit;
    Object.assign(console, originalConsole);
    jest.clearAllMocks();
  });

  describe('parseArgs', () => {
    test('should parse default arguments', () => {
      process.argv = ['node', 'script.js'];
      const result = parseArgs();
      
      expect(result).toEqual({
        json: false,
        help: false,
        version: false,
        directory: process.cwd()
      });
    });

    test('should parse --json flag', () => {
      process.argv = ['node', 'script.js', '--json'];
      const result = parseArgs();
      
      expect(result.json).toBe(true);
    });

    test('should parse --help flag', () => {
      process.argv = ['node', 'script.js', '--help'];
      const result = parseArgs();
      
      expect(result.help).toBe(true);
    });

    test('should parse -h flag', () => {
      process.argv = ['node', 'script.js', '-h'];
      const result = parseArgs();
      
      expect(result.help).toBe(true);
    });

    test('should parse --version flag', () => {
      process.argv = ['node', 'script.js', '--version'];
      const result = parseArgs();
      
      expect(result.version).toBe(true);
    });

    test('should parse -v flag', () => {
      process.argv = ['node', 'script.js', '-v'];
      const result = parseArgs();
      
      expect(result.version).toBe(true);
    });

    test('should parse --dir flag with value', () => {
      process.argv = ['node', 'script.js', '--dir', '/custom/path'];
      const result = parseArgs();
      
      expect(result.directory).toBe('/custom/path');
    });

    test('should parse -d flag with value', () => {
      process.argv = ['node', 'script.js', '-d', '/custom/path'];
      const result = parseArgs();
      
      expect(result.directory).toBe('/custom/path');
    });

    test('should parse directory as positional argument', () => {
      process.argv = ['node', 'script.js', '/custom/path'];
      const result = parseArgs();
      
      expect(result.directory).toBe('/custom/path');
    });

    test('should handle multiple flags', () => {
      process.argv = ['node', 'script.js', '--json', '--dir', '/path', '--help'];
      const result = parseArgs();
      
      expect(result).toEqual({
        json: true,
        help: true,
        version: false,
        directory: '/path'
      });
    });

    test('should ignore unknown flags', () => {
      process.argv = ['node', 'script.js', '--unknown', '--json'];
      const result = parseArgs();
      
      expect(result.json).toBe(true);
      expect(result.help).toBe(false);
    });
  });

  describe('showHelp', () => {
    test('should display help information', () => {
      showHelp();
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Shai-Hulud Supply Chain Attack Detection Tool')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Usage:')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Options:')
      );
    });
  });

  describe('showVersion', () => {
    test('should display version information', () => {
      // Mock package.json
      const mockPackageJson = { version: '1.0.0' };
      jest.doMock('../package.json', () => mockPackageJson);
      
      showVersion();
      
      expect(console.log).toHaveBeenCalledWith('1.0.0');
    });
  });

  describe('main function', () => {
    test('should show help when --help flag is provided', () => {
      process.argv = ['node', 'script.js', '--help'];
      
      main();
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Shai-Hulud Supply Chain Attack Detection Tool')
      );
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    test('should show version when --version flag is provided', () => {
      process.argv = ['node', 'script.js', '--version'];
      
      main();
      
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    test('should exit with error when directory does not exist', () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      
      process.argv = ['node', 'script.js', '/nonexistent/path'];
      
      main();
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Directory does not exist')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('should run scan when directory exists', () => {
      const mockResults = { results: {}, total: 0 };
      const mockOutput = '✅ No packages affected';
      
      mockScanner.scan.mockReturnValue(mockResults);
      mockScanner.formatOutput.mockReturnValue(mockOutput);
      
      process.argv = ['node', 'script.js', '/valid/path'];
      
      main();
      
      expect(mockScanner.scan).toHaveBeenCalledWith('/valid/path', {
        json: false,
        help: false,
        version: false,
        directory: '/valid/path'
      });
      expect(mockScanner.formatOutput).toHaveBeenCalledWith(mockResults, {
        json: false,
        help: false,
        version: false,
        directory: '/valid/path'
      });
      expect(console.log).toHaveBeenCalledWith(mockOutput);
      expect(process.exit).not.toHaveBeenCalled();
    });

    test('should exit with error code when vulnerabilities found', () => {
      const mockResults = { results: { 'package@1.0.0': ['/path/to/lock'] }, total: 1 };
      const mockOutput = '❌ Found 1 packages affected';
      
      mockScanner.scan.mockReturnValue(mockResults);
      mockScanner.formatOutput.mockReturnValue(mockOutput);
      
      process.argv = ['node', 'script.js', '/valid/path'];
      
      main();
      
      expect(console.log).toHaveBeenCalledWith(mockOutput);
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('should handle scan errors gracefully', () => {
      const mockError = new Error('Scan failed');
      mockScanner.scan.mockImplementation(() => {
        throw mockError;
      });
      
      process.argv = ['node', 'script.js', '/valid/path'];
      
      main();
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred during scanning'),
        mockError.message
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('should pass options to scanner', () => {
      const mockResults = { results: {}, total: 0 };
      const mockOutput = '✅ No packages affected';
      
      mockScanner.scan.mockReturnValue(mockResults);
      mockScanner.formatOutput.mockReturnValue(mockOutput);
      
      process.argv = ['node', 'script.js', '--json', '--dir', '/custom/path'];
      
      main();
      
      expect(mockScanner.scan).toHaveBeenCalledWith('/custom/path', {
        json: true,
        help: false,
        version: false,
        directory: '/custom/path'
      });
      expect(mockScanner.formatOutput).toHaveBeenCalledWith(mockResults, {
        json: true,
        help: false,
        version: false,
        directory: '/custom/path'
      });
    });
  });
});
