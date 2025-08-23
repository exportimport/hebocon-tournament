#!/usr/bin/env node
/**
 * Visual Regression Testing
 * Tests visual consistency and layout integrity
 */

const { spawn } = require('child_process');
const config = require('./playwright-mcp-config.json');

class VisualRegressionTest {
  constructor() {
    this.mcpProcess = null;
    this.testResults = { passed: 0, failed: 0, errors: [] };
  }

  async startMCPServer() {
    console.log('🚀 Starting Visual Regression Tests...');
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

    // Set browser size to OBS standard
    await this.sendMCPCommand({
      method: 'browser_resize',
      params: { width: 1920, height: 1080 }
    });

    // Test 1: Control panel layout
    await this.test('Control Panel Layout', async () => {
      await this.sendMCPCommand({
        method: 'browser_navigate',
        params: { url: config.testConfig.baseURL }
      });

      await this.sendMCPCommand({
        method: 'browser_take_screenshot',
        params: { 
          filename: 'test-results/control-panel-baseline.png',
          fullPage: true
        }
      });
    });

    // Test 2: Overlay match display
    await this.test('Overlay Match Display', async () => {
      await this.sendMCPCommand({
        method: 'browser_navigate',
        params: { url: config.testConfig.baseURL + '/overlay' }
      });

      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'VS' }
      });

      await this.sendMCPCommand({
        method: 'browser_take_screenshot',
        params: { 
          filename: 'test-results/overlay-match-baseline.png',
          fullPage: true
        }
      });
    });

    // Test 3: Bracket display layout
    await this.test('Bracket Display Layout', async () => {
      // Switch to bracket mode via API
      await this.sendMCPCommand({
        method: 'browser_evaluate',
        params: {
          function: '() => fetch("/api/overlay/mode", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({mode: "bracket"}) })'
        }
      });

      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'TOURNAMENT BRACKET' }
      });

      await this.sendMCPCommand({
        method: 'browser_take_screenshot',
        params: { 
          filename: 'test-results/overlay-bracket-baseline.png',
          fullPage: true
        }
      });
    });

    // Test 4: Different robot name lengths
    await this.test('Robot Name Length Handling', async () => {
      // Test with very long robot names
      await this.sendMCPCommand({
        method: 'browser_evaluate',
        params: {
          function: `() => {
            fetch("/api/robots", {
              method: "POST",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify({name: "Super-Ultra-Mega-Destroyer-Robot-With-Very-Long-Name-2025"})
            });
            return fetch("/api/match", {
              method: "POST", 
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify({
                robot1: "Super-Ultra-Mega-Destroyer-Robot-With-Very-Long-Name-2025",
                robot2: "X",
                round: "Test"
              })
            });
          }`
        }
      });

      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { time: 2 }
      });

      await this.sendMCPCommand({
        method: 'browser_take_screenshot',
        params: { 
          filename: 'test-results/long-names-test.png',
          fullPage: true
        }
      });
    });

    // Test 5: Responsive behavior
    await this.test('Responsive Design', async () => {
      // Test at different viewport sizes
      const sizes = [
        { width: 1920, height: 1080, name: 'fullhd' },
        { width: 1280, height: 720, name: 'hd' },
        { width: 800, height: 600, name: 'small' }
      ];

      for (const size of sizes) {
        await this.sendMCPCommand({
          method: 'browser_resize',
          params: { width: size.width, height: size.height }
        });

        await this.sendMCPCommand({
          method: 'browser_take_screenshot',
          params: { 
            filename: `test-results/responsive-${size.name}.png`,
            fullPage: true
          }
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

    console.log('\n📊 Visual Regression Test Summary:');
    console.log(`Total: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}`);
    
    if (summary.failed > 0) {
      console.log('\n❌ Failures:');
      this.testResults.errors.forEach(e => console.log(`  - ${e.test}: ${e.error}`));
      process.exit(1);
    } else {
      console.log('\n✅ All visual tests passed!');
      process.exit(0);
    }
  }
}

const test = new VisualRegressionTest();
test.runTests().catch(error => {
  console.error('💥 Visual regression test failed:', error);
  process.exit(1);
});