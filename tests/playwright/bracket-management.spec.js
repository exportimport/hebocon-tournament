const { test, expect } = require('@playwright/test');

test.describe('Tournament Bracket Management', () => {

  test('bracket creation with manual robot assignment', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate test robots
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Create bracket
    await page.click('button:has-text("Create Bracket")');
    await page.waitForTimeout(2000);
    
    // Verify bracket setup appears
    await expect(page.locator('text=Bracket Setup (16 Robots)')).toBeVisible();
    
    // Test manual robot assignment to bracket positions
    const bracketSlots = page.locator('.bracket-slot');
    const robotButtons = page.locator('.robot-button');
    
    if (await bracketSlots.count() > 0 && await robotButtons.count() > 0) {
      // Click first bracket slot
      await bracketSlots.first().click();
      await page.waitForTimeout(500);
      
      // Click first robot to assign
      await robotButtons.first().click();
      await page.waitForTimeout(1000);
      
      // Verify assignment worked
      const assignedSlot = bracketSlots.first();
      const robotName = (await robotButtons.first().textContent()).replace(/\s*×\s*$/, '').trim();
      await expect(assignedSlot).toContainText(robotName, { timeout: 5000 });
    }
    
    await page.screenshot({ path: 'test-results/manual-bracket-assignment.png', fullPage: true });
  });

  test('random assignment fills all 16 positions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Setup with test robots
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await page.click('button:has-text("Create Bracket")');
    await page.waitForTimeout(2000);
    
    // Perform random assignment
    await page.click('button:has-text("Random Assignment")');
    await page.waitForTimeout(3000);
    
    // Verify all 16 positions are filled
    const filledSlots = page.locator('.bracket-slot:has-text(/\\w/)');
    const slotCount = await filledSlots.count();
    expect(slotCount).toBe(16);
    
    await page.screenshot({ path: 'test-results/random-assignment-complete.png', fullPage: true });
  });

  test('tournament start validation requires complete bracket', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Create bracket without full assignment
    await page.click('button:has-text("Create Bracket")');
    await page.waitForTimeout(2000);
    
    // Try to start tournament without complete setup
    const startButton = page.locator('button:has-text("Start Tournament")');
    const isVisible = await startButton.isVisible();
    
    if (isVisible) {
      await startButton.click();
      await page.waitForTimeout(1000);
      
      // Should show validation error
      await expect(page.locator('text=/insufficient|not.*enough|complete/i')).toBeVisible({ timeout: 5000 });
    } else {
      // Button should be hidden when bracket is incomplete
      expect(isVisible).toBeFalsy();
    }
    
    await page.screenshot({ path: 'test-results/incomplete-bracket-validation.png', fullPage: true });
  });

  test('bracket reset functionality', async ({ page }) => {
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
    
    // Reset bracket
    await page.click('button:has-text("Reset Bracket")');
    await page.waitForTimeout(2000);
    
    // Verify bracket is reset
    const emptyMessage = page.locator('text=/ready|empty|reset/i');
    await expect(emptyMessage).toBeVisible({ timeout: 5000 });
    
    await page.screenshot({ path: 'test-results/bracket-reset.png', fullPage: true });
  });

});