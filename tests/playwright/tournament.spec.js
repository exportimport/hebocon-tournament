const { test, expect } = require('@playwright/test');

test.describe('Hebocon Tournament Server', () => {
  
  test('control panel loads correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check if main elements are present
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=Roboter 1 auswählen')).toBeVisible();
    await expect(page.locator('text=Roboter 2 auswählen')).toBeVisible();
    
    // Take screenshot for visual verification
    await page.screenshot({ path: 'test-results/control-panel.png', fullPage: true });
  });

  test('overlay loads correctly', async ({ page }) => {
    await page.goto('/overlay');
    
    // Check if overlay elements are present
    await expect(page.locator('body')).toBeVisible();
    
    // Wait for tournament title to load
    await expect(page.locator('text=HEBOCON 2025')).toBeVisible({ timeout: 10000 });
    
    // Check for VS element in match display
    await expect(page.locator('text=VS')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/overlay.png', fullPage: true });
  });

  test('API endpoints respond correctly', async ({ request }) => {
    // Test main API endpoint
    const response = await request.get('/api/data');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('robots');
    expect(data).toHaveProperty('current_match');
    expect(data).toHaveProperty('tournament_settings');
  });

  test('robot selection works', async ({ page }) => {
    await page.goto('/');
    
    // Click robot 1 slot
    await page.click('button:has-text("Roboter 1 auswählen")');
    
    // Verify slot 1 is selected (should have warning/active class)
    await expect(page.locator('button:has-text("Roboter 1 auswählen")')).toHaveClass(/btn-warning/);
    
    // Click a robot from the library
    await page.click('button:has-text("Chaos-Maschine")');
    
    // Wait for selection to be processed
    await page.waitForTimeout(1000);
    
    // Take screenshot of selection state
    await page.screenshot({ path: 'test-results/robot-selection.png', fullPage: true });
  });

  test('timer functionality works', async ({ page }) => {
    await page.goto('/');
    
    // Start the timer
    await page.click('button:has-text("Start")');
    
    // Wait a moment for timer to start
    await page.waitForTimeout(2000);
    
    // Check if timer display has changed from initial 02:00
    const timerText = await page.textContent('.timer-display');
    expect(timerText).toMatch(/\d{2}:\d{2}/);
    
    // Pause timer
    await page.click('button:has-text("Pause")');
    
    // Reset timer
    await page.click('button:has-text("Reset")');
  });

  test('overlay display mode switching', async ({ page, context }) => {
    // Open control panel
    const controlPage = await context.newPage();
    await controlPage.goto('/');
    
    // Open overlay
    await page.goto('/overlay');
    
    // Verify match mode is default
    await expect(page.locator('text=VS')).toBeVisible();
    
    // Switch to bracket mode from control panel
    await controlPage.click('button:has-text("Show Bracket")');
    
    // Wait for overlay to update and show bracket
    await expect(page.locator('text=TOURNAMENT BRACKET')).toBeVisible({ timeout: 10000 });
    
    // Take screenshot of bracket view
    await page.screenshot({ path: 'test-results/overlay-bracket.png', fullPage: true });
    
    await controlPage.close();
  });

  test('keyboard shortcuts work', async ({ page }) => {
    await page.goto('/');
    
    // Test keyboard shortcut '1' for robot slot 1
    await page.keyboard.press('1');
    await expect(page.locator('button:has-text("Roboter 1 auswählen")')).toHaveClass(/btn-warning/);
    
    // Test keyboard shortcut '2' for robot slot 2  
    await page.keyboard.press('2');
    await expect(page.locator('button:has-text("Roboter 2 auswählen")')).toHaveClass(/btn-warning/);
  });

  test('data persistence across page reloads', async ({ page }) => {
    await page.goto('/');
    
    // Get initial data
    const initialResponse = await page.evaluate(() => 
      fetch('/api/data').then(r => r.json())
    );
    
    // Reload the page
    await page.reload();
    
    // Wait for page to load
    await expect(page.locator('text=Daten geladen')).toBeVisible();
    
    // Get data after reload
    const reloadResponse = await page.evaluate(() => 
      fetch('/api/data').then(r => r.json())
    );
    
    // Verify key data matches
    expect(reloadResponse.current_match.robot1).toBe(initialResponse.current_match.robot1);
    expect(reloadResponse.current_match.robot2).toBe(initialResponse.current_match.robot2);
  });

});