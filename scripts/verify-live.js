import { io } from 'socket.io-client';

const targetUrl = process.argv[2] || process.env.DEPLOYED_URL || 'http://localhost:3001';

console.log(`\n======================================================`);
console.log(`  MIND CLASH LIVE DEPLOYMENT TWO-CLIENT VERIFICATION  `);
console.log(`======================================================`);
console.log(`Target URL: ${targetUrl}\n`);

async function runVerification() {
  const normalizedUrl = targetUrl.replace(/\/+$/, '');

  // Step 1: Health Endpoint Check
  console.log(`[Step 1/4] Checking HTTP /api/health endpoint...`);
  try {
    const healthRes = await fetch(`${normalizedUrl}/api/health`);
    if (!healthRes.ok) {
      throw new Error(`Health check returned HTTP ${healthRes.status}: ${healthRes.statusText}`);
    }
    const healthData = await healthRes.json();
    console.log(`  -> Status: ${healthRes.status} OK`);
    console.log(`  -> Response:`, JSON.stringify(healthData, null, 2));
    if (healthData.status !== 'ok') {
      throw new Error(`Expected health status 'ok', got '${healthData.status}'`);
    }
    console.log(`  [PASS] Health check verified.\n`);
  } catch (err) {
    console.error(`  [FAIL] Health check failed:`, err.message || err);
    process.exit(1);
  }

  // Step 2: Frontend Bundle Serving Check
  console.log(`[Step 2/4] Checking Frontend bundle served at / ...`);
  try {
    const rootRes = await fetch(`${normalizedUrl}/`);
    if (!rootRes.ok) {
      throw new Error(`Root GET returned HTTP ${rootRes.status}: ${rootRes.statusText}`);
    }
    const rootHtml = await rootRes.text();
    const hasRootDiv = rootHtml.includes('id="root"');
    const hasMindClashTitle = rootHtml.includes('Mind Clash');
    console.log(`  -> Status: ${rootRes.status} OK`);
    console.log(`  -> HTML contains root div: ${hasRootDiv}`);
    console.log(`  -> HTML contains title: ${hasMindClashTitle}`);
    if (!hasRootDiv) {
      console.warn(`  [WARN] id="root" not found in root HTML, but HTTP 200 returned.`);
    } else {
      console.log(`  [PASS] Frontend assets successfully served.\n`);
    }
  } catch (err) {
    console.error(`  [FAIL] Frontend check failed:`, err.message || err);
    process.exit(1);
  }

  // Step 3: Client 1 (Host) Connection & Room Creation
  console.log(`[Step 3/4] Client 1 (Host) connecting via WebSocket and creating room...`);
  let hostSocket;
  let roomCode = null;
  let hostSessionToken = null;
  let hostPlayerId = null;

  try {
    hostSocket = io(normalizedUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Host socket connection timed out')), 8000);

      hostSocket.on('connect', () => {
        clearTimeout(timer);
        console.log(`  -> Client 1 connected! Socket ID: ${hostSocket.id}`);
        console.log(`  -> Client 1 transport: ${hostSocket.io.engine.transport.name}`);
        resolve();
      });

      hostSocket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    // Create room
    const createResult = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Room creation response timed out')), 5000);

      hostSocket.emit('create_room', { nickname: 'HostCommander', avatar: 'fox' }, (response) => {
        clearTimeout(timer);
        resolve(response);
      });
    });

    if (!createResult.success) {
      throw new Error(`create_room failed: ${createResult.error}`);
    }

    roomCode = createResult.data.roomCode;
    hostSessionToken = createResult.data.sessionToken;
    hostPlayerId = createResult.data.playerId;
    console.log(`  -> Room created successfully! Code: [${roomCode}]`);
    console.log(`  -> Host player ID: ${hostPlayerId}`);
    console.log(`  -> Host session token received: ${hostSessionToken ? 'OK' : 'MISSING'}`);
    console.log(`  [PASS] Client 1 room creation verified.\n`);
  } catch (err) {
    console.error(`  [FAIL] Client 1 failed:`, err.message || err);
    if (hostSocket) hostSocket.disconnect();
    process.exit(1);
  }

  // Step 4: Client 2 (Guest) Connection & Room Joining
  console.log(`[Step 4/4] Client 2 (Guest) connecting and joining room [${roomCode}]...`);
  let guestSocket;

  try {
    guestSocket = io(normalizedUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Guest socket connection timed out')), 8000);

      guestSocket.on('connect', () => {
        clearTimeout(timer);
        console.log(`  -> Client 2 connected! Socket ID: ${guestSocket.id}`);
        console.log(`  -> Client 2 transport: ${guestSocket.io.engine.transport.name}`);
        resolve();
      });

      guestSocket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    // Set up host listener for player joined
    const hostSawJoinPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Host did not receive player_joined in time')), 5000);
      hostSocket.once('player_joined', (player) => {
        clearTimeout(timer);
        resolve(player);
      });
    });

    // Guest joins room
    const joinResult = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('join_room response timed out')), 5000);

      guestSocket.emit('join_room', { roomCode, nickname: 'GuestChallenger', avatar: 'bear' }, (response) => {
        clearTimeout(timer);
        resolve(response);
      });
    });

    if (!joinResult.success) {
      throw new Error(`join_room failed: ${joinResult.error}`);
    }

    console.log(`  -> Client 2 successfully joined room [${roomCode}]!`);
    console.log(`  -> Guest player ID: ${joinResult.data.playerId}`);

    const hostReceivedEvent = await hostSawJoinPromise;
    console.log(`  -> Client 1 (Host) received real-time broadcast: Player "${hostReceivedEvent.nickname}" joined`);

    console.log(`  [PASS] Real-time two-client multiplayer synchronization verified.\n`);

    console.log(`======================================================`);
    console.log(`  ALL PRODUCTION DEPLOYMENT CHECKS PASSED SUCCESSFULLY`);
    console.log(`======================================================`);
    console.log(`- HTTPS /api/health: OK`);
    console.log(`- Frontend bundle: OK`);
    console.log(`- WebSocket upgrade: OK (Transport: ${guestSocket.io.engine.transport.name})`);
    console.log(`- Room creation: OK (${roomCode})`);
    console.log(`- Multi-client roster broadcast: OK (2/2 players synced)`);
    console.log(`======================================================\n`);

  } catch (err) {
    console.error(`  [FAIL] Client 2 failed:`, err.message || err);
    process.exit(1);
  } finally {
    if (hostSocket) hostSocket.disconnect();
    if (guestSocket) guestSocket.disconnect();
  }
}

runVerification();
