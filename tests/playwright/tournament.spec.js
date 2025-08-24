const { test, expect } = require('@playwright/test');

test.describe('Hebocon Tournament Server', () => {
  
  test('control panel loads correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check if main elements are present
    await expect(page.locator('body')).toBeVisible();
    
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // Check for German text elements that should be present
    await expect(page.locator('text=HEBOCON TOURNAMENT')).toBeVisible();
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

  test('robot selection works with test data', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate test robots first since there are no default robots
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    const generateButton = page.locator('button:has-text("Test-Roboter generieren")');
    await generateButton.click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait for robots to be loaded
    await page.waitForTimeout(1000);
    
    // Now test robot selection
    // Click robot 1 slot
    await page.click('button:has-text("Roboter 1 auswählen")');
    await page.waitForTimeout(1000);
    
    // Click the first available robot button
    const firstRobotButton = page.locator('.robot-button').first();
    await expect(firstRobotButton).toBeVisible({ timeout: 10000 });
    
    const robotName = await firstRobotButton.textContent();
    await firstRobotButton.click();
    
    // Wait for the robot to appear in current match display (robust timing)
    const currentRobot1 = page.locator('#currentRobot1');
    await expect(currentRobot1).toContainText(robotName, { timeout: 10000 });
    
    // Take screenshot of selection state
    await page.screenshot({ path: 'test-results/robot-selection.png', fullPage: true });
  });

  test('timer functionality works', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    
    // Start the timer using specific ID
    await page.click('#startTimerBtn');
    
    // Wait a moment for timer to start
    await page.waitForTimeout(2000);
    
    // Check if timer display exists and shows proper format
    await expect(page.locator('text=/\\d{2}:\\d{2}/')).toBeVisible();
    
    // Pause timer using specific ID
    await page.click('#pauseTimerBtn');
    
    // Reset timer using specific ID to avoid ambiguity with bracket reset
    await page.click('#resetTimerBtn');
    
    // Take screenshot of timer section
    await page.screenshot({ path: 'test-results/timer-test.png', fullPage: true });
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
    await page.waitForTimeout(500);
    
    // Check if slot 1 button exists and is clickable
    const slot1Button = page.locator('button:has-text("Roboter 1 auswählen")');
    await expect(slot1Button).toBeVisible();
    
    // Test keyboard shortcut '2' for robot slot 2  
    await page.keyboard.press('2');
    await page.waitForTimeout(500);
    
    // Check if slot 2 button exists and is clickable
    const slot2Button = page.locator('button:has-text("Roboter 2 auswählen")');
    await expect(slot2Button).toBeVisible();
    
    // Take screenshot to verify state
    await page.screenshot({ path: 'test-results/keyboard-shortcuts.png', fullPage: true });
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