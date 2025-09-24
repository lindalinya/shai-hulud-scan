const fs = jest.genMockFromModule('fs');

// Mock file system
let mockFiles = {};
let mockDirectories = {};

fs.__setMockFiles = (files) => {
  mockFiles = files;
};

fs.__setMockDirectories = (dirs) => {
  mockDirectories = dirs;
};

fs.readFileSync = jest.fn((path, encoding) => {
  if (mockFiles[path]) {
    return mockFiles[path];
  }
  throw new Error(`ENOENT: no such file or directory, open '${path}'`);
});

fs.existsSync = jest.fn((path) => {
  return mockFiles[path] !== undefined || mockDirectories[path] === true;
});

fs.readdirSync = jest.fn((dir, options) => {
  if (mockDirectories[dir]) {
    return mockDirectories[dir].map(name => ({
      name,
      isDirectory: () => name.startsWith('dir_') || name === 'node_modules',
      isFile: () => !name.startsWith('dir_') && name !== 'node_modules'
    }));
  }
  throw new Error(`ENOENT: no such file or directory, scandir '${dir}'`);
});

module.exports = fs;
