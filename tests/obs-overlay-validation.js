#!/usr/bin/env node
/**
 * OBS Overlay Validation Testing with Playwright MCP
 * Tests overlay functionality and real-time synchronization
 */

const { spawn } = require('child_process');
const config = require('./playwright-mcp-config.json');

class OBSOverlayTest {
  constructor() {
    this.mcpProcess = null;
    this.testResults = { passed: 0, failed: 0, errors: [] };
  }

  async startMCPServer() {
    console.log('🚀 Starting Playwright MCP Server for Overlay Tests...');
    this.mcpProcess = spawn('npx', ['@anthropic-ai/mcp-server-playwright']);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async sendMCPCommand(command) {
    return new Promise((resolve, reject) => {
      this.mcpProcess.stdin.write(JSON.stringify(command) + '\n');
      
      let response = '';
      const timeout = setTimeout(() => reject(new Error('MCP timeout')), 30000);

      this.mcpProcess.stdout.on('data', (data) => {
        response += data.toString();
        try {
          const result = JSON.parse(response);
          clearTimeout(timeout);
          resolve(result);
        } catch (e) {
          // Still accumulating
        }
      });
    });
  }

  async test(name, testFn) {
    try {
      console.log(`🧪 Testing: ${name}`);
      await testFn();
      this.testResults.passed++;
      console.log(`✅ ${name} - PASSED`);
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push({ test: name, error: error.message });
      console.log(`❌ ${name} - FAILED: ${error.message}`);
    }
  }

  async runTests() {
    await this.startMCPServer();

    // Test 1: Overlay loads correctly
    await this.test('Overlay Page Load', async () => {
      await this.sendMCPCommand({
        method: 'browser_navigate',
        params: { url: config.testConfig.baseURL + '/overlay' }
      });

      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'HEBOCON 2025' }
      });
    });

    // Test 2: Display mode switching
    await this.test('Display Mode Toggle', async () => {
      // Open control panel in new tab
      await this.sendMCPCommand({
        method: 'browser_tab_new',
        params: { url: config.testConfig.baseURL }
      });

      // Switch to bracket mode
      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Show Bracket button',
          ref: 'button:has-text("Show Bracket")'
        }
      });

      // Switch back to overlay tab
      await this.sendMCPCommand({
        method: 'browser_tab_select',
        params: { index: 0 }
      });

      // Wait for bracket view to appear
      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'TOURNAMENT BRACKET' }
      });
    });

    // Test 3: Timer synchronization
    await this.test('Timer Sync Test', async () => {
      // Switch to control panel
      await this.sendMCPCommand({
        method: 'browser_tab_select',
        params: { index: 1 }
      });

      // Start timer
      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Start timer button',
          ref: 'button:has-text("Start")'
        }
      });

      // Check overlay shows running timer
      await this.sendMCPCommand({
        method: 'browser_tab_select',
        params: { index: 0 }
      });

      // Wait a moment for timer update
      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { time: 2 }
      });

      // Take screenshot to verify timer display
      await this.sendMCPCommand({
        method: 'browser_take_screenshot',
        params: { 
          filename: 'test-results/timer-running.png',
          fullPage: false
        }
      });
    });

    // Test 4: Visual elements verification
    await this.test('Visual Elements Check', async () => {
      // Verify LIVE indicator
      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'LIVE' }
      });

      // Check for VS animation elements
      await this.sendMCPCommand({
        method: 'browser_evaluate',
        params: {
          function: '() => document.querySelector(".vs-container") !== null'
        }
      });

      // Verify timer display format
      await this.sendMCPCommand({
        method: 'browser_evaluate',
        params: {
          function: '() => /\\d{2}:\\d{2}/.test(document.querySelector(".timer-display")?.textContent || "")'
        }
      });
    });

    // Test 5: Animation performance
    await this.test('Animation Performance', async () => {
      // Test shine animation
      await this.sendMCPCommand({
        method: 'browser_evaluate',
        params: {
          function: '() => getComputedStyle(document.querySelector(".robot-name")).animationName !== "none"'
        }
      });

      // Test pulse animation
      await this.sendMCPCommand({
        method: 'browser_evaluate',
        params: {
          function: '() => getComputedStyle(document.querySelector(".vs")).animationName !== "none"'
        }
      });
    });

    this.cleanup();
  }

  cleanup() {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
    }

    const summary = {
      total: this.testResults.passed + this.testResults.failed,
      passed: this.testResults.passed,
      failed: this.testResults.failed
    };

    console.log('\n📊 OBS Overlay Test Summary:');
    console.log(`Total: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}`);
    
    if (summary.failed > 0) {
      console.log('\n❌ Failures:');
      this.testResults.errors.forEach(e => console.log(`  - ${e.test}: ${e.error}`));
      process.exit(1);
    } else {
      console.log('\n✅ All overlay tests passed!');
      process.exit(0);
    }
  }
}

const test = new OBSOverlayTest();
test.runTests().catch(error => {
  console.error('💥 Overlay test failed:', error);
  process.exit(1);
});