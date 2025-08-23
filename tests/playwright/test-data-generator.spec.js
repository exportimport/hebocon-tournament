const { test, expect } = require('@playwright/test');

test.describe('Test Data Generator Feature', () => {
  
  test('clean startup has no default robots', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify clean startup - no robots should be present
    const robotButtons = await page.locator('.robot-button').count();
    expect(robotButtons).toBe(0);
    
    // Take screenshot of clean state
    await page.screenshot({ path: 'test-results/clean-startup.png', fullPage: true });
  });

  test('test data generator button exists and is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if generate button exists
    const generateButton = page.locator('button:has-text("Test-Roboter generieren")');
    await expect(generateButton).toBeVisible();
    
    // Verify button styling and text
    await expect(generateButton).toContainText('16 Test-Roboter generieren');
  });

  test('generates exactly 16 test robots', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Handle confirmation dialog
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('16 Test-Roboter generiert');
      await dialog.accept();
    });
    
    // Click generate button
    const generateButton = page.locator('button:has-text("Test-Roboter generieren")');
    await generateButton.click();
    
    // Wait for generation and page refresh
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify exactly 16 robots were created
    const robotCount = await page.locator('.robot-button').count();
    expect(robotCount).toBe(16);
    
    // Take screenshot of generated robots
    await page.screenshot({ path: 'test-results/generated-robots.png', fullPage: true });
  });

  test('generates correct robot names', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate test robots first
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check for specific expected robot names
    const expectedRobots = [
      'Wackel-Bot 3000',
      'Chaos-Maschine', 
      'Crash-Dummy',
      'Shake-n-Break'
    ];
    
    for (const robotName of expectedRobots) {
      const robotButton = page.locator(`button:has-text("${robotName}")`);
      await expect(robotButton).toBeVisible();
    }
    
    // Get all robot names for verification
    const allRobotNames = await page.locator('.robot-button').allTextContents();
    
    // Verify we have creative Hebocon-style names
    expect(allRobotNames.some(name => name.includes('Bot'))).toBe(true);
    expect(allRobotNames.some(name => name.includes('Maschine'))).toBe(true);
    expect(allRobotNames.some(name => name.includes('Dummy'))).toBe(true);
  });

  test('API endpoint returns correct data', async ({ request }) => {
    // Test the generate API endpoint directly
    const response = await request.post('/api/robots/generate-test-data');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.robots).toHaveLength(16);
    expect(data.message).toContain('16 Test-Roboter generiert');
    
    // Verify some specific robot names in API response
    expect(data.robots).toContain('Wackel-Bot 3000');
    expect(data.robots).toContain('Chaos-Maschine');
    expect(data.robots).toContain('Crash-Dummy');
    expect(data.robots).toContain('Shake-n-Break');
  });

  test('can create bracket with generated robots', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate robots first
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Try to create bracket
    const createBracketBtn = page.locator('button:has-text("Create Bracket")');
    if (await createBracketBtn.isVisible()) {
      await createBracketBtn.click();
      await page.waitForTimeout(1000);
      
      // Try random assignment
      const randomBtn = page.locator('button:has-text("Random Assignment")');
      if (await randomBtn.isVisible()) {
        await randomBtn.click();
        await page.waitForTimeout(2000);
        
        // Verify bracket positions were filled
        const filledPositions = await page.locator('.bracket-position.filled').count();
        expect(filledPositions).toBeGreaterThan(0);
        
        // Take screenshot of bracket with test robots
        await page.screenshot({ path: 'test-results/bracket-with-test-robots.png', fullPage: true });
      }
    }
  });

  test('robot selection works with generated robots', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate robots first
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait for robots to be loaded
    await page.waitForTimeout(1000);
    
    // Select robot slot 1
    await page.click('button:has-text("Roboter 1 auswählen")');
    await page.waitForTimeout(1000);
    
    // Click first generated robot with proper wait
    const firstRobot = page.locator('.robot-button').first();
    await expect(firstRobot).toBeVisible({ timeout: 10000 });
    
    const robotName = await firstRobot.textContent();
    await firstRobot.click();
    
    await page.waitForTimeout(1500);
    
    // Verify robot appears in current match display
    const currentRobot1 = page.locator('#currentRobot1');
    if (await currentRobot1.isVisible()) {
      await expect(currentRobot1).toContainText(robotName, { timeout: 5000 });
    }
  });

  test('multiple generations replace previous robots', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Handle all dialogs
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    // First generation
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    let robotCount = await page.locator('.robot-button').count();
    expect(robotCount).toBe(16);
    
    // Second generation (should replace, not add)
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    robotCount = await page.locator('.robot-button').count();
    expect(robotCount).toBe(16); // Still 16, not 32
  });

});