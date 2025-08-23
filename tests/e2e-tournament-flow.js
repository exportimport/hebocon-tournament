#!/usr/bin/env node
/**
 * End-to-End Tournament Flow Testing with Playwright MCP
 * Tests complete tournament workflow from setup to finals
 */

const { spawn } = require('child_process');
const config = require('./playwright-mcp-config.json');

class TournamentE2ETest {
  constructor() {
    this.mcpProcess = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async startMCPServer() {
    console.log('🚀 Starting Playwright MCP Server...');
    this.mcpProcess = spawn('npx', ['@anthropic-ai/mcp-server-playwright'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.mcpServers.playwright.env }
    });

    // Wait for MCP server to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async sendMCPCommand(command) {
    return new Promise((resolve, reject) => {
      this.mcpProcess.stdin.write(JSON.stringify(command) + '\n');
      
      let response = '';
      const timeout = setTimeout(() => {
        reject(new Error('MCP command timeout'));
      }, config.testConfig.timeout);

      this.mcpProcess.stdout.on('data', (data) => {
        response += data.toString();
        try {
          const result = JSON.parse(response);
          clearTimeout(timeout);
          resolve(result);
        } catch (e) {
          // Still accumulating response
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

    // Test 1: Navigate to control panel
    await this.test('Control Panel Navigation', async () => {
      await this.sendMCPCommand({
        method: 'browser_navigate',
        params: { url: config.testConfig.baseURL }
      });
      
      await this.sendMCPCommand({
        method: 'browser_snapshot',
        params: {}
      });
    });

    // Test 2: Create tournament bracket
    await this.test('Create Tournament Bracket', async () => {
      await this.sendMCPCommand({
        method: 'browser_click',
        params: { 
          element: 'Create Bracket button',
          ref: 'button:has-text("Create Bracket")'
        }
      });

      // Wait for bracket creation
      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'Tournament in progress' }
      });
    });

    // Test 3: Add robots to bracket
    await this.test('Robot Assignment', async () => {
      // Random assignment
      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Random Assignment button',
          ref: 'button:has-text("Random Assignment")'
        }
      });

      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'Start Tournament' }
      });
    });

    // Test 4: Start tournament
    await this.test('Start Tournament', async () => {
      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Start Tournament button',
          ref: 'button:has-text("Start Tournament")'
        }
      });
    });

    // Test 5: Set match winner
    await this.test('Set Match Winner', async () => {
      // Click first robot winner button
      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Robot 1 winner button',
          ref: 'button:has-text("gewinnt!")'
        }
      });

      // Verify winner animation
      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'Animation zurücksetzen' }
      });
    });

    // Test 6: Verify overlay sync
    await this.test('Overlay Synchronization', async () => {
      // Open overlay in new tab
      await this.sendMCPCommand({
        method: 'browser_tab_new',
        params: { url: config.testConfig.baseURL + '/overlay' }
      });

      await this.sendMCPCommand({
        method: 'browser_snapshot',
        params: {}
      });

      // Verify match data appears in overlay
      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'VS' }
      });
    });

    this.cleanup();
  }

  cleanup() {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
    }

    // Output test summary
    const summary = {
      total: this.testResults.passed + this.testResults.failed,
      passed: this.testResults.passed,
      failed: this.testResults.failed,
      errors: this.testResults.errors
    };

    console.log('\n📊 Test Summary:');
    console.log(`Total: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}`);
    
    if (summary.failed > 0) {
      console.log('\n❌ Failures:');
      summary.errors.forEach(e => console.log(`  - ${e.test}: ${e.error}`));
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    }
  }
}

// Run tests
const test = new TournamentE2ETest();
test.runTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});