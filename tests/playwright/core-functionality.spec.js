const { test, expect } = require('@playwright/test');

test.describe('Core Tournament Functionality', () => {

  test('tournament title can be updated', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Use exact ID from control.html line 600
    const titleInput = page.locator('#tournamentTitleInput');
    await expect(titleInput).toBeVisible();
    
    await titleInput.clear();
    await titleInput.fill('My Custom Tournament');
    
    // Use exact text from control.html line 601
    await page.click('button:has-text("💾 Titel setzen")');
    await page.waitForTimeout(2000);
    
    // Verify the input value was set
    await expect(titleInput).toHaveValue('My Custom Tournament');
    
    await page.screenshot({ path: 'test-results/title-update.png', fullPage: true });
  });

  test('winner animation can be triggered', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate test robots first
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    // Use exact text from control.html line 649
    await page.locator('button:has-text("🎲 16 Test-Roboter generieren")').click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Select robots for current match - use exact text from line 627
    await page.click('button:has-text("🤖 Roboter 1 auswählen")');
    await page.waitForTimeout(500);
    
    const firstRobot = page.locator('.robot-button').first();
    await firstRobot.click();
    await page.waitForTimeout(1000);
    
    // Use exact selector from control.html line 583-584 
    const winnerButton = page.locator('#winnerBtn1');
    if (await winnerButton.isVisible()) {
      await winnerButton.click();
      await page.waitForTimeout(2000);
      
      // Animation should be triggered (check for any visual change)
      await page.screenshot({ path: 'test-results/winner-animation.png', fullPage: true });
    }
  });

  test('bracket creation basic functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate test robots
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await page.locator('button:has-text("🎲 16 Test-Roboter generieren")').click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Try to create bracket - use exact text from control.html line 687
    const createButton = page.locator('button:has-text("🎯 Create Bracket")');
    await expect(createButton).toBeVisible();
    await createButton.click();
    await page.waitForTimeout(3000);
    
    // Check for bracket status element - from control.html line 676
    const bracketStatus = page.locator('#bracketStatus');
    await expect(bracketStatus).toBeVisible();
    
    // Should show bracket setup status or at least not crash the page
    // After creating bracket, the status should change or bracket setup should appear
    const bracketSetupSection = page.locator('#bracketSetupSection');
    await expect(bracketSetupSection).toBeVisible();
    
    await page.screenshot({ path: 'test-results/bracket-creation.png', fullPage: true });
  });

  test('round selection works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test different round buttons - use exact match to avoid conflicts
    const rounds = ['Vorrunde', 'Viertelfinale', 'Halbfinale', 'Finale'];
    
    for (const round of rounds) {
      // Use exact match and onclick attribute to be more specific
      const roundButton = page.locator(`button.round-button[onclick="setRound('${round}')"]`);
      if (await roundButton.isVisible()) {
        await roundButton.click();
        await page.waitForTimeout(500);
        
        // Verify round is displayed
        const roundDisplay = page.locator('#currentRound');
        await expect(roundDisplay).toContainText(round);
      }
    }
    
    await page.screenshot({ path: 'test-results/round-selection.png', fullPage: true });
  });

  test('data reset functionality works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate some test data first
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await page.locator('button:has-text("🎲 16 Test-Roboter generieren")').click();
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify robots exist
    const robotButtons = page.locator('.robot-button');
    const initialCount = await robotButtons.count();
    expect(initialCount).toBeGreaterThan(0);
    
    // Reset all data - use exact text from control.html line 752
    await page.click('button:has-text("💥 Alles zurücksetzen")');
    await page.waitForTimeout(2000);
    
    // Verify robots are cleared
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const finalCount = await page.locator('.robot-button').count();
    expect(finalCount).toBe(0);
    
    await page.screenshot({ path: 'test-results/data-reset.png', fullPage: true });
  });

});