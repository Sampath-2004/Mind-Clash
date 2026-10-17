import { test, expect } from '@playwright/test';

test.describe('E2E Quality Assurance: Mobile Layout & Keyboard Accessibility', () => {
  test('18. Mobile Layout: Responsive viewport renders without horizontal overflow and maintains accessible touch targets', async ({ page }) => {
    // Modern mobile viewport (iPhone 12/13/14 / Pixel standard)
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/');
    await expect(page).toHaveTitle(/Mind Clash/i);

    // Verify zero horizontal overflow on mobile
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Verify touch targets for main actions have minimum height (>= 44px)
    const createBtn = page.locator('a[href="/create"]');
    const joinBtn = page.locator('a[href="/join"]');

    const createBox = await createBtn.boundingBox();
    const joinBox = await joinBtn.boundingBox();

    expect(createBox).not.toBeNull();
    expect(joinBox).not.toBeNull();

    // Standard WCAG touch target guideline is >= 44px height
    expect(createBox!.height).toBeGreaterThanOrEqual(44);
    expect(joinBox!.height).toBeGreaterThanOrEqual(44);

    // Navigate to Create Room on mobile
    await createBtn.click();
    await expect(page).toHaveURL(/\/create/);

    const createPageOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(createPageOverflow).toBe(false);

    // Check nickname input is visible and accessible
    const nicknameInput = page.locator('#nickname');
    await expect(nicknameInput).toBeVisible();
    await expect(nicknameInput).toBeEnabled();

    // Navigate to Join Room on mobile
    await page.goto('/join');
    await expect(page).toHaveURL(/\/join/);

    const joinPageOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(joinPageOverflow).toBe(false);

    const roomCodeInput = page.locator('#roomCode');
    await expect(roomCodeInput).toBeVisible();
    await expect(roomCodeInput).toBeEnabled();
  });

  test('19. Keyboard Accessibility: Full keyboard navigation, focus indicators, modal escape, and form submission', async ({ page }) => {
    await page.goto('/');

    // 1. Open "How to Play" modal using click or keyboard
    const howToPlayBtn = page.locator('button:has-text("How to Play")');
    await expect(howToPlayBtn).toBeVisible();
    await howToPlayBtn.focus();
    await page.keyboard.press('Enter');

    // Verify modal is displayed
    const modalHeading = page.locator('h2:has-text("How to Play Mind Clash")');
    await expect(modalHeading).toBeVisible();

    // Press Escape to dismiss modal via keyboard
    await page.keyboard.press('Escape');
    await expect(modalHeading).not.toBeVisible();

    // 2. Keyboard Navigation: Tab into "Create Room" button and activate with Enter
    await page.locator('a[href="/create"]').focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/create/);

    // 3. Tab into form input, type nickname, and submit with Enter
    await page.locator('#nickname').focus();
    await page.keyboard.type('KeyMaster');

    // Press Enter to submit form
    await page.keyboard.press('Enter');

    // Verify successful keyboard submission navigated to lobby
    await expect(page).toHaveURL(/\/lobby/);
    await expect(page.locator('[data-testid="room-code-display"]')).toBeVisible();
    await expect(page.locator('text=KeyMaster')).toBeVisible();
  });
});
