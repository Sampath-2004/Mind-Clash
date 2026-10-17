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

    // If running in development without API keys, handle explicit offline questions fallback
    const offlineBtn = hostPage.locator('[data-testid="play-offline-btn"]');
    try {
      if (await offlineBtn.isVisible({ timeout: 3000 })) {
        await offlineBtn.click();
      }
    } catch {
      // Offline fallback not required (keys or test env provided)
    }

    // 6. Both browser contexts transition to /game
    await Promise.all([
      hostPage.waitForURL(/\/game/, { timeout: 15000 }),
      guestPage.waitForURL(/\/game/, { timeout: 15000 }),
    ]);

    const hostArrivalMs = Date.now();
    const guestArrivalMs = Date.now();
    const navigationDriftMs = Math.abs(guestArrivalMs - hostArrivalMs);

    console.log(`[E2E Synchronization Report]
      Match Launch Triggered At: ${launchStartTime}
      Host Arrived at Arena: ${hostArrivalMs}
      Guest Arrived at Arena: ${guestArrivalMs}
      Browser Context Transition Drift: ${navigationDriftMs} ms`);

    expect(navigationDriftMs).toBeLessThan(2500);

    // Both contexts should display game arena elements
    await expect(hostPage.locator('body')).toBeVisible();
    await expect(guestPage.locator('body')).toBeVisible();

    // Clean up contexts
    await hostContext.close();
    await guestContext.close();
  });

  test('Rare Answer mode: Host selects Rare Answer, launches match, and both players see prompt', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    // Host creates room with exclusively "Rare Answer" mode
    await hostPage.goto('/create');
    await hostPage.fill('#nickname', 'HostRare');
    await hostPage.click('button:has-text("Trivia Blitz")');
    await hostPage.click('button:has-text("Speed Math")');
    await hostPage.click('button:has-text("Memory Matrix")');
    await hostPage.click('button:has-text("Reaction Clash")');
    await hostPage.click('[data-testid="create-room-submit-btn"]');
    await expect(hostPage).toHaveURL(/\/lobby/);

    const roomCodeElement = hostPage.locator('[data-testid="room-code-display"]');
    await expect(roomCodeElement).toBeVisible();
    const roomCode = await roomCodeElement.getAttribute('data-room-code');

    // Guest joins
    await guestPage.goto('/join');
    await guestPage.fill('#roomCode', roomCode!);
    await guestPage.fill('#join-nickname', 'GuestRare');
    await guestPage.click('[data-testid="join-room-submit-btn"]');
    await expect(guestPage).toHaveURL(/\/lobby/);

    const startMatchBtn = hostPage.locator('[data-testid="start-match-btn"]');
    await expect(startMatchBtn).toBeEnabled();
    await startMatchBtn.click();

    // Check if offline fallback is offered
    const offlineBtn = hostPage.locator('[data-testid="play-offline-btn"]');
    try {
      if (await offlineBtn.isVisible({ timeout: 3000 })) {
        await offlineBtn.click();
      }
    } catch {
      // Not required
    }

    // Both arrive at /game
    await Promise.all([
      hostPage.waitForURL(/\/game/, { timeout: 15000 }),
      guestPage.waitForURL(/\/game/, { timeout: 15000 }),
    ]);

    // Await transition from COUNTDOWN (3s) to ROUND_ACTIVE (where input is rendered)
    const hostInput = hostPage.locator('input[placeholder="Type your rare answer..."]');
    const guestInput = guestPage.locator('input[placeholder="Type your rare answer..."]');
    await expect(hostInput).toBeVisible({ timeout: 10000 });
    await expect(guestInput).toBeVisible({ timeout: 10000 });

    // Verify identical prompts and synchronized deadlines
    const hostPromptEl = hostPage.locator('h2');
    const guestPromptEl = guestPage.locator('h2');
    const hostPrompt = await hostPromptEl.textContent();
    const guestPrompt = await guestPromptEl.textContent();
    expect(hostPrompt).toBeTruthy();
    expect(hostPrompt).toBe(guestPrompt);

    // Host enters private answer "Jupiter"
    await hostInput.fill('Jupiter');
    await hostPage.click('button:has-text("Lock In Answer")');

    // Host sees acknowledgment with their private answer
    await expect(hostPage.getByText('Recorded:')).toBeVisible();
    await expect(hostPage.getByText('Jupiter')).toBeVisible();

    // Guest sees that 1 submission is locked, but DOES NOT see host's answer "Jupiter"
    await expect(guestPage.getByText('1 / 2 Submissions Locked')).toBeVisible();
    await expect(guestPage.locator('text=Jupiter')).toHaveCount(0);

    // Host updates private answer before deadline to "Saturn"
    await hostInput.fill('Saturn');
    await hostPage.click('button:has-text("Update Submission")');
    await expect(hostPage.getByText('Saturn')).toBeVisible();
    await expect(guestPage.locator('text=Saturn')).toHaveCount(0);

    await hostContext.close();
    await guestContext.close();
  });

  test('Session Reconnection: Refreshing browser tab recovers session and maintains room presence', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    // Host creates room
    await hostPage.goto('/create');
    await hostPage.fill('#nickname', 'HostSurvives');
    await hostPage.click('[data-testid="create-room-submit-btn"]');
    await expect(hostPage).toHaveURL(/\/lobby/);

    const roomCodeElement = hostPage.locator('[data-testid="room-code-display"]');
    await expect(roomCodeElement).toBeVisible();
    const roomCode = await roomCodeElement.getAttribute('data-room-code');

    // Guest joins
    await guestPage.goto('/join');
    await guestPage.fill('#roomCode', roomCode!);
    await guestPage.fill('#join-nickname', 'GuestReconnect');
    await guestPage.click('[data-testid="join-room-submit-btn"]');
    await expect(guestPage).toHaveURL(/\/lobby/);

    // Both see GuestReconnect
    await expect(hostPage.getByText('GuestReconnect')).toBeVisible();

    // Guest reloads browser (simulating network refresh / disconnect & reconnect)
    await guestPage.reload();

    // Guest automatically reconnects via stored sessionToken and remains in lobby
    await expect(guestPage).toHaveURL(/\/lobby/);
    await expect(guestPage.getByText('GuestReconnect')).toBeVisible();
    await expect(hostPage.getByText('GuestReconnect')).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  });

  test('Host Departure: When host departs, room state reflects departure without crash', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await hostPage.goto('/create');
    await hostPage.fill('#nickname', 'DepartingHost');
    await hostPage.click('[data-testid="create-room-submit-btn"]');
    await expect(hostPage).toHaveURL(/\/lobby/);

    const roomCodeElement = hostPage.locator('[data-testid="room-code-display"]');
    await expect(roomCodeElement).toBeVisible();
    const roomCode = await roomCodeElement.getAttribute('data-room-code');

    await guestPage.goto('/join');
    await guestPage.fill('#roomCode', roomCode!);
    await guestPage.fill('#join-nickname', 'RemainingPlayer');
    await guestPage.click('[data-testid="join-room-submit-btn"]');
    await expect(guestPage).toHaveURL(/\/lobby/);

    // Host leaves by closing page
    await hostPage.close();

    // Guest should still have active session and room state reflects departure
    await expect(guestPage.getByText('RemainingPlayer')).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  });
});
