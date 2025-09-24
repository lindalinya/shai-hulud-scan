# Shai-Hulud Scanner 测试文档

## 测试覆盖范围

本测试套件为 Shai-Hulud Scanner 提供了全面的测试覆盖，包括：

### 1. 核心功能测试 (`scanner.test.js`)
- **Scanner 初始化和配置**
  - 攻击包列表加载
  - 错误处理机制
- **文件系统操作**
  - 递归目录扫描
  - 锁文件发现
  - 权限错误处理
- **包名解析**
  - 常规包名提取
  - 作用域包名处理
  - 边界情况处理
- **输出格式化**
  - JSON 格式输出
  - 文本格式输出
  - 成功/失败消息

### 2. 锁文件解析测试 (`lockfile-parsing.test.js`)
- **package-lock.json 支持**
  - v1 格式解析
  - v2 格式解析
  - 依赖树遍历
- **yarn.lock 支持**
  - 标准格式解析
  - 复杂格式处理
  - 多包名支持
- **pnpm-lock.yaml 支持**
  - YAML 格式解析
  - 包路径解析
  - 版本提取

### 3. CLI 接口测试 (`cli.test.js`)
- **参数解析**
  - 所有支持的标志
  - 位置参数处理
  - 错误参数处理
- **帮助和版本信息**
  - 帮助文本显示
  - 版本信息显示
- **主程序流程**
  - 正常扫描流程
  - 错误处理
  - 退出码管理

### 4. 边界情况测试 (`edge-cases.test.js`)
- **文件系统边界情况**
  - 空目录处理
  - 符号链接处理
  - 权限错误处理
- **锁文件边界情况**
  - 损坏的 JSON/YAML
  - 缺失字段处理
  - 大型文件处理
- **内存和性能**
  - 循环依赖处理
  - 深层依赖树
  - 大型项目扫描
- **Unicode 和特殊字符**
  - 国际化包名
  - 特殊字符处理
- **网络和 I/O 错误**
  - 超时处理
  - 磁盘空间不足
  - 文件损坏

### 5. 集成测试 (`integration.test.js`)
- **端到端工作流**
  - 完整扫描流程
  - 多锁文件类型支持
  - 真实世界格式处理
- **输出格式化集成**
  - 完整结果格式化
  - JSON 输出验证
- **性能集成测试**
  - 大型项目处理
  - 深层嵌套项目
- **错误恢复集成**
  - 部分错误处理
  - 继续扫描机制

## 测试数据

测试使用以下模拟数据：

### 攻击包列表
```
@ahmedhfarag/ngx-perfect-scrollbar@20.0.20
@art-ws/common@2.0.28
lodash@4.17.21
```

### 测试文件
- `test/fixtures/package-lock-v1.json` - package-lock.json v1 格式
- `test/fixtures/package-lock-v2.json` - package-lock.json v2 格式
- `test/fixtures/yarn.lock` - yarn.lock 格式
- `test/fixtures/pnpm-lock.yaml` - pnpm-lock.yaml 格式
- `test/fixtures/attacked-list.txt` - 攻击包列表

## 运行测试

### 安装依赖
```bash
npm install
```

### 运行所有测试
```bash
npm test
```

### 运行特定测试
```bash
# 运行核心功能测试
npm test -- scanner.test.js

# 运行锁文件解析测试
npm test -- lockfile-parsing.test.js

# 运行 CLI 测试
npm test -- cli.test.js

# 运行边界情况测试
npm test -- edge-cases.test.js

# 运行集成测试
npm test -- integration.test.js
```

### 生成覆盖率报告
```bash
npm run test:coverage
```

### 监视模式
```bash
npm run test:watch
```

## 测试覆盖率目标

- **行覆盖率**: > 95%
- **分支覆盖率**: > 90%
- **函数覆盖率**: > 95%
- **语句覆盖率**: > 95%

## 测试策略

### 1. 单元测试
- 每个函数独立测试
- Mock 外部依赖
- 测试正常和异常情况

### 2. 集成测试
- 测试组件间交互
- 使用真实数据格式
- 验证端到端流程

### 3. 边界测试
- 测试极端情况
- 验证错误处理
- 确保系统稳定性

### 4. 性能测试
- 大型项目处理
- 内存使用优化
- 响应时间验证

## 持续集成

测试套件设计为在 CI/CD 环境中运行：

- 所有测试都是确定性的
- 不依赖外部网络
- 使用模拟数据
- 快速执行（< 30 秒）

## 测试维护

### 添加新测试
1. 确定测试类别
2. 编写测试用例
3. 更新覆盖率目标
4. 验证测试通过

### 更新测试数据
1. 更新模拟数据
2. 验证测试仍然通过
3. 更新文档

### 调试测试
1. 使用 `npm run test:watch`
2. 添加 `console.log` 调试
3. 使用 Jest 调试器
