#!/usr/bin/env node

/**
 * 测试运行脚本
 * 用于验证所有测试是否正常工作
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 开始运行 Shai-Hulud Scanner 测试套件...\n');

// 检查测试文件是否存在
const testFiles = [
  'test/scanner.test.js',
  'test/lockfile-parsing.test.js',
  'test/cli.test.js',
  'test/edge-cases.test.js',
  'test/integration.test.js'
];

console.log('📁 检查测试文件...');
for (const file of testFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} 存在`);
  } else {
    console.log(`❌ ${file} 不存在`);
    process.exit(1);
  }
}

// 检查测试数据文件
const fixtureFiles = [
  'test/fixtures/package-lock-v1.json',
  'test/fixtures/package-lock-v2.json',
  'test/fixtures/yarn.lock',
  'test/fixtures/pnpm-lock.yaml',
  'test/fixtures/attacked-list.txt'
];

console.log('\n📁 检查测试数据文件...');
for (const file of fixtureFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} 存在`);
  } else {
    console.log(`❌ ${file} 不存在`);
    process.exit(1);
  }
}

// 检查 package.json 中的测试配置
console.log('\n📦 检查 package.json 配置...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

if (packageJson.scripts.test) {
  console.log('✅ 测试脚本配置存在');
} else {
  console.log('❌ 测试脚本配置缺失');
  process.exit(1);
}

if (packageJson.devDependencies && packageJson.devDependencies.jest) {
  console.log('✅ Jest 依赖配置存在');
} else {
  console.log('❌ Jest 依赖配置缺失');
  process.exit(1);
}

// 运行测试
console.log('\n🚀 运行测试...');
try {
  const output = execSync('npm test', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  
  console.log('✅ 所有测试通过！');
  console.log('\n📊 测试结果摘要:');
  console.log(output);
  
} catch (error) {
  console.log('❌ 测试失败:');
  console.log(error.stdout || error.message);
  process.exit(1);
}

// 运行覆盖率测试
console.log('\n📈 运行覆盖率测试...');
try {
  const coverageOutput = execSync('npm run test:coverage', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  
  console.log('✅ 覆盖率测试完成！');
  console.log('\n📊 覆盖率报告:');
  console.log(coverageOutput);
  
} catch (error) {
  console.log('⚠️ 覆盖率测试失败，但这是可选的:');
  console.log(error.stdout || error.message);
}

console.log('\n🎉 测试套件验证完成！');
console.log('\n📋 测试覆盖范围:');
console.log('  • 核心功能测试 - Scanner 类和方法');
console.log('  • 锁文件解析测试 - package-lock.json, yarn.lock, pnpm-lock.yaml');
console.log('  • CLI 接口测试 - 命令行参数和输出');
console.log('  • 边界情况测试 - 错误处理和极端情况');
console.log('  • 集成测试 - 端到端工作流');

console.log('\n🔧 可用的测试命令:');
console.log('  npm test                    # 运行所有测试');
console.log('  npm run test:watch         # 监视模式');
console.log('  npm run test:coverage      # 生成覆盖率报告');
console.log('  npm test -- scanner.test.js # 运行特定测试文件');
