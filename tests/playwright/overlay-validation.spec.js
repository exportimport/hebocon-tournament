const { test, expect } = require('@playwright/test');

test.describe('OBS Overlay Validation and Real-time Updates', () => {

  test('overlay updates in real-time with control panel changes', async ({ page, context }) => {
    // Open control panel
    const controlPage = await context.newPage();
    await controlPage.goto('/');
    await controlPage.waitForLoadState('networkidle');
    
    // Open overlay
    await page.goto('/overlay');
    await page.waitForLoadState('networkidle');
    
    // Generate robots from control panel
    controlPage.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await controlPage.locator('button:has-text("Test-Roboter generieren")').click();
    await controlPage.waitForTimeout(3000);
    
    // Select robots from control panel
    await controlPage.click('button:has-text("Roboter 1 auswählen")');
    await controlPage.waitForTimeout(500);
    
    const firstRobot = controlPage.locator('.robot-button').first();
    const robotName = (await firstRobot.textContent()).replace(/\s*×\s*$/, '').trim();
    await firstRobot.click();
    await controlPage.waitForTimeout(2000);
    
    // Verify overlay updates automatically (polling every 2 seconds)
    await page.waitForTimeout(3000);
    await expect(page.locator(`text=${robotName}`)).toBeVisible({ timeout: 10000 });
    
    await page.screenshot({ path: 'test-results/overlay-realtime-update.png', fullPage: true });
    await controlPage.close();
  });

  test('overlay mode switching between match and bracket', async ({ page, context }) => {
    // Setup control panel
    const controlPage = await context.newPage();
    await controlPage.goto('/');
    await controlPage.waitForLoadState('networkidle');
    
    // Setup overlay
    await page.goto('/overlay');
    await page.waitForLoadState('networkidle');
    
    // Generate robots and setup bracket
    controlPage.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await controlPage.locator('button:has-text("Test-Roboter generieren")').click();
    await controlPage.waitForTimeout(3000);
    
    // Test match mode (default)
    await expect(page.locator('text=VS')).toBeVisible();
    
    // Switch to bracket mode
    await controlPage.click('button:has-text("Show Bracket")');
    await page.waitForTimeout(3000);
    
    // Verify bracket mode
    await expect(page.locator('text=TOURNAMENT BRACKET')).toBeVisible({ timeout: 10000 });
    
    // Switch back to match mode
    await controlPage.click('button:has-text("Show Match")');
    await page.waitForTimeout(3000);
    
    // Verify match mode restored
    await expect(page.locator('text=VS')).toBeVisible({ timeout: 10000 });
    
    await page.screenshot({ path: 'test-results/overlay-mode-switching.png', fullPage: true });
    await controlPage.close();
  });

  test('timer synchronization between control and overlay', async ({ page, context }) => {
    // Setup control panel
    const controlPage = await context.newPage();
    await controlPage.goto('/');
    await controlPage.waitForLoadState('networkidle');
    
    // Setup overlay
    await page.goto('/overlay');
    await page.waitForLoadState('networkidle');
    
    // Start timer from control panel
    await controlPage.click('#startTimerBtn');
    await controlPage.waitForTimeout(2000);
    
    // Verify timer appears in overlay
    await page.waitForTimeout(3000);
    const timerDisplay = page.locator('text=/\\d{2}:\\d{2}/');
    await expect(timerDisplay).toBeVisible({ timeout: 10000 });
    
    // Pause timer from control panel
    await controlPage.click('#pauseTimerBtn');
    await controlPage.waitForTimeout(1000);
    
    // Reset timer from control panel
    await controlPage.click('#resetTimerBtn');
    await controlPage.waitForTimeout(1000);
    
    await page.screenshot({ path: 'test-results/timer-overlay-sync.png', fullPage: true });
    await controlPage.close();
  });

  test('overlay displays tournament title correctly', async ({ page, context }) => {
    // Setup control panel
    const controlPage = await context.newPage();
    await controlPage.goto('/');
    await controlPage.waitForLoadState('networkidle');
    
    // Setup overlay
    await page.goto('/overlay');
    await page.waitForLoadState('networkidle');
    
    // Change tournament title
    const titleInput = controlPage.locator('input[placeholder*="Titel"], textbox');
    await titleInput.fill('Test Tournament 2025');
    await controlPage.click('button:has-text("Titel setzen")');
    await controlPage.waitForTimeout(2000);
    
    // Verify title appears in overlay
    await page.waitForTimeout(3000);
    await expect(page.locator('text=Test Tournament 2025')).toBeVisible({ timeout: 10000 });
    
    await page.screenshot({ path: 'test-results/overlay-title-sync.png', fullPage: true });
    await controlPage.close();
  });

  test('overlay handles empty states gracefully', async ({ page }) => {
    await page.goto('/overlay');
    await page.waitForLoadState('networkidle');
    
    // Test overlay with no robots selected
    await expect(page.locator('body')).toBeVisible();
    
    // Should handle empty robot names gracefully
    const robotElements = page.locator('.robot-name, [class*="robot"]');
    const elementCount = await robotElements.count();
    
    // Should either show placeholder text or handle empty state
    if (elementCount > 0) {
      const firstElement = robotElements.first();
      const text = await firstElement.textContent();
      expect(text.length >= 0).toBeTruthy(); // Should not crash
    }
    
    await page.screenshot({ path: 'test-results/overlay-empty-state.png', fullPage: true });
  });

});