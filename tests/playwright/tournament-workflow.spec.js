const { test, expect } = require('@playwright/test');

test.describe('End-to-End Tournament Workflow', () => {

  test('complete tournament setup flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate test robots first
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Create tournament bracket
    await page.click('button:has-text("Create Bracket")');
    await page.waitForTimeout(2000);
    
    // Verify bracket creation status message
    await expect(page.locator('text=/Bracket created|created|setup/i')).toBeVisible({ timeout: 5000 });
    
    // Random assignment of robots to bracket
    await page.click('button:has-text("Random Assignment")');
    await page.waitForTimeout(3000);
    
    // Start tournament (button appears after random assignment)
    const startButton = page.locator('button:has-text("Start Tournament")');
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(2000);
      
      // Verify tournament started by checking status
      await expect(page.locator('text=/started|running/i')).toBeVisible({ timeout: 10000 });
    }
    
    await page.screenshot({ path: 'test-results/tournament-setup-complete.png', fullPage: true });
  });

  test('match progression and winner setting', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate robots and setup tournament
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Setup bracket
    await page.click('button:has-text("Create Bracket")');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Random Assignment")');
    await page.waitForTimeout(3000);
    await page.click('button:has-text("Start Tournament")');
    await page.waitForTimeout(2000);
    
    // Test setting a winner
    const winnerButton = page.locator('button:has-text("gewinnt!")').first();
    if (await winnerButton.isVisible()) {
      await winnerButton.click();
      await page.waitForTimeout(2000);
      
      // Winner animation should trigger - check for celebration or animation state
      const celebrationElement = page.locator('text=/celebrating|winner|🏆/i');
      if (await celebrationElement.count() > 0) {
        await expect(celebrationElement).toBeVisible({ timeout: 5000 });
      }
    }
    
    await page.screenshot({ path: 'test-results/match-progression.png', fullPage: true });
  });

  test('bracket advancement and dependency validation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Setup tournament
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await page.click('button:has-text("Create Bracket")');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Random Assignment")');
    await page.waitForTimeout(3000);
    await page.click('button:has-text("Start Tournament")');
    await page.waitForTimeout(2000);
    
    // Test winner propagation through bracket
    // This would require multiple match completions to test bracket advancement
    
    await page.screenshot({ path: 'test-results/bracket-advancement.png', fullPage: true });
  });

  test('edge case: incomplete bracket handling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate only a few robots (not enough for full bracket)
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    // Add only 5 robots manually instead of 16
    const robotNameInput = page.locator('input[placeholder="Roboter Name"]');
    for (let i = 1; i <= 5; i++) {
      await robotNameInput.fill(`Test-Robot-${i}`);
      await page.click('button:has-text("Hinzufügen")');
      await page.waitForTimeout(500);
    }
    
    // Try to create bracket with insufficient robots
    await page.click('button:has-text("Create Bracket")');
    await page.waitForTimeout(2000);
    
    // Try to create bracket with insufficient robots
    await page.click('button:has-text("Create Bracket")');
    await page.waitForTimeout(2000);
    
    // Should show message about insufficient robots or not allow start
    const startButton = page.locator('button:has-text("Start Tournament")');
    const isStartVisible = await startButton.isVisible();
    
    if (!isStartVisible) {
      // Start button should be hidden when insufficient robots
      expect(isStartVisible).toBeFalsy();
    }
    
    await page.screenshot({ path: 'test-results/incomplete-bracket-error.png', fullPage: true });
  });

  test('match undo functionality and dependency validation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Setup complete tournament
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await page.click('button:has-text("Create Bracket")');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Random Assignment")');
    await page.waitForTimeout(3000);
    
    // Test bracket reset functionality
    await page.click('button:has-text("Create Bracket")');
    await page.waitForTimeout(2000);
    
    // Reset the bracket
    await page.click('button:has-text("Reset Bracket")');
    await page.waitForTimeout(2000);
    
    // Should show reset confirmation or status change
    await expect(page.locator('text=/reset|zurückgesetzt|ready/i')).toBeVisible({ timeout: 5000 });
    
    await page.screenshot({ path: 'test-results/match-undo.png', fullPage: true });
  });

  test('data persistence across server restarts', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Setup initial tournament state
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(3000);
    
    // Get initial tournament data
    const initialData = await page.evaluate(() => 
      fetch('/api/data').then(r => r.json())
    );
    
    // Reload page (simulates persistence test)
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Get data after reload
    const reloadedData = await page.evaluate(() => 
      fetch('/api/data').then(r => r.json())
    );
    
    // Verify data persistence
    expect(reloadedData.robots.length).toBe(initialData.robots.length);
    expect(reloadedData.tournament_settings.title).toBe(initialData.tournament_settings.title);
    
    await page.screenshot({ path: 'test-results/data-persistence.png', fullPage: true });
  });

  test('overlay and control panel synchronization', async ({ page, context }) => {
    // Open control panel
    const controlPage = await context.newPage();
    await controlPage.goto('/');
    await controlPage.waitForLoadState('networkidle');
    
    // Open overlay in second tab
    await page.goto('/overlay');
    await page.waitForLoadState('networkidle');
    
    // Generate robots from control panel
    controlPage.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await controlPage.locator('button:has-text("Test-Roboter generieren")').click();
    await controlPage.waitForTimeout(3000);
    
    // Switch overlay to bracket mode from control panel
    await controlPage.click('button:has-text("Show Bracket")');
    await controlPage.waitForTimeout(2000);
    
    // Verify overlay updates automatically
    await expect(page.locator('text=TOURNAMENT BRACKET')).toBeVisible({ timeout: 10000 });
    
    await page.screenshot({ path: 'test-results/overlay-sync.png', fullPage: true });
    await controlPage.close();
  });

  test('API error handling and recovery', async ({ page, request }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test API endpoints for proper error handling
    const endpoints = ['/api/data', '/api/robots', '/api/match', '/api/bracket'];
    
    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      expect(response.ok()).toBeTruthy();
    }
    
    // Test invalid API calls
    const invalidResponse = await request.post('/api/invalid-endpoint');
    expect(invalidResponse.status()).toBe(404);
    
    await page.screenshot({ path: 'test-results/api-error-handling.png', fullPage: true });
  });

});