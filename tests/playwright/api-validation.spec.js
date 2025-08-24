const { test, expect } = require('@playwright/test');

test.describe('API Validation', () => {

  test('all main API endpoints respond correctly', async ({ request }) => {
    // Test core API endpoints that should always work
    const endpoints = [
      '/api/data',
      '/api/robots',
      '/api/match',
      '/api/timer',
      '/api/bracket',
      '/api/overlay/mode'
    ];
    
    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(typeof data).toBe('object');
    }
  });

  test('robot generation API works correctly', async ({ request }) => {
    // Test robot generation endpoint
    const response = await request.post('/api/robots/generate-test-data');
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result.success).toBeTruthy();
    expect(result.robots).toBeDefined();
    expect(result.robots.length).toBe(16);
  });

  test('robot management API functions', async ({ request }) => {
    // Add a robot
    const addResponse = await request.post('/api/robots', {
      data: { name: 'API-Test-Robot' }
    });
    expect(addResponse.ok()).toBeTruthy();
    
    // Get robots list
    const listResponse = await request.get('/api/robots');
    expect(listResponse.ok()).toBeTruthy();
    
    const robots = await listResponse.json();
    expect(Array.isArray(robots)).toBeTruthy();
    
    // Should contain our added robot
    const hasTestRobot = robots.some(robot => robot === 'API-Test-Robot');
    expect(hasTestRobot).toBeTruthy();
  });

  test('timer API responds correctly', async ({ request }) => {
    // Get timer status
    const response = await request.get('/api/timer');
    expect(response.ok()).toBeTruthy();
    
    const timer = await response.json();
    expect(timer).toHaveProperty('duration');
    expect(timer).toHaveProperty('is_running');
    expect(typeof timer.duration).toBe('number');
    expect(typeof timer.is_running).toBe('boolean');
  });

  test('match API handles current match data', async ({ request }) => {
    // Get current match
    const getResponse = await request.get('/api/match');
    expect(getResponse.ok()).toBeTruthy();
    
    const match = await getResponse.json();
    expect(match).toHaveProperty('robot1');
    expect(match).toHaveProperty('robot2');
    expect(match).toHaveProperty('round');
    
    // Update match
    const updateResponse = await request.post('/api/match', {
      data: {
        robot1: 'Test Robot 1',
        robot2: 'Test Robot 2',
        round: 'Testrunde'
      }
    });
    expect(updateResponse.ok()).toBeTruthy();
  });

});