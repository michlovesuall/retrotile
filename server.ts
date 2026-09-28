import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { mongoDb } from './server/db';
import { app } from './server/app';
import { detectLanInfo } from './server/network';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

interface ClientMeta {
  sessionId?: string | null;
  teamId?: string | null;
  role?: string | null;
  playerId?: string | null;
  hostToken?: string | null;
}

const clientMetadata = new WeakMap<WebSocket, ClientMeta>();

// Broadcast helper for WebSocket clients with optional session scoping
function broadcast(data: any, filterSessionId?: string) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      if (filterSessionId) {
        const meta = clientMetadata.get(client);
        // If client is subscribed to a specific session, only send matching session
        if (meta?.sessionId && meta.sessionId !== filterSessionId) {
          return;
        }
      }
      try {
        client.send(message);
      } catch (err) {
        console.error('[WebSocket] Error sending message:', err);
      }
    }
  });
}

// Broadcast game state to connected clients of a session
async function broadcastState(targetSessionId?: string) {
  const state = targetSessionId
    ? await mongoDb.games.findOne({ id: targetSessionId })
    : await mongoDb.games.getActiveGame();
  if (state) {
    broadcast({ type: 'STATE_UPDATE', state, sessionId: state.id }, state.id);
  }
}

app.set('broadcast', broadcast);
app.set('broadcastState', broadcastState);

// In-Memory Transient Timer Countdown Manager
// Broadcasts ticks over WebSocket without writing to MongoDB every second (Requirement 9 & 8)
let activeTimer: {
  sessionId: string;
  interval: NodeJS.Timeout;
  secondsRemaining: number;
} | null = null;

function stopSessionTimer(sessionId?: string) {
  if (activeTimer && (!sessionId || activeTimer.sessionId === sessionId)) {
    clearInterval(activeTimer.interval);
    const stoppedSessionId = activeTimer.sessionId;
    activeTimer = null;
    broadcast({ type: 'TIMER_STOPPED', sessionId: stoppedSessionId }, stoppedSessionId);
  }
}

function startSessionTimer(sessionId: string, durationSeconds: number) {
  stopSessionTimer(sessionId);
  let seconds = durationSeconds;

  const interval = setInterval(async () => {
    seconds -= 1;
    if (seconds >= 0) {
      // In-memory transient countdown tick over WebSocket
      broadcast({ type: 'TIMER_TICK', seconds, sessionId }, sessionId);
    }
    if (seconds <= 0) {
      clearInterval(interval);
      if (activeTimer?.interval === interval) {
        activeTimer = null;
      }
      broadcast({ type: 'TIMER_EXPIRED', sessionId }, sessionId);
    }
  }, 1000);

  activeTimer = {
    sessionId,
    interval,
    secondsRemaining: durationSeconds,
  };
}

app.set('startTimer', startSessionTimer);
app.set('stopTimer', stopSessionTimer);

// Disconnect all players and clear multiplayer session bindings (Requirement 6 & 8)
function disconnectPlayersForSession(
  sessionId: string,
  message: string = 'The Host has reset the game. Please wait for a new session or Team Access Code.'
) {
  const resetMsg = JSON.stringify({
    type: 'game_reset',
    sessionId,
    message,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const meta = clientMetadata.get(client);
      // If client is associated with this session and is a player (not host)
      if (meta && meta.sessionId === sessionId) {
        if (meta.role !== 'host') {
          try {
            client.send(resetMsg);
          } catch (e) {}
          // Clear association on server
          clientMetadata.set(client, { sessionId: null, teamId: null, role: null, playerId: null, hostToken: null });
          try {
            client.close(1000, 'Game Reset by Host');
          } catch (e) {}
        }
      }
    }
  });

  // Also broadcast game_reset to any remaining session subscribers
  broadcast({
    type: 'game_reset',
    sessionId,
    message,
  }, sessionId);
}

app.set('disconnectPlayersForSession', disconnectPlayersForSession);

// WebSocket connection handler
wss.on('connection', async (ws) => {
  clientMetadata.set(ws, { sessionId: null, teamId: null, role: null, playerId: null, hostToken: null });

  // Send current active game on initial connection
  const current = await mongoDb.games.getActiveGame();
  if (current) {
    ws.send(JSON.stringify({ type: 'STATE_UPDATE', state: current, sessionId: current.id }));
  }

  ws.on('message', async (message) => {
    try {
      const parsed = JSON.parse(message.toString());

      // 1. Session Subscription & Scoping (Requirement 11: Prevent reconnection to old reset session)
      if (parsed.type === 'SUBSCRIBE') {
        const meta = clientMetadata.get(ws) || {};
        const reqSessionId = parsed.sessionId || meta.sessionId || null;

        // If client is attempting to subscribe to a specific session ID, verify session is active
        if (reqSessionId) {
          const activeGame = await mongoDb.games.getActiveGame();
          if (!activeGame || activeGame.id !== reqSessionId) {
            // Stale connection to a reset or deleted session - reject and notify client
            try {
              ws.send(JSON.stringify({
                type: 'game_reset',
                sessionId: reqSessionId,
                message: 'The Host has reset the game. Please wait for a new session or Team Access Code.',
              }));
            } catch (e) {}
            clientMetadata.set(ws, { sessionId: null, teamId: null, role: null, playerId: null, hostToken: null });
            return;
          }
        }

        meta.sessionId = reqSessionId;
        meta.teamId = parsed.teamId || meta.teamId || null;
        meta.role = parsed.role || meta.role || null;
        meta.playerId = parsed.playerId || meta.playerId || null;
        meta.hostToken = parsed.hostToken || meta.hostToken || null;
        clientMetadata.set(ws, meta);
        return;
      }

      // 2. Realtime Steal Buzzer Lock
      if (parsed.type === 'BUZZ') {
        const { teamId, sessionId } = parsed;
        const game = sessionId
          ? await mongoDb.games.findOne({ id: sessionId })
          : await mongoDb.games.getActiveGame();

        if (game && game.stealState && game.stealState.isOpen && !game.stealState.lockedBy) {
          const team = game.teams.find((t) => t.id === teamId);
          if (team) {
            const target = team.targetPoints || team.maxScore || 60;
            const isCompleted = team.isCompleted || team.score >= target;
            const isExcluded = Boolean(game.stealState.excludedTeamIds && game.stealState.excludedTeamIds.includes(teamId));

            if (!isCompleted && !isExcluded) {
              game.stealState.isOpen = false;
              game.stealState.lockedBy = {
                teamId: team.id,
                teamName: team.name,
                buzzedAt: Date.now(),
              };
              await mongoDb.games.updateOne(game.id, { stealState: game.stealState });

              // Immediate targeted buzzer lock broadcast
              broadcast({
                type: 'STEAL_ALERT',
                message: `STEAL LOCKED BY ${team.name}!`,
                lockedBy: game.stealState.lockedBy,
                state: game,
                sessionId: game.id,
              }, game.id);

              broadcastState(game.id);
            }
          }
        }
      }
    } catch (e) {
      console.error('[WebSocket] Error handling WS message:', e);
    }
  });

  ws.on('close', () => {
    const meta = clientMetadata.get(ws);
    if (meta && meta.sessionId && meta.teamId) {
      broadcast({
        type: 'PLAYER_LEFT',
        sessionId: meta.sessionId,
        teamId: meta.teamId,
        playerId: meta.playerId,
      }, meta.sessionId);
    }
  });
});

// Boot server with Vite middleware or static serving
async function startServer() {
  const distPath = path.join(__dirname, 'dist');
  const indexHtmlExists = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV === 'production' || indexHtmlExists) {
    console.log('[Server] Serving optimized static assets from dist/');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log('[Server] Starting Vite development server middleware...');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            '**/data/**',
            '**/.data/**',
            '**/data/db.json',
            '**/.data/db.json',
            '**/db.json',
            '**/*.json',
            '**/dist/**',
            '**/.git/**',
            '**/tmp/**',
          ],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const lanInfo = detectLanInfo(PORT);

  httpServer.listen(PORT, '0.0.0.0', async () => {
    const dbStatus = await mongoDb.getStatus();
    const isMongoOk = dbStatus.connected;

    console.log(`\n======================================================`);
    console.log(`🎮 RETRO TILE QUIZ SHOWDOWN - LOCAL LAN MULTIPLAYER`);
    console.log(`======================================================`);
    console.log(`Local MongoDB: ${isMongoOk ? '✅ Connected (' + dbStatus.uri + ')' : '⚠️ Offline fallback active (.data/db.json)'}`);
    console.log(`Game Server:   ✅ Running on 0.0.0.0:${PORT}`);
    console.log(`Local Host:    http://localhost:${PORT}`);
    console.log(`LAN Access:    ${lanInfo.primaryUrl}`);
    console.log(`------------------------------------------------------`);
    console.log(`📱 Player Phone Instructions:`);
    console.log(`   1. Connect all phones to the same Wi-Fi router / mobile hotspot.`);
    console.log(`   2. Open ${lanInfo.primaryUrl} on player phone browsers.`);
    console.log(`   3. Enter assigned Team Access Code to join.`);
    console.log(`======================================================\n`);
  });
}

startServer();
