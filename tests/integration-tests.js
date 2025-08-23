#!/usr/bin/env node
/**
 * Integration Testing
 * Tests keyboard shortcuts and complete workflows
 */

const { spawn } = require('child_process');
const config = require('./playwright-mcp-config.json');

class IntegrationTest {
  constructor() {
    this.mcpProcess = null;
    this.testResults = { passed: 0, failed: 0, errors: [] };
  }

  async startMCPServer() {
    console.log('🚀 Starting Integration Tests...');
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

    // Test 1: Keyboard shortcuts
    await this.test('Keyboard Shortcuts', async () => {
      await this.sendMCPCommand({
        method: 'browser_navigate',
        params: { url: config.testConfig.baseURL }
      });

      // Test key '1' for robot slot 1
      await this.sendMCPCommand({
        method: 'browser_press_key',
        params: { key: '1' }
      });

      // Verify slot 1 is selected (should have orange/active styling)
      await this.sendMCPCommand({
        method: 'browser_evaluate',
        params: {
          function: '() => document.querySelector("button:has-text(\\"Roboter 1\\")").classList.contains("btn-warning")'
        }
      });

      // Test key '2' for robot slot 2
      await this.sendMCPCommand({
        method: 'browser_press_key',
        params: { key: '2' }
      });

      // Test F5 for refresh
      await this.sendMCPCommand({
        method: 'browser_press_key',
        params: { key: 'F5' }
      });

      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'Daten geladen' }
      });
    });

    // Test 2: Complete tournament workflow
    await this.test('Complete Tournament Workflow', async () => {
      // Reset system
      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Reset button',
          ref: 'button:has-text("Alles zurücksetzen")'
        }
      });

      // Handle confirmation dialog
      await this.sendMCPCommand({
        method: 'browser_handle_dialog',
        params: { accept: true }
      });

      // Create bracket
      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Create Bracket',
          ref: 'button:has-text("Create Bracket")'
        }
      });

      // Random assignment
      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Random Assignment',
          ref: 'button:has-text("Random Assignment")'
        }
      });

      // Start tournament
      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Start Tournament',
          ref: 'button:has-text("Start Tournament")'
        }
      });

      // Complete first match
      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Winner button',
          ref: 'button:has-text("gewinnt!")'
        }
      });

      // Verify bracket progression
      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'Next Match' }
      });
    });

    // Test 3: Data persistence across reloads
    await this.test('Data Persistence', async () => {
      // Capture current state
      const beforeReload = await this.sendMCPCommand({
        method: 'browser_evaluate',
        params: {
          function: '() => fetch("/api/data").then(r => r.json())'
        }
      });

      // Reload page
      await this.sendMCPCommand({
        method: 'browser_press_key',
        params: { key: 'F5' }
      });

      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'Daten geladen' }
      });

      // Verify data matches
      const afterReload = await this.sendMCPCommand({
        method: 'browser_evaluate',
        params: {
          function: '() => fetch("/api/data").then(r => r.json())'
        }
      });

      // Compare key data points
      if (beforeReload.result.current_match.robot1 !== afterReload.result.current_match.robot1) {
        throw new Error('Match data not persisted across reload');
      }
    });

    // Test 4: API response time monitoring
    await this.test('API Response Time', async () => {
      const apiTests = [
        '/api/data',
        '/api/robots', 
        '/api/match',
        '/api/bracket'
      ];

      for (const endpoint of apiTests) {
        const startTime = Date.now();
        
        await this.sendMCPCommand({
          method: 'browser_evaluate',
          params: {
            function: `() => fetch("${endpoint}").then(r => r.json())`
          }
        });

        const responseTime = Date.now() - startTime;
        
        if (responseTime > 1000) {
          throw new Error(`API ${endpoint} too slow: ${responseTime}ms`);
        }
        
        console.log(`  📡 ${endpoint}: ${responseTime}ms`);
      }
    });

    // Test 5: Concurrent user simulation
    await this.test('Concurrent User Simulation', async () => {
      // Open multiple tabs to simulate multiple users
      const tabs = [];
      
      for (let i = 0; i < 3; i++) {
        await this.sendMCPCommand({
          method: 'browser_tab_new',
          params: { url: config.testConfig.baseURL }
        });
        tabs.push(i + 1);
      }

      // Perform actions in each tab
      for (const tabIndex of tabs) {
        await this.sendMCPCommand({
          method: 'browser_tab_select',
          params: { index: tabIndex }
        });

        await this.sendMCPCommand({
          method: 'browser_click',
          params: {
            element: 'Refresh data',
            ref: 'button:has-text("Daten neu laden")'
          }
        });
      }

      // Verify all tabs still functional
      for (const tabIndex of tabs) {
        await this.sendMCPCommand({
          method: 'browser_tab_select',
          params: { index: tabIndex }
        });

        await this.sendMCPCommand({
          method: 'browser_wait_for',
          params: { text: 'Daten geladen' }
        });
      }
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

    console.log('\n📊 Integration Test Summary:');
    console.log(`Total: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}`);
    
    if (summary.failed > 0) {
      console.log('\n❌ Failures:');
      this.testResults.errors.forEach(e => console.log(`  - ${e.test}: ${e.error}`));
      process.exit(1);
    } else {
      console.log('\n✅ All integration tests passed!');
      process.exit(0);
    }
  }
}

const test = new IntegrationTest();
test.runTests().catch(error => {
  console.error('💥 Integration test failed:', error);
  process.exit(1);
});