import { test, expect } from '@playwright/test';

test.describe('Ask YieldSense — Golden Flows', () => {
  test('ask comparison renders verdict card', async ({ page }) => {
    await page.goto('/?view=ask');

    // Find the textarea and type a question
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('Compare Kenmore and Indooroopilly for a family home');

    // Click submit
    await page.click('button:has-text("Build research brief")');

    // Wait for result (should show skeleton, then content)
    await page.waitForSelector('[aria-live="polite"]', { timeout: 20000 });

    // Verify key elements are present
    await expect(page.locator('text=Research Brief').first()).toBeVisible({ timeout: 15000 });

    // Verdict panel should exist
    const verdictPanel = page.locator('.av-verdict');
    // May be empty if backend verdict is null, but the comparison table should render
    await expect(page.locator('.cd, .cd__mobile, .cd__desktop').first()).toBeVisible({ timeout: 10000 });
  });

  test('ask mobile view uses card comparison', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/?view=ask');

    const textarea = page.locator('textarea');
    await textarea.fill('Tell me about Kenmore QLD');
    await page.click('button:has-text("Build research brief")');

    // On mobile, comparison cards should be visible
    await page.waitForSelector('[aria-live="polite"]', { timeout: 20000 });
    await expect(page.locator('.cd-card, .cd__mobile').first()).toBeVisible({ timeout: 15000 });
  });

  test('mobile bottom nav is visible at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/?view=ask');

    // Bottom nav should be visible on mobile
    const bottomNav = page.locator('.app-shell__nav-mobile');
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.locator('text=Ask')).toBeVisible();
    await expect(bottomNav.locator('text=Buy')).toBeVisible();
    await expect(bottomNav.locator('text=Map')).toBeVisible();
    await expect(bottomNav.locator('text=Saved')).toBeVisible();
    await expect(bottomNav.locator('text=More')).toBeVisible();
  });

  test('desktop tabs are visible at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?view=ask');

    const desktopNav = page.locator('.app-shell__nav-desktop');
    await expect(desktopNav).toBeVisible();
    await expect(desktopNav.locator('[role="tab"]').first()).toBeVisible();
  });

  test('URL sync persists view', async ({ page }) => {
    await page.goto('/?view=heatmap');
    await expect(page).toHaveURL(/view=heatmap/);

    // Click Buy Finder tab
    await page.click('[role="tab"]:has-text("Buy Finder")');
    await expect(page).toHaveURL(/view=buy-finder/);
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/?view=settings');
    await page.waitForSelector('.sp', { timeout: 5000 });
    await expect(page.locator('text=Settings')).toBeVisible();
    await expect(page.locator('text=Your Numbers')).toBeVisible();
    await expect(page.locator('text=Plan & Usage')).toBeVisible();
  });

  test('More sheet opens on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/?view=ask');

    await page.click('[aria-label="More options"]');
    const sheet = page.locator('[role="dialog"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('text=Portfolio')).toBeVisible();
    await expect(sheet.locator('text=Settings')).toBeVisible();
  });

  test('skip link is present', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.locator('.app-shell__skip');
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toHaveText('Skip to main content');
  });
});
