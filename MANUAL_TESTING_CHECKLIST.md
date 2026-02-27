# Local Mode Manual Testing Checklist

This document outlines the manual testing steps to verify local mode functionality works end-to-end.

## Prerequisites

- A local development environment setup with both CLI and backend running
- Access to at least one LLM API endpoint (e.g., OpenAI, Anthropic, or a local server)
- Test API keys for the endpoints you want to test

## Test Setup

1. Create a test directory for local mode testing:
```bash
mkdir ~/test-local-mode
cd ~/test-local-mode
```

2. Create a sample `codebuff.local.yaml` file:
```yaml
mode: local
default_endpoint: openai
endpoints:
  - name: openai
    base_url: https://api.openai.com
    api_key: YOUR_API_KEY_HERE
    model: gpt-4
  - name: anthropic
    base_url: https://api.anthropic.com
    api_key: YOUR_API_KEY_HERE
    model: claude-3-sonnet-20240229
agent_bindings:
  - agent_id: codebuff/file-picker
    endpoint: openai
    model: gpt-4
```

## Test Scenarios

### 1. CLI Starts Without Login When Local Config Present

**Steps:**
1. Ensure you're logged out (remove `~/.config/codebuff/credentials.json` if it exists)
2. Navigate to the test directory with the local config
3. Start the CLI: `bun run cli start`

**Expected Result:**
- CLI starts without prompting for login
- A message indicates local mode is active (e.g., "Loaded local config with N endpoint(s)")
- No authentication errors occur

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


### 2. Completions Work With Configured Endpoint

**Steps:**
1. Start the CLI in local mode
2. Send a simple prompt: "What is 2 + 2?"
3. Verify the response comes from the configured endpoint

**Expected Result:**
- Response is received successfully
- Response quality matches the configured model (e.g., GPT-4)
- No errors about missing credits or authentication

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


### 3. Different Agents Use Different Endpoints When Configured

**Steps:**
1. Configure multiple endpoints with different models
2. Set up agent bindings for specific agents
3. Run different agents and verify they use their configured endpoints

**Example config:**
```yaml
mode: local
endpoints:
  - name: fast-model
    base_url: https://api.openai.com
    api_key: YOUR_KEY
    model: gpt-3.5-turbo
  - name: smart-model
    base_url: https://api.openai.com
    api_key: YOUR_KEY
    model: gpt-4
agent_bindings:
  - agent_id: codebuff/thinker
    endpoint: fast-model
  - agent_id: codebuff/file-picker
    endpoint: smart-model
```

**Expected Result:**
- Each agent uses its configured endpoint/model
- Responses reflect the appropriate model's behavior
- No mixing of endpoints between agents

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


### 4. No Credits Deducted In Local Mode

**Steps:**
1. Check your current credit balance (if logged into cloud)
2. Complete several tasks in local mode
3. Check your credit balance again

**Expected Result:**
- No credits are deducted during local mode operations
- Usage statistics may show 0 or "local mode" indicator

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


### 5. Missing Config Falls Back To Cloud Mode (Existing Behavior)

**Steps:**
1. Navigate to a directory without `codebuff.local.yaml` or `codebuff.local.json`
2. Start the CLI
3. Verify normal cloud behavior

**Expected Result:**
- CLI prompts for login if not authenticated
- Normal cloud mode operations work as before
- No errors or crashes

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


## Edge Cases Testing

### 6. Invalid Config File

**Steps:**
1. Create a malformed YAML file
2. Start the CLI
3. Verify graceful error handling

**Expected Result:**
- CLI displays a helpful error message
- CLI either falls back to cloud mode or exits gracefully
- No crash or cryptic error

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


### 7. Config With No Endpoints

**Steps:**
1. Create a config with empty endpoints array
2. Start the CLI

**Expected Result:**
- CLI handles empty config gracefully
- Appropriate error message or fallback behavior

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


### 8. Config Search In Parent Directories

**Steps:**
1. Place config in parent directory
2. Navigate to subdirectory
3. Start the CLI

**Expected Result:**
- CLI finds and uses config from parent directory
- Operations work as expected

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


### 9. YAML vs JSON Config Priority

**Steps:**
1. Create both `codebuff.local.yaml` and `codebuff.local.json` with different endpoints
2. Start the CLI

**Expected Result:**
- YAML config is prioritized (as documented)
- Only one set of endpoints is used

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


### 10. Cloud Mode In Config

**Steps:**
1. Set mode to `cloud` in config file
2. Start the CLI

**Expected Result:**
- CLI behaves as in cloud mode (requires login)
- Config endpoints are still sent to backend (for future use)

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


## Performance Testing

### 11. Response Latency

**Steps:**
1. Measure response time for identical prompts in:
   - Cloud mode
   - Local mode with same endpoint
2. Compare the latencies

**Expected Result:**
- Local mode latency is similar to or better than cloud mode
- No significant overhead from local mode routing

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**
- Cloud mode latency: ___ms
- Local mode latency: ___ms


### 12. Multiple Sequential Requests

**Steps:**
1. Send 10 consecutive requests in local mode
2. Verify all complete successfully

**Expected Result:**
- All requests complete without errors
- No memory leaks or performance degradation
- Config state is maintained correctly

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


## Configuration Validation

### 13. Endpoint URL Validation

**Steps:**
1. Test with invalid URL (e.g., `not-a-url`)
2. Test with unreachable URL (e.g., `http://localhost:9999`)
3. Test with valid but unauthenticated URL

**Expected Result:**
- Invalid URLs produce clear error messages
- Unreachable URLs timeout with appropriate error
- Auth failures are handled gracefully

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


### 14. API Key Handling

**Steps:**
1. Test with valid API key
2. Test with invalid API key
3. Test without API key (for endpoints that don't require it)

**Expected Result:**
- Valid key works as expected
- Invalid key produces clear error message
- Missing key handled appropriately

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


## Integration Testing

### 15. Config Persistence Across Sessions

**Steps:**
1. Start and stop CLI multiple times
2. Verify config is reloaded each time

**Expected Result:**
- Config is loaded on every CLI start
- No state pollution between sessions

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


### 16. Backend Config Receipt

**Steps:**
1. Start CLI with local config
2. Check backend logs or use GET /api/v1/config endpoint

**Expected Result:**
- Backend receives the config via POST /api/v1/config
- Config is accessible via GET /api/v1/config
- Config structure is preserved

**Actual Result:** [ ] PASS / [ ] FAIL

**Notes:**


## Test Summary

**Total Tests:** 16
**Passed:** ___
**Failed:** ___
**Skipped:** ___

**Overall Status:** [ ] PASS / [ ] FAIL

## Issues Found

List any issues discovered during testing:

1.


2.


3.


## Recommendations

List any recommendations for improvements:

1.


2.


3.
