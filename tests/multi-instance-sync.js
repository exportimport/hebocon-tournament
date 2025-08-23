#!/usr/bin/env node
/**
 * Multi-Instance Synchronization Testing
 * Tests real-time sync between control panel and overlay
 */

const { spawn } = require('child_process');
const config = require('./playwright-mcp-config.json');

class MultiInstanceTest {
  constructor() {
    this.mcpProcess = null;
    this.testResults = { passed: 0, failed: 0, errors: [] };
  }

  async startMCPServer() {
    console.log('🚀 Starting Multi-Instance Test...');
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

    // Test 1: Open both interfaces
    await this.test('Open Control Panel and Overlay', async () => {
      // Control panel in tab 0
      await this.sendMCPCommand({
        method: 'browser_navigate',
        params: { url: config.testConfig.baseURL }
      });

      // Overlay in tab 1
      await this.sendMCPCommand({
        method: 'browser_tab_new',
        params: { url: config.testConfig.baseURL + '/overlay' }
      });

      // Verify both loaded
      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'HEBOCON 2025' }
      });
    });

    // Test 2: Robot selection sync
    await this.test('Robot Selection Synchronization', async () => {
      // Switch to control panel
      await this.sendMCPCommand({
        method: 'browser_tab_select',
        params: { index: 0 }
      });

      // Select robot for slot 1
      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Robot 1 slot button',
          ref: 'button:has-text("Roboter 1 auswählen")'
        }
      });

      // Click a robot from library
      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Chaos-Maschine robot',
          ref: 'button:has-text("Chaos-Maschine")'
        }
      });

      // Switch to overlay and verify update
      await this.sendMCPCommand({
        method: 'browser_tab_select',
        params: { index: 1 }
      });

      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'Chaos-Maschine' }
      });
    });

    // Test 3: Timer sync between instances
    await this.test('Timer Synchronization', async () => {
      // Back to control panel
      await this.sendMCPCommand({
        method: 'browser_tab_select',
        params: { index: 0 }
      });

      // Start timer
      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Start timer',
          ref: 'button:has-text("Start")'
        }
      });

      // Check overlay shows timer running
      await this.sendMCPCommand({
        method: 'browser_tab_select',
        params: { index: 1 }
      });

      // Wait and take screenshot
      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { time: 1 }
      });

      await this.sendMCPCommand({
        method: 'browser_take_screenshot',
        params: { filename: 'test-results/sync-timer.png' }
      });
    });

    // Test 4: Display mode sync
    await this.test('Display Mode Sync', async () => {
      // Switch to bracket mode from control panel
      await this.sendMCPCommand({
        method: 'browser_tab_select',
        params: { index: 0 }
      });

      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Show Bracket button',
          ref: 'button:has-text("Show Bracket")'
        }
      });

      // Verify overlay switches to bracket view
      await this.sendMCPCommand({
        method: 'browser_tab_select',
        params: { index: 1 }
      });

      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'TOURNAMENT BRACKET' }
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

    console.log('\n📊 Multi-Instance Test Summary:');
    console.log(`Total: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}`);
    
    if (summary.failed > 0) {
      console.log('\n❌ Failures:');
      this.testResults.errors.forEach(e => console.log(`  - ${e.test}: ${e.error}`));
      process.exit(1);
    } else {
      console.log('\n✅ All sync tests passed!');
      process.exit(0);
    }
  }
}

const test = new MultiInstanceTest();
test.runTests().catch(error => {
  console.error('💥 Multi-instance test failed:', error);
  process.exit(1);
});