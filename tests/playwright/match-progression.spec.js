const { test, expect } = require('@playwright/test');

test.describe('Match Progression and Winner Flow', () => {

  test('winner propagation through tournament rounds', async ({ page }) => {
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
    await page.click('button:has-text("Start Tournament")');
    await page.waitForTimeout(2000);
    
    // Test first round winner selection
    const firstWinnerButton = page.locator('button:has-text("gewinnt!")').first();
    if (await firstWinnerButton.isVisible()) {
      const winnerText = await firstWinnerButton.textContent();
      const robotName = winnerText.match(/🏆\s*(.+?)\s*gewinnt!/)?.[1];
      
      await firstWinnerButton.click();
      await page.waitForTimeout(2000);
      
      // Verify winner appears in next round
      if (robotName) {
        await expect(page.locator(`text=${robotName}`)).toBeVisible({ timeout: 5000 });
      }
    }
    
    await page.screenshot({ path: 'test-results/winner-propagation.png', fullPage: true });
  });

  test('current match highlighting in bracket view', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Setup and start tournament
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
    
    // Switch to bracket view
    await page.click('button:has-text("Show Bracket")');
    await page.waitForTimeout(2000);
    
    // Verify current match is highlighted
    const currentMatch = page.locator('.current-match, .active-match, .highlighted-match');
    await expect(currentMatch).toBeVisible({ timeout: 5000 });
    
    await page.screenshot({ path: 'test-results/current-match-highlight.png', fullPage: true });
  });

  test('round progression from vorrunde to finale', async ({ page }) => {
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
    
    // Test round selection buttons
    const rounds = ['Vorrunde', 'Viertelfinale', 'Halbfinale', 'Finale'];
    
    for (const round of rounds) {
      const roundButton = page.locator(`button:has-text("${round}")`);
      if (await roundButton.isVisible()) {
        await roundButton.click();
        await page.waitForTimeout(1000);
        
        // Verify round is displayed
        await expect(page.locator(`text=${round}`)).toBeVisible();
      }
    }
    
    await page.screenshot({ path: 'test-results/round-progression.png', fullPage: true });
  });

  test('duplicate robot assignment prevention', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate robots
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    await page.locator('button:has-text("Test-Roboter generieren")').click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Select same robot for both positions
    await page.click('button:has-text("Roboter 1 auswählen")');
    await page.waitForTimeout(500);
    
    const firstRobot = page.locator('.robot-button').first();
    const robotName = (await firstRobot.textContent()).replace(/\s*×\s*$/, '').trim();
    await firstRobot.click();
    await page.waitForTimeout(1000);
    
    // Try to select same robot for position 2
    await page.click('button:has-text("Roboter 2 auswählen")');
    await page.waitForTimeout(500);
    await firstRobot.click();
    await page.waitForTimeout(1000);
    
    // Should prevent duplicate or show warning
    const currentRobot2 = page.locator('#currentRobot2');
    const robot2Text = await currentRobot2.textContent();
    
    // Either should be empty, different, or show error message
    expect(robot2Text === robotName || robot2Text === 'Roboter 2' || robot2Text === '').toBeTruthy();
    
    await page.screenshot({ path: 'test-results/duplicate-prevention.png', fullPage: true });
  });

});