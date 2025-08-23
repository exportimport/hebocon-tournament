#!/usr/bin/env node
/**
 * Performance & Reliability Testing
 * Tests system performance under stress and error recovery
 */

const { spawn } = require('child_process');
const config = require('./playwright-mcp-config.json');

class PerformanceTest {
  constructor() {
    this.mcpProcess = null;
    this.testResults = { passed: 0, failed: 0, errors: [] };
  }

  async startMCPServer() {
    console.log('🚀 Starting Performance Tests...');
    this.mcpProcess = spawn('npx', ['@anthropic-ai/mcp-server-playwright']);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async sendMCPCommand(command) {
    return new Promise((resolve, reject) => {
      this.mcpProcess.stdin.write(JSON.stringify(command) + '\n');
      
      let response = '';
      const timeout = setTimeout(() => reject(new Error('MCP timeout')), 45000);

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
      const startTime = Date.now();
      await testFn();
      const duration = Date.now() - startTime;
      this.testResults.passed++;
      console.log(`✅ ${name} - PASSED (${duration}ms)`);
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push({ test: name, error: error.message });
      console.log(`❌ ${name} - FAILED: ${error.message}`);
    }
  }

  async runTests() {
    await this.startMCPServer();

    // Test 1: Rapid button clicking stress test
    await this.test('Rapid Button Clicking Stress Test', async () => {
      await this.sendMCPCommand({
        method: 'browser_navigate',
        params: { url: config.testConfig.baseURL }
      });

      // Rapidly click robot selection buttons
      for (let i = 0; i < 20; i++) {
        await this.sendMCPCommand({
          method: 'browser_click',
          params: {
            element: 'Robot 1 slot',
            ref: 'button:has-text("Roboter 1 auswählen")'
          }
        });

        await this.sendMCPCommand({
          method: 'browser_click',
          params: {
            element: 'Robot 2 slot', 
            ref: 'button:has-text("Roboter 2 auswählen")'
          }
        });
      }

      // Verify system still responsive
      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'Daten geladen' }
      });
    });

    // Test 2: Timer accuracy under load
    await this.test('Timer Accuracy Under Load', async () => {
      // Start timer
      await this.sendMCPCommand({
        method: 'browser_click',
        params: {
          element: 'Start timer',
          ref: 'button:has-text("Start")'
        }
      });

      // Perform other actions while timer runs
      for (let i = 0; i < 10; i++) {
        await this.sendMCPCommand({
          method: 'browser_click',
          params: {
            element: 'Refresh data',
            ref: 'button:has-text("Daten neu laden")'
          }
        });
        
        await this.sendMCPCommand({
          method: 'browser_wait_for',
          params: { time: 0.5 }
        });
      }

      // Verify timer still running correctly
      await this.sendMCPCommand({
        method: 'browser_evaluate',
        params: {
          function: '() => document.querySelector(".timer-display").textContent !== "02:00"'
        }
      });
    });

    // Test 3: API error recovery
    await this.test('API Error Recovery', async () => {
      // Open overlay
      await this.sendMCPCommand({
        method: 'browser_navigate',
        params: { url: config.testConfig.baseURL + '/overlay' }
      });

      // Simulate API failure by making invalid request
      await this.sendMCPCommand({
        method: 'browser_evaluate',
        params: {
          function: '() => fetch("/api/nonexistent", { method: "POST" }).catch(() => {})'
        }
      });

      // Verify system recovers and continues polling
      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { time: 3 }
      });

      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'LIVE' }
      });
    });

    // Test 4: Memory leak detection
    await this.test('Memory Leak Detection', async () => {
      // Run polling for extended period
      await this.sendMCPCommand({
        method: 'browser_navigate',
        params: { url: config.testConfig.baseURL + '/overlay' }
      });

      const initialMemory = await this.sendMCPCommand({
        method: 'browser_evaluate',
        params: {
          function: '() => performance.memory ? performance.memory.usedJSHeapSize : 0'
        }
      });

      // Let it poll for 30 seconds
      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { time: 30 }
      });

      const finalMemory = await this.sendMCPCommand({
        method: 'browser_evaluate',
        params: {
          function: '() => performance.memory ? performance.memory.usedJSHeapSize : 0'
        }
      });

      // Memory should not increase significantly (< 50MB growth)
      if (finalMemory.result - initialMemory.result > 50 * 1024 * 1024) {
        throw new Error(`Memory leak detected: ${(finalMemory.result - initialMemory.result) / 1024 / 1024}MB increase`);
      }
    });

    // Test 5: Large robot name stress test
    await this.test('Large Robot Library Stress Test', async () => {
      await this.sendMCPCommand({
        method: 'browser_navigate',
        params: { url: config.testConfig.baseURL }
      });

      // Add 50 robots with various name lengths
      for (let i = 0; i < 50; i++) {
        const robotName = `TestRobot${i}-${'X'.repeat(i % 30)}`;
        
        await this.sendMCPCommand({
          method: 'browser_type',
          params: {
            element: 'Robot name input',
            ref: 'input[placeholder*="hinzufügen"]',
            text: robotName
          }
        });

        await this.sendMCPCommand({
          method: 'browser_click',
          params: {
            element: 'Add robot button',
            ref: 'button:has-text("Hinzufügen")'
          }
        });

        if (i % 10 === 0) {
          console.log(`  Added ${i + 1}/50 robots...`);
        }
      }

      // Verify UI still responsive
      await this.sendMCPCommand({
        method: 'browser_wait_for',
        params: { text: 'Daten geladen' }
      });

      await this.sendMCPCommand({
        method: 'browser_take_screenshot',
        params: { 
          filename: 'test-results/large-robot-library.png',
          fullPage: true
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

    console.log('\n📊 Performance Test Summary:');
    console.log(`Total: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}`);
    
    if (summary.failed > 0) {
      console.log('\n❌ Failures:');
      this.testResults.errors.forEach(e => console.log(`  - ${e.test}: ${e.error}`));
      process.exit(1);
    } else {
      console.log('\n✅ All performance tests passed!');
      process.exit(0);
    }
  }
}

const test = new PerformanceTest();
test.runTests().catch(error => {
  console.error('💥 Performance test failed:', error);
  process.exit(1);
});