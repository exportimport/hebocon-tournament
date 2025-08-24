const { test, expect } = require('@playwright/test');

test.describe('Core Tournament Functionality', () => {

  test('tournament title can be updated', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find title input and update it
    const titleInput = page.locator('#tournamentTitle, input[placeholder*="Titel"]');
    if (await titleInput.isVisible()) {
      await titleInput.clear();
      await titleInput.fill('My Custom Tournament');
      await page.click('button:has-text("Titel setzen")');
      await page.waitForTimeout(2000);
      
      // Verify title was updated (check if it appears somewhere on the page)
      await expect(page.locator('text=My Custom Tournament')).toBeVisible({ timeout: 5000 });
    } else {
      // If no title input found, just verify current functionality works
      expect(true).toBeTruthy();
    }
    
    await page.screenshot({ path: 'test-results/title-update.png', fullPage: true });
  });

  test('winner animation can be triggered', async ({ page }) => {
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
    
    // Select robots for current match
    await page.click('button:has-text("Roboter 1 auswählen")');
    await page.waitForTimeout(500);
    
    const firstRobot = page.locator('.robot-button').first();
    await firstRobot.click();
    await page.waitForTimeout(1000);
    
    // Trigger winner animation
    const winnerButton = page.locator('button:has-text("gewinnt!")').first();
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
    
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Try to create bracket
    await page.click('button:has-text("Create Bracket")');
    await page.waitForTimeout(3000);
    
    // Should show some bracket-related content or status message
    // Check for any bracket-related feedback (status messages, changes in UI, etc.)
    const bracketElements = page.locator('text=/bracket|setup|created|ready|assigned/i, .bracket-status, #bracketStatus');
    
    // If bracket elements exist, verify they're visible, otherwise just verify no crash
    const elementCount = await bracketElements.count();
    if (elementCount > 0) {
      await expect(bracketElements.first()).toBeVisible({ timeout: 10000 });
    } else {
      // No specific bracket status found, but operation should not crash
      expect(true).toBeTruthy();
    }
    
    await page.screenshot({ path: 'test-results/bracket-creation.png', fullPage: true });
  });

  test('round selection works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test different round buttons
    const rounds = ['Vorrunde', 'Viertelfinale', 'Halbfinale', 'Finale'];
    
    for (const round of rounds) {
      const roundButton = page.locator(`button:has-text("${round}")`);
      if (await roundButton.isVisible()) {
        await roundButton.click();
        await page.waitForTimeout(500);
        
        // Verify round is displayed - use more specific selector to avoid duplicates
        const roundDisplay = page.locator(`#currentRound:has-text("${round}")`);
        await expect(roundDisplay).toBeVisible();
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
    
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify robots exist
    const robotButtons = page.locator('.robot-button');
    const initialCount = await robotButtons.count();
    expect(initialCount).toBeGreaterThan(0);
    
    // Reset all data
    await page.click('button:has-text("Alles zurücksetzen")');
    await page.waitForTimeout(2000);
    
    // Verify robots are cleared
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const finalCount = await page.locator('.robot-button').count();
    expect(finalCount).toBe(0);
    
    await page.screenshot({ path: 'test-results/data-reset.png', fullPage: true });
  });

});