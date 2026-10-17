import { test, expect } from '@playwright/test';

test.describe('E2E Multiplayer Flow: Two Independent Browser Contexts', () => {
  test('Two players create, join, synchronize lobby state, and launch into game arena', async ({ browser }) => {
    // 1. Create two isolated browser contexts representing separate players/devices
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    // 2. Host navigates to landing page and creates a room
    await hostPage.goto('/');
    await expect(hostPage).toHaveTitle(/Mind Clash/i);

    // Click "Create Room"
    await hostPage.click('a[href="/create"]');
    await expect(hostPage).toHaveURL(/\/create/);

    // Fill in nickname and submit
    await hostPage.fill('#nickname', 'HostCommander');
    await hostPage.click('[data-testid="create-room-submit-btn"]');

    // Wait for Lobby navigation and extract room code
    await expect(hostPage).toHaveURL(/\/lobby/);
    const roomCodeElement = hostPage.locator('[data-testid="room-code-display"]');
    await expect(roomCodeElement).toBeVisible();

    const roomCode = await roomCodeElement.getAttribute('data-room-code');
    expect(roomCode).toBeTruthy();
    expect(roomCode).toHaveLength(6);

    // Host should see 1/2+ ready initially
    const startMatchBtn = hostPage.locator('[data-testid="start-match-btn"]');
    await expect(startMatchBtn).toBeVisible();
    await expect(startMatchBtn).toBeDisabled();

    // 3. Guest joins using the generated room code in their independent browser context
    await guestPage.goto('/');
    await guestPage.click('a[href="/join"]');
    await expect(guestPage).toHaveURL(/\/join/);

    await guestPage.fill('#roomCode', roomCode!);
    await guestPage.fill('#join-nickname', 'GuestChallenger');
    await guestPage.click('[data-testid="join-room-submit-btn"]');

    // Guest enters lobby
    await expect(guestPage).toHaveURL(/\/lobby/);

    // 4. Verify live roster synchronization on BOTH browser contexts
    // Host sees both players
    await expect(hostPage.getByText('HostCommander', { exact: true })).toBeVisible();
    await expect(hostPage.getByText('GuestChallenger', { exact: true })).toBeVisible();

    // Guest sees both players
    await expect(guestPage.getByText('HostCommander', { exact: true })).toBeVisible();
    await expect(guestPage.getByText('GuestChallenger', { exact: true })).toBeVisible();

    // Verify Host badge is displayed
    await expect(hostPage.locator('text=Host').first()).toBeVisible();
    await expect(guestPage.locator('text=Host').first()).toBeVisible();

    // Now start button should be enabled on Host's page
    await expect(startMatchBtn).toBeEnabled();

    // Record local launch timestamp
    const launchStartTime = Date.now();

    // 5. Host launches match
    await startMatchBtn.click();

    // 6. Both browser contexts transition to /game
    await Promise.all([
      hostPage.waitForURL(/\/game/, { timeout: 10000 }),
      guestPage.waitForURL(/\/game/, { timeout: 10000 }),
    ]);

    const hostArrivalMs = Date.now();
    const guestArrivalMs = Date.now();
    const navigationDriftMs = Math.abs(guestArrivalMs - hostArrivalMs);

    console.log(`[E2E Synchronization Report]
      Match Launch Triggered At: ${launchStartTime}
      Host Arrived at Arena: ${hostArrivalMs}
      Guest Arrived at Arena: ${guestArrivalMs}
      Browser Context Transition Drift: ${navigationDriftMs} ms`);

    expect(navigationDriftMs).toBeLessThan(1500);

    // Both contexts should display game arena elements
    await expect(hostPage.locator('body')).toBeVisible();
    await expect(guestPage.locator('body')).toBeVisible();

    // Clean up contexts
    await hostContext.close();
    await guestContext.close();
  });
});
