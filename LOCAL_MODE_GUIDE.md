# Codebuff 本地模式使用手册

本手册介绍如何使用 Codebuff 的本地模式，通过自配置的 OpenAI 兼容 API 运行，无需 Codebuff 账号或订阅。

---

## 快速开始

### 1. 创建配置文件

在项目目录中创建 `codebuff.local.yaml`：

```bash
cp codebuff.local.example.yaml codebuff.local.yaml
```

### 2. 配置 API 密钥

编辑 `codebuff.local.yaml`，填入你的 API 密钥：

```yaml
mode: local
endpoints:
  - name: openai
    base_url: https://api.openai.com/v1
    api_key: sk-your-actual-api-key-here
    model: gpt-4
```

### 3. 启动 Codebuff

```bash
cd your-project
codebuff
```

---

## 配置详解

### 基础配置

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `mode` | string | ✅ | `local` 或 `cloud` |
| `endpoints` | array | ✅ | 至少一个端点 |
| `default_endpoint` | string | ❌ | 默认端点名 |
| `agent_bindings` | array | ❌ | Agent 与端点映射 |

### 端点配置

每个端点包含以下字段：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 端点唯一标识符 |
| `base_url` | string | ✅ | OpenAI 兼容 API 地址 |
| `api_key` | string | ✅ | API 密钥 |
| `model` | string | ❌ | 默认模型名称 |

---

## 支持的 LLM 提供商

### OpenAI

```yaml
endpoints:
  - name: openai
    base_url: https://api.openai.com/v1
    api_key: sk-your-key
    model: gpt-4
```

### DeepSeek

```yaml
endpoints:
  - name: deepseek
    base_url: https://api.deepseek.com/v1
    api_key: sk-your-key
    model: deepseek-chat
```

### Anthropic Claude

```yaml
endpoints:
  - name: anthropic
    base_url: https://api.anthropic.com/v1
    api_key: sk-ant-your-key
    model: claude-3-opus-20240229
```

### 本地 Ollama

```yaml
endpoints:
  - name: ollama
    base_url: http://localhost:11434/v1
    model: llama2
```

### 自定义端点

任何 OpenAI 兼容的 API：

```yaml
endpoints:
  - name: custom
    base_url: https://your-endpoint.com/v1
    api_key: your-key
    model: your-model
```

---

## 高级配置

### 为不同 Agent 分配不同 LLM

通过 `agent_bindings` 实现精细控制：

```yaml
endpoints:
  - name: gpt4
    base_url: https://api.openai.com/v1
    api_key: sk-gpt4-key
    model: gpt-4

  - name: deepseek
    base_url: https://api.deepseek.com/v1
    api_key: sk-deepseek-key
    model: deepseek-chat

agent_bindings:
  # 规划 Agent 使用 GPT-4（质量优先）
  - agent_id: base2
    endpoint: gpt4
    model: gpt-4-turbo

  # 编辑 Agent 使用 DeepSeek（速度优先）
  - agent_id: editor
    endpoint: deepseek
```

**常用 Agent ID**：
- `base2` - 主规划 Agent
- `editor` - 代码编辑 Agent
- `reviewer` - 代码审查 Agent

### 多环境配置

通过环境变量或不同配置文件支持多环境：

```bash
# 开发环境
codebuff.local.dev.yaml

# 生产环境
codebuff.local.prod.yaml
```

---

## 启动方式

### 方式 1：全局安装

```bash
npm install -g codebuff
codebuff
```

### 方式 2：直接运行

```bash
cd /Users/lvzheng/cursor/codebuff
bun run start-cli
```

### 方式 3：开发模式

```bash
cd cli
bun run start-cli
```

---

## 验证配置

启动后，你应该看到：

```
✓ Loaded local config with 2 endpoint(s)
✓ Local mode active - skipping billing checks
```

### 检查配置是否生效

发送消息时，观察是否使用你配置的端点。在本地模式下：

- ✅ 不需要登录
- ✅ 不检查余额
- ✅ 使用你配置的 API 和密钥

---

## 常见问题

### Q: 配置文件放在哪里？

**A:** 支持以下位置（按优先级）：
1. 当前目录：`./codebuff.local.yaml`
2. 当前目录：`./codebuff.local.json`
3. 父目录：`../codebuff.local.yaml`
4. 父目录：`../codebuff.local.json`

### Q: 如何验证配置是否正确？

**A:** 启动时会自动验证：
- 格式错误会显示详细错误信息
- 缺少必填字段会提示
- URL 格式不正确会拒绝

### Q: 可以同时使用多个 LLM 吗？

**A:** 可以！通过 `agent_bindings` 为不同 Agent 分配不同 LLM。

### Q: 本地模式有什么限制？

**A:**
- 不支持 Codebuff Agent Store
- 不支持计费和订阅功能
- 需要自己配置和管理 API 密钥

### Q: 如何切换回云端模式？

**A:** 删除或重命名配置文件，或将 `mode` 改为 `cloud`。

### Q: API 密钥安全吗？

**A:** 配置文件存储在本地，密钥不会上传到 Codebuff 服务器。请妥善保管配置文件。

---

## 配置示例

### 示例 1：仅使用 OpenAI

```yaml
mode: local
endpoints:
  - name: openai
    base_url: https://api.openai.com/v1
    api_key: sk-your-key
    model: gpt-4
```

### 示例 2：混合使用（规划用 GPT-4，编辑用 DeepSeek）

```yaml
mode: local
default_endpoint: deepseek

endpoints:
  - name: gpt4
    base_url: https://api.openai.com/v1
    api_key: sk-your-gpt4-key
    model: gpt-4

  - name: deepseek
    base_url: https://api.deepseek.com/v1
    api_key: sk-your-deepseek-key
    model: deepseek-chat

agent_bindings:
  - agent_id: base2
    endpoint: gpt4

  - agent_id: editor
    endpoint: deepseek
```

### 示例 3：本地 Ollama + 云端 API 混合

```yaml
mode: local
endpoints:
  - name: ollama
    base_url: http://localhost:11434/v1
    model: llama2

  - name: openai
    base_url: https://api.openai.com/v1
    api_key: sk-your-key
    model: gpt-4

agent_bindings:
  - agent_id: editor
    endpoint: ollama

  - agent_id: base2
    endpoint: openai
```

---

## 故障排除

### 问题：启动时提示 "No endpoint configured"

**解决**: 确保配置了 `default_endpoint` 或为所有 Agent 添加了 `agent_bindings`。

### 问题：提示 "Endpoint xxx not found"

**解决**: 检查 `agent_bindings` 中的 `endpoint` 名称是否与 `endpoints` 列表中的 `name` 匹配。

### 问题：API 调用失败

**解决**:
1. 验证 `base_url` 格式正确（需包含 `/v1` 后缀）
2. 确认 `api_key` 有效
3. 检查网络连接

### 问题：配置文件不生效

**解决**:
1. 确认文件名是 `codebuff.local.yaml` 或 `codebuff.local.json`
2. 确认文件在项目目录或父目录
3. 检查 YAML/JSON 格式是否正确

---

## 最佳实践

### 1. 安全性

- **不要提交配置文件到版本控制**
- 将 `codebuff.local.yaml` 添加到 `.gitignore`
- 使用环境变量管理 API 密钥（高级用法）

### 2. 性能优化

- 将简单任务分配给更快的模型（如 DeepSeek）
- 将复杂任务分配给更强的模型（如 GPT-4）
- 本地 Ollama 用于离线场景

### 3. 成本控制

- 不同 Agent 使用不同价格的服务
- 为不同场景选择合适模型
- 避免所有任务都用最贵模型

---

## 更多信息

- **GitHub**: https://github.com/CodebuffAI/codebuff
- **文档**: https://codebuff.com/docs
- **问题反馈**: https://github.com/CodebuffAI/codebuff/issues
