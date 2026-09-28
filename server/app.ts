import express from 'express';
import os from 'os';
import { mongoDb } from './db';
import { detectLanInfo } from './network';
import { GameState, Team, Question, DifficultyLevel } from '../src/types/game';

export const app = express();
app.use(express.json());

export function triggerBroadcast(req: express.Request, sessionId?: string) {
  const broadcastState = req.app.get('broadcastState');
  if (typeof broadcastState === 'function') {
    broadcastState(sessionId);
  }
}

export function broadcastEvent(req: express.Request, event: any, sessionId?: string) {
  const broadcastFn = req.app.get('broadcast');
  if (typeof broadcastFn === 'function') {
    broadcastFn(event, sessionId);
  }
}

export function startTimer(req: express.Request, sessionId: string, durationSeconds: number) {
  const timerFn = req.app.get('startTimer');
  if (typeof timerFn === 'function') {
    timerFn(sessionId, durationSeconds);
  }
}

export function stopTimer(req?: express.Request, sessionId?: string) {
  if (req) {
    const timerFn = req.app.get('stopTimer');
    if (typeof timerFn === 'function') {
      timerFn(sessionId);
    }
  }
}

export function extractHostToken(req: express.Request): string | null {
  const headerToken = req.headers['x-host-token'] || req.headers['x-admin-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.body && typeof req.body.hostToken === 'string' && req.body.hostToken.trim()) {
    return req.body.hostToken.trim();
  }
  return null;
}

export function generateHostToken(sessionId: string): string {
  return `host-${sessionId}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

// --- REST API ENDPOINTS ---

// Get active game state
app.get('/api/game/current', async (req, res) => {
  try {
    const game = await mongoDb.games.getActiveGame();
    res.json({ success: true, game });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get local server network interfaces & prioritized LAN address for player phones
app.get(['/api/server-info', '/api/lan-info'], (req, res) => {
  try {
    const port = Number(process.env.PORT) || 3000;
    const lanInfo = detectLanInfo(port);

    const hostHeader = req.get('host') || '';
    const currentOrigin = `${req.protocol}://${hostHeader}`;
    const isLocalhost = hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1');

    res.json({
      success: true,
      ...lanInfo,
      currentOrigin,
      isLocalhost,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get database connection status & diagnostics
app.get('/api/db-status', async (req, res) => {
  try {
    const status = await mongoDb.getStatus();
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger database reconnect attempt
app.post('/api/db-status/reconnect', async (req, res) => {
  try {
    await mongoDb.reconnect();
    const status = await mongoDb.getStatus();
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all questions with optional search and category filters
app.get('/api/questions', async (req, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const questions = await mongoDb.questions.find({ category, search });
    res.json({ success: true, questions, count: questions.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single question by ID
app.get('/api/questions/:id', async (req, res) => {
  try {
    const question = await mongoDb.questions.findOne({ id: req.params.id });
    if (!question) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }
    res.json({ success: true, question });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update an existing question
app.put('/api/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, category, points, hint } = req.body;
    const updateData: Partial<Question> = {};
    if (question !== undefined) updateData.question = String(question).trim();
    if (answer !== undefined) updateData.answer = String(answer).trim();
    if (category !== undefined) updateData.category = category;
    if (points !== undefined) updateData.points = Number(points);
    if (hint !== undefined) updateData.hint = hint ? String(hint).trim() : undefined;

    const updated = await mongoDb.questions.updateOne(id, updateData);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }
    res.json({ success: true, question: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a single question
app.delete('/api/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await mongoDb.questions.deleteOne(id);
    res.json({ success: true, deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper to determine allowed questions per category based on client request or active game configuration
async function getMaxQuestionsPerCategory(clientTotalTiles?: number): Promise<{ maxPerCategory: number; totalTiles: number }> {
  let totalTiles = 80;
  if (typeof clientTotalTiles === 'number' && clientTotalTiles >= 5 && clientTotalTiles <= 200) {
    totalTiles = clientTotalTiles;
  } else {
    const activeGame = await mongoDb.games.getActiveGame();
    totalTiles = activeGame?.totalQuestionsTarget || 80;
  }
  const maxPerCategory = Math.max(1, Math.round(totalTiles / 5));
  return { maxPerCategory, totalTiles };
}

// Bulk replace questions bank
app.put('/api/questions', async (req, res) => {
  try {
    const { questions, totalTiles: clientTotalTiles } = req.body;
    if (!Array.isArray(questions)) {
      return res.status(400).json({ success: false, error: 'Expected array of questions' });
    }

    // Validate format for every question
    const VALID_CATS = ['beginner', 'easy', 'moderate', 'hard', 'insane'];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q || typeof q.question !== 'string' || !q.question.trim() || typeof q.answer !== 'string' || !q.answer.trim()) {
        return res.status(400).json({
          success: false,
          error: `Invalid question format at item ${i + 1}: question text and answer are required.`,
        });
      }
      if (q.category && !VALID_CATS.includes(q.category)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category "${q.category}" at item ${i + 1}.`,
        });
      }
    }

    // Backend enforcement of category question limits
    const { maxPerCategory, totalTiles } = await getMaxQuestionsPerCategory(clientTotalTiles ? Number(clientTotalTiles) : undefined);
    const categories: DifficultyLevel[] = ['beginner', 'easy', 'moderate', 'hard', 'insane'];
    for (const cat of categories) {
      const catCount = questions.filter((q: any) => q && q.category === cat).length;
      if (catCount > maxPerCategory) {
        return res.status(400).json({
          success: false,
          error: `Question Limit Reached: Category "${cat}" contains ${catCount} questions, but the maximum allowed for this ${totalTiles}-tile configuration is ${maxPerCategory}.`,
        });
      }
    }

    const dbResult = await mongoDb.questions.replaceMany(questions);
    if (!dbResult.success) {
      return res.status(500).json({
        success: false,
        error: dbResult.error || 'Database operation failed.',
      });
    }

    const allQuestions = await mongoDb.questions.find();
    res.json({
      success: true,
      count: dbResult.insertedCount,
      insertedCount: dbResult.insertedCount,
      deletedCount: dbResult.deletedCount,
      questions: allQuestions,
      message: `${dbResult.insertedCount} questions successfully saved to Local MongoDB.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Database error' });
  }
});

// Bulk append / import questions
app.post('/api/questions/bulk', async (req, res) => {
  try {
    const { questions, totalTiles: clientTotalTiles } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: 'Expected non-empty array of questions' });
    }

    // Validate format for every question
    const VALID_CATS = ['beginner', 'easy', 'moderate', 'hard', 'insane'];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q || typeof q.question !== 'string' || !q.question.trim() || typeof q.answer !== 'string' || !q.answer.trim()) {
        return res.status(400).json({
          success: false,
          error: `Invalid question format at item ${i + 1}: question text and answer are required.`,
        });
      }
      if (q.category && !VALID_CATS.includes(q.category)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category "${q.category}" at item ${i + 1}.`,
        });
      }
    }

    // Backend enforcement of category question limits
    const { maxPerCategory, totalTiles } = await getMaxQuestionsPerCategory(clientTotalTiles ? Number(clientTotalTiles) : undefined);
    const existingQuestions = await mongoDb.questions.find();
    const categories: DifficultyLevel[] = ['beginner', 'easy', 'moderate', 'hard', 'insane'];
    for (const cat of categories) {
      const existingInCat = existingQuestions.filter((q) => q.category === cat).length;
      const newInCat = questions.filter((q: any) => q && q.category === cat).length;
      if (existingInCat + newInCat > maxPerCategory) {
        return res.status(400).json({
          success: false,
          error: `Question Limit Reached: Category "${cat}" would contain ${existingInCat + newInCat} questions, but the maximum allowed for this ${totalTiles}-tile configuration is ${maxPerCategory}.`,
        });
      }
    }

    const dbResult = await mongoDb.questions.insertMany(questions);
    if (!dbResult.success) {
      return res.status(500).json({
        success: false,
        error: dbResult.error || 'Database insertion failed.',
      });
    }

    const allQuestions = await mongoDb.questions.find();
    res.json({
      success: true,
      count: dbResult.insertedCount,
      insertedCount: dbResult.insertedCount,
      questions: dbResult.questions,
      allQuestions,
      message: `${dbResult.insertedCount} questions successfully inserted into Local MongoDB.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Database error' });
  }
});

// Add a single question
app.post('/api/questions/add', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.question || !question.answer) {
      return res.status(400).json({ success: false, error: 'Question text and answer are required' });
    }

    const targetCat = question.category || 'moderate';
    const { maxPerCategory, totalTiles } = await getMaxQuestionsPerCategory(req.body.totalTiles ? Number(req.body.totalTiles) : undefined);
    const existingQuestions = await mongoDb.questions.find();
    const existingInCat = existingQuestions.filter((q) => q.category === targetCat).length;
    if (existingInCat >= maxPerCategory) {
      return res.status(400).json({
        success: false,
        error: `Question Limit Reached: Category "${targetCat}" already contains ${existingInCat} questions, which is the maximum allowed (${maxPerCategory}) for this ${totalTiles}-tile configuration.`,
      });
    }

    const newQ: Question = {
      id: question.id || `custom-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      category: targetCat,
      points: Number(question.points) || 6,
      question: String(question.question).trim(),
      answer: String(question.answer).trim(),
      hint: question.hint ? String(question.hint).trim() : undefined,
    };
    const saved = await mongoDb.questions.insertOne(newQ);
    res.json({ success: true, question: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear all questions
app.post('/api/questions/clear', async (req, res) => {
  try {
    await mongoDb.questions.clearAll();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset questions to defaults
app.post('/api/questions/reset', async (req, res) => {
  try {
    const questions = await mongoDb.questions.resetToDefault();
    res.json({ success: true, questions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create new game session
app.post('/api/game/start-setup', async (req, res) => {
  try {
    let game = await mongoDb.games.getActiveGame();
    let hostToken = extractHostToken(req);

    if (!game) {
      const sessionId = `game-${Date.now().toString(36)}`;
      hostToken = hostToken || generateHostToken(sessionId);
      game = {
        id: sessionId,
        title: '3/4 TILE SHOWDOWN',
        phase: 'setup',
        teams: [],
        turnOrder: [],
        currentTurnIndex: 0,
        selectedTileId: null,
        answeredTileIds: [],
        timerSecondsRemaining: 30,
        timerDurationSeconds: 30,
        totalQuestionsTarget: 50,
        isTimerRunning: false,
        questionStartedAt: null,
        stealState: null,
        lastAnswerResult: null,
        hostToken,
        updatedAt: Date.now()
      };
      await mongoDb.games.insertOne(game);
    } else {
      if (!game.hostToken) {
        game.hostToken = hostToken || generateHostToken(game.id);
      }
      hostToken = game.hostToken;
      game.phase = 'setup';
      await mongoDb.games.updateOne(game.id, { phase: 'setup', hostToken: game.hostToken });
    }
    triggerBroadcast(req);
    res.json({ success: true, game, hostToken });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create new game session
app.post('/api/game/create', async (req, res) => {
  try {
    const { groupCount = 4, customNames = [], timerSeconds = 30 } = req.body;

    const DEFAULT_GROUP_NAMES = [
      'Cyber Dragons', 'Pixel Ninjas', 'Neon Phantoms', 'Quantum Titans',
      'Arcade Wizards', 'Retro Knights', 'Byte Brawlers', 'Turbo Raiders',
      'Solar Strikers', 'Vortex Vipers', 'Matrix Mavericks', 'Hyper Hawks'
    ];

    const GROUP_COLORS = [
      '#86efac', '#7dd3fc', '#fde047', '#f472b6', '#c084fc', '#fb923c',
      '#ff7675', '#a7f3d0', '#38bdf8', '#e879f9', '#facc15', '#4ade80'
    ];

    const questionsList = await mongoDb.questions.find();
    const totalQuestionsNum = questionsList.length || 50;

    const teams: Team[] = [];
    const count = Math.min(15, Math.max(2, Number(groupCount) || 4));

    for (let i = 0; i < count; i++) {
      const name = customNames[i] || DEFAULT_GROUP_NAMES[i % DEFAULT_GROUP_NAMES.length];
      const color = GROUP_COLORS[i % GROUP_COLORS.length];
      const accessCode = `TEAM-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const target = Math.round((totalQuestionsNum * 6) / count) || 60;
      teams.push({
        id: `team-${i + 1}-${Date.now().toString(36)}`,
        name,
        color,
        colorBg: `${color}20`,
        score: 0,
        targetPoints: target,
        maxScore: target,
        accessCode,
        isJoined: false,
        isCompleted: false,
        status: 'active',
        wrongAnswersCount: 0,
        correctAnswersCount: 0,
        stealsWonCount: 0,
        passesCount: 0,
        members: [{ id: `mem-1-${Date.now()}`, name: `${name} Captain`, score: 0, pointsEarned: 0 }]
      });
    }

    const existingGame = await mongoDb.games.getActiveGame();
    const newSessionId = `game-${Date.now().toString(36)}`;
    const hostToken = extractHostToken(req) || existingGame?.hostToken || generateHostToken(newSessionId);

    const newGame: GameState = {
      id: newSessionId,
      title: '3/4 TILE SHOWDOWN',
      phase: 'lobby',
      teams,
      turnOrder: teams.map((t) => t.id),
      currentTurnIndex: 0,
      selectedTileId: null,
      answeredTileIds: [],
      timerSecondsRemaining: Number(timerSeconds) || 30,
      timerDurationSeconds: Number(timerSeconds) || 30,
      totalQuestionsTarget: totalQuestionsNum,
      isTimerRunning: false,
      questionStartedAt: null,
      stealState: null,
      lastAnswerResult: null,
      hostToken,
      updatedAt: Date.now()
    };

    await mongoDb.games.insertOne(newGame);
    triggerBroadcast(req);
    res.json({ success: true, game: newGame, hostToken });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Validate team access code before joining
app.post('/api/game/validate-code', async (req, res) => {
  try {
    const { accessCode } = req.body;
    if (!accessCode) {
      return res.status(400).json({ success: false, error: 'Team access code is required' });
    }

    const game = await mongoDb.games.getActiveGame();
    if (!game) {
      return res.status(404).json({ success: false, error: 'No active game session found on Host' });
    }

    if (game.phase === 'landing') {
      return res.status(400).json({ success: false, error: 'Session is not active yet. Please wait for Host to start setup.' });
    }

    if (game.phase === 'game_over') {
      return res.status(400).json({ success: false, error: 'Session has already concluded.' });
    }

    const cleanCode = String(accessCode).trim().toUpperCase();
    const team = game.teams.find((t) => t.accessCode.toUpperCase() === cleanCode);

    if (!team) {
      return res.status(404).json({ success: false, error: 'Invalid Team Access Code. Please check the code provided by your Host.' });
    }

    res.json({
      success: true,
      team,
      sessionSummary: {
        id: game.id,
        title: game.title,
        phase: game.phase,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Join team using access code
app.post('/api/game/join', async (req, res) => {
  try {
    const { accessCode, memberNames = [], teamName } = req.body;
    if (!accessCode) {
      return res.status(400).json({ success: false, error: 'Access code required' });
    }

    const game = await mongoDb.games.getActiveGame();
    if (!game) {
      return res.status(404).json({ success: false, error: 'No active game session found on Host' });
    }

    if (game.phase === 'landing') {
      return res.status(400).json({ success: false, error: 'Session is not active yet. Please wait for Host to start setup.' });
    }

    if (game.phase === 'game_over') {
      return res.status(400).json({ success: false, error: 'Session has already concluded.' });
    }

    const cleanCode = String(accessCode).trim().toUpperCase();
    const team = game.teams.find((t) => t.accessCode.toUpperCase() === cleanCode);

    if (!team) {
      return res.status(404).json({ success: false, error: 'Invalid team access code' });
    }

    team.isJoined = true;
    if (teamName && teamName.trim()) {
      team.name = teamName.trim();
    }
    if (Array.isArray(memberNames) && memberNames.length > 0) {
      team.members = memberNames.map((n, idx) => ({
        id: `mem-${idx}-${Date.now().toString(36)}`,
        name: String(n).trim() || `Player ${idx + 1}`,
        score: 0,
        pointsEarned: 0,
      }));
      team.maxScore = team.members.length * 20;
      team.targetPoints = team.maxScore;
    }

    updateGameTeamsCompletion(game);
    await mongoDb.games.updateOne(game.id, { teams: game.teams, phase: game.phase });
    broadcastEvent(req, {
      type: 'player_joined',
      sessionId: game.id,
      teamId: team.id,
      teamName: team.name,
      team,
      state: game,
    }, game.id);
    triggerBroadcast(req, game.id);
    res.json({ success: true, team, game });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Shuffle turn order
app.post('/api/game/shuffle', async (req, res) => {
  try {
    const game = await mongoDb.games.getActiveGame();
    if (!game) {
      return res.status(404).json({ success: false, error: 'No active game found' });
    }

    const shuffled = [...game.teams.map((t) => t.id)].sort(() => Math.random() - 0.5);
    game.turnOrder = shuffled;
    game.phase = 'shuffle';

    await mongoDb.games.updateOne(game.id, {
      turnOrder: game.turnOrder,
      phase: game.phase
    });

    triggerBroadcast(req);
    res.json({ success: true, game });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start game board (advance from shuffle to tile_board)
app.post('/api/game/start-board', async (req, res) => {
  try {
    const game = await mongoDb.games.getActiveGame();
    if (!game) {
      return res.status(404).json({ success: false, error: 'No active game found' });
    }

    game.phase = 'tile_board';
    await mongoDb.games.updateOne(game.id, { phase: 'tile_board' });

    broadcastEvent(req, {
      type: 'session_started',
      sessionId: game.id,
      phase: 'tile_board',
      state: game,
    }, game.id);
    triggerBroadcast(req, game.id);
    res.json({ success: true, game });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Select tile
app.post('/api/game/select-tile', async (req, res) => {
  try {
    const { tileId, duration = 30 } = req.body;
    const game = await mongoDb.games.getActiveGame();
    if (!game) {
      return res.status(404).json({ success: false, error: 'No active game found' });
    }

    if (!tileId) {
      return res.status(400).json({ success: false, error: 'Tile ID required' });
    }

    if (game.answeredTileIds.includes(tileId)) {
      return res.status(400).json({ success: false, error: 'Tile already cleared and cannot be selected again' });
    }

    game.selectedTileId = tileId;
    game.phase = 'question';
    game.timerSecondsRemaining = Number(duration) || 30;
    game.isTimerRunning = true;
    game.stealState = null;
    game.questionStartedAt = Date.now();

    await mongoDb.games.updateOne(game.id, game);
    startTimer(req, game.id, game.timerSecondsRemaining);
    broadcastEvent(req, {
      type: 'question_selected',
      sessionId: game.id,
      tileId,
      state: game,
    }, game.id);
    triggerBroadcast(req, game.id);
    res.json({ success: true, game });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper to get list of eligible (unfinished) team IDs for turn rotation
export function getEligibleTurnTeamIds(game: GameState): string[] {
  if (!game || !game.teams || game.teams.length === 0) return [];
  const order = game.turnOrder && game.turnOrder.length > 0 ? game.turnOrder : game.teams.map((t) => t.id);
  return order.filter((teamId) => {
    const t = game.teams.find((tm) => tm.id === teamId);
    if (!t) return false;
    const target = t.targetPoints || t.maxScore || (t.members?.length ? t.members.length * 20 : 60);
    return !t.isCompleted && t.score < target;
  });
}

// Helper to determine the active team ID for the current turn
export function getActiveTurnTeamId(game: GameState): string | null {
  const eligibleIds = getEligibleTurnTeamIds(game);
  if (eligibleIds.length === 0) {
    return null;
  }
  return eligibleIds[game.currentTurnIndex % eligibleIds.length];
}

// Authoritative calculation of team completion status, member points, and rotation state
export function updateGameTeamsCompletion(game: GameState) {
  if (!game || !game.teams) return;

  for (const team of game.teams) {
    const target = team.targetPoints || team.maxScore || (team.members?.length ? team.members.length * 20 : 60);
    team.targetPoints = target;
    team.maxScore = target;
    team.correctAnswersCount = team.correctAnswersCount || 0;
    team.wrongAnswersCount = team.wrongAnswersCount || 0;
    team.stealsWonCount = team.stealsWonCount || 0;
    team.passesCount = team.passesCount || 0;

    team.members = (team.members || []).map((m) => ({
      ...m,
      score: typeof m.score === 'number' ? m.score : 0,
      pointsEarned: typeof m.pointsEarned === 'number' ? m.pointsEarned : (m.score || 0),
    }));

    if (team.score >= target) {
      team.isCompleted = true;
      team.status = 'completed';
    } else {
      team.isCompleted = false;
    }
  }

  const activeId = getActiveTurnTeamId(game);
  for (const team of game.teams) {
    if (team.isCompleted) {
      team.status = 'completed';
    } else if (team.id === activeId) {
      team.status = 'current_turn';
    } else if (team.isJoined) {
      team.status = 'waiting';
    } else {
      team.status = 'active';
    }
  }

  // End of game check: if all teams completed or all tiles cleared
  const allCompleted = game.teams.length > 0 && game.teams.every((t) => t.isCompleted);
  const targetTiles = game.totalQuestionsTarget || 50;
  const allTilesCleared = game.answeredTileIds.length >= targetTiles;

  if ((allCompleted || allTilesCleared) && game.phase !== 'setup' && game.phase !== 'landing' && game.phase !== 'lobby') {
    game.phase = 'game_over';
    game.isTimerRunning = false;
    game.stealState = null;
  }
}

// Answer question
app.post('/api/game/answer', async (req, res) => {
  try {
    const { isCorrect, memberId, isPass } = req.body;
    stopTimer(req);

    const game = await mongoDb.games.getActiveGame();
    if (!game) {
      return res.status(404).json({ success: false, error: 'No active game found' });
    }

    let pointsValue = 0;
    if (game.selectedTileId) {
      const q = await mongoDb.questions.findOne({ id: game.selectedTileId });
      if (q) {
        pointsValue = Number(q.points) || 0;
      } else {
        const lowerId = game.selectedTileId.toLowerCase();
        if (lowerId.startsWith('beginner')) pointsValue = 2;
        else if (lowerId.startsWith('easy')) pointsValue = 4;
        else if (lowerId.startsWith('moderate')) pointsValue = 6;
        else if (lowerId.startsWith('hard')) pointsValue = 8;
        else if (lowerId.startsWith('insane')) pointsValue = 10;
      }
    }

    const activeTeamId = getActiveTurnTeamId(game) || (game.turnOrder.length > 0 ? game.turnOrder[game.currentTurnIndex % game.turnOrder.length] : game.teams[0]?.id);
    const team = game.teams.find((t) => t.id === activeTeamId);

    if (team) {
      if (isPass) {
        team.passesCount = (team.passesCount || 0) + 1;
        game.lastAnswerResult = {
          teamId: activeTeamId,
          isCorrect: false,
          pointsDelta: 0,
          message: `${team.name} passed their turn! Steal is now open for other groups!`
        };

        // Exclude the active team and any already completed teams
        const completedTeamIds = game.teams.filter((t) => t.isCompleted || t.score >= (t.targetPoints || t.maxScore || 60)).map((t) => t.id);
        const excludedTeamIds = Array.from(new Set([activeTeamId, ...completedTeamIds]));

        const eligibleStealers = game.teams.filter((t) => !excludedTeamIds.includes(t.id));

        if (eligibleStealers.length === 0) {
          // No eligible opponents to steal, clear tile and move to next turn
          if (game.selectedTileId && !game.answeredTileIds.includes(game.selectedTileId)) {
            game.answeredTileIds.push(game.selectedTileId);
          }
          game.phase = 'tile_board';
          game.selectedTileId = null;
          game.isTimerRunning = false;
          game.stealState = null;
          game.currentTurnIndex += 1;
        } else {
          game.phase = 'steal';
          game.isTimerRunning = false;
          game.stealState = {
            isOpen: true,
            openedAt: Date.now(),
            lockedBy: null,
            excludedTeamIds
          };
        }
      } else if (isCorrect) {
        team.score += pointsValue;
        team.correctAnswersCount = (team.correctAnswersCount || 0) + 1;
        if (memberId) {
          const member = team.members.find((m) => m.id === memberId);
          if (member) {
            member.score += pointsValue;
            member.pointsEarned = (member.pointsEarned || 0) + pointsValue;
          }
        }

        if (game.selectedTileId && !game.answeredTileIds.includes(game.selectedTileId)) {
          game.answeredTileIds.push(game.selectedTileId);
        }

        const target = team.targetPoints || team.maxScore || 60;
        const reachedTarget = team.score >= target;

        game.lastAnswerResult = {
          teamId: activeTeamId,
          isCorrect: true,
          pointsDelta: pointsValue,
          message: reachedTarget
            ? `Correct! +${pointsValue} PTS — ${team.name} REACHED TARGET (${team.score}/${target} PTS)!`
            : `Correct! +${pointsValue} PTS`
        };

        game.phase = 'tile_board';
        game.selectedTileId = null;
        game.isTimerRunning = false;
        game.stealState = null;
        game.currentTurnIndex += 1;
      } else {
        team.wrongAnswersCount = (team.wrongAnswersCount || 0) + 1;
        team.score = Math.max(0, team.score - 5); // deduct 5 points penalty, floored at 0

        game.lastAnswerResult = {
          teamId: activeTeamId,
          isCorrect: false,
          pointsDelta: -5,
          message: `Incorrect answer! -5 PTS. Steal is now open for other teams!`
        };

        // Exclude the active team and any already completed teams
        const completedTeamIds = game.teams.filter((t) => t.isCompleted || t.score >= (t.targetPoints || t.maxScore || 60)).map((t) => t.id);
        const excludedTeamIds = Array.from(new Set([activeTeamId, ...completedTeamIds]));

        const eligibleStealers = game.teams.filter((t) => !excludedTeamIds.includes(t.id));

        if (eligibleStealers.length === 0) {
          // No eligible opponents to steal, clear tile and move to next turn
          if (game.selectedTileId && !game.answeredTileIds.includes(game.selectedTileId)) {
            game.answeredTileIds.push(game.selectedTileId);
          }
          game.phase = 'tile_board';
          game.selectedTileId = null;
          game.isTimerRunning = false;
          game.stealState = null;
          game.currentTurnIndex += 1;
        } else {
          game.phase = 'steal';
          game.isTimerRunning = false;
          game.stealState = {
            isOpen: true,
            openedAt: Date.now(),
            lockedBy: null,
            excludedTeamIds
          };
        }
      }
    }

    updateGameTeamsCompletion(game);

    await mongoDb.games.updateOne(game.id, game);
    broadcastEvent(req, {
      type: 'answer_submitted',
      sessionId: game.id,
      teamId: activeTeamId,
      isCorrect,
      isPass,
      result: game.lastAnswerResult,
      state: game,
    }, game.id);
    triggerBroadcast(req, game.id);
    res.json({ success: true, game });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger steal phase
app.post('/api/game/trigger-steal', async (req, res) => {
  try {
    stopTimer(req);
    const game = await mongoDb.games.getActiveGame();
    if (!game) {
      return res.status(404).json({ success: false, error: 'No active game found' });
    }

    const activeTeamId = getActiveTurnTeamId(game) || (game.turnOrder.length > 0 ? game.turnOrder[game.currentTurnIndex % game.turnOrder.length] : game.teams[0]?.id);
    const completedTeamIds = game.teams.filter((t) => t.isCompleted || t.score >= (t.targetPoints || t.maxScore || 60)).map((t) => t.id);
    const excludedTeamIds = Array.from(new Set([activeTeamId, ...completedTeamIds]));

    game.phase = 'steal';
    game.isTimerRunning = false;
    game.stealState = {
      isOpen: true,
      openedAt: Date.now(),
      lockedBy: null,
      excludedTeamIds
    };

    updateGameTeamsCompletion(game);
    await mongoDb.games.updateOne(game.id, game);
    broadcastEvent(req, {
      type: 'buzzer_released',
      sessionId: game.id,
      state: game,
    }, game.id);
    triggerBroadcast(req, game.id);
    res.json({ success: true, game });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Buzz steal
app.post('/api/game/buzz-steal', async (req, res) => {
  try {
    const { teamId } = req.body;
    const game = await mongoDb.games.getActiveGame();
    if (!game || !game.stealState || !game.stealState.isOpen) {
      return res.status(400).json({ success: false, locked: false, message: 'Steal window closed' });
    }

    const team = game.teams.find((t) => t.id === teamId);
    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }

    if (team.isCompleted || team.score >= (team.targetPoints || team.maxScore || 60)) {
      return res.status(400).json({ success: false, locked: false, message: 'Your team has completed its required points and is excluded from buzzers.' });
    }

    if (game.stealState.excludedTeamIds && game.stealState.excludedTeamIds.includes(teamId)) {
      return res.status(400).json({ success: false, locked: false, message: 'Your team is excluded from stealing this question.' });
    }

    if (game.stealState.lockedBy) {
      return res.json({
        success: true,
        locked: false,
        lockedByOther: true,
        lockedBy: game.stealState.lockedBy,
        game
      });
    }

    game.stealState.isOpen = false;
    game.stealState.lockedBy = {
      teamId: team.id,
      teamName: team.name,
      buzzedAt: Date.now()
    };

    await mongoDb.games.updateOne(game.id, { stealState: game.stealState });
    broadcastEvent(req, {
      type: 'buzzer_locked',
      sessionId: game.id,
      teamId: team.id,
      teamName: team.name,
      lockedBy: game.stealState.lockedBy,
      state: game,
    }, game.id);
    triggerBroadcast(req, game.id);
    res.json({
      success: true,
      locked: true,
      lockedBy: game.stealState.lockedBy,
      game
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Resolve steal
app.post('/api/game/resolve-steal', async (req, res) => {
  try {
    const { isCorrect, memberId, noOneStole } = req.body;
    const game = await mongoDb.games.getActiveGame();
    if (!game) {
      return res.status(404).json({ success: false, error: 'No active game found' });
    }

    let pointsValue = 0;
    if (game.selectedTileId) {
      const q = await mongoDb.questions.findOne({ id: game.selectedTileId });
      if (q) {
        pointsValue = Number(q.points) || 0;
      } else {
        const lowerId = game.selectedTileId.toLowerCase();
        if (lowerId.startsWith('beginner')) pointsValue = 2;
        else if (lowerId.startsWith('easy')) pointsValue = 4;
        else if (lowerId.startsWith('moderate')) pointsValue = 6;
        else if (lowerId.startsWith('hard')) pointsValue = 8;
        else if (lowerId.startsWith('insane')) pointsValue = 10;
      }
    }

    let stealCompleted = false;

    if (!noOneStole && game.stealState && game.stealState.lockedBy) {
      const winnerTeamId = game.stealState.lockedBy.teamId;
      const winner = game.teams.find((t) => t.id === winnerTeamId);
      if (winner) {
        if (isCorrect) {
          winner.score += pointsValue;
          winner.stealsWonCount = (winner.stealsWonCount || 0) + 1;
          winner.correctAnswersCount = (winner.correctAnswersCount || 0) + 1;
          
          if (memberId) {
            const member = winner.members.find((m) => m.id === memberId);
            if (member) {
              member.score += pointsValue;
              member.pointsEarned = (member.pointsEarned || 0) + pointsValue;
            }
          }
          stealCompleted = true;
        } else {
          winner.wrongAnswersCount = (winner.wrongAnswersCount || 0) + 1;
          winner.score = Math.max(0, winner.score - 5); // Deduct 5 points penalty, floored at 0

          // Exclude this team from further steal attempts on this question
          if (!game.stealState.excludedTeamIds) {
            game.stealState.excludedTeamIds = [];
          }
          if (!game.stealState.excludedTeamIds.includes(winnerTeamId)) {
            game.stealState.excludedTeamIds.push(winnerTeamId);
          }

          // Check if all eligible (non-completed) teams have been excluded
          const eligibleTeams = game.teams.filter((t) => !t.isCompleted && t.score < (t.targetPoints || t.maxScore || 60));
          const allEligibleExcluded = eligibleTeams.every((t) => game.stealState?.excludedTeamIds?.includes(t.id));

          if (allEligibleExcluded || game.stealState.excludedTeamIds.length >= game.teams.length) {
            // All eligible teams excluded! Steal phase terminates.
            stealCompleted = true;
          } else {
            // Keep the steal phase active, but re-open the buzzers!
            game.stealState.isOpen = true;
            game.stealState.lockedBy = null;
            stealCompleted = false;
          }
        }
      }
    } else {
      stealCompleted = true;
    }

    if (stealCompleted) {
      if (game.selectedTileId && !game.answeredTileIds.includes(game.selectedTileId)) {
        game.answeredTileIds.push(game.selectedTileId);
      }
      game.phase = 'tile_board';
      game.selectedTileId = null;
      game.stealState = null;
      game.isTimerRunning = false;
      game.currentTurnIndex += 1;
    }

    updateGameTeamsCompletion(game);

    await mongoDb.games.updateOne(game.id, game);
    broadcastEvent(req, {
      type: 'score_updated',
      sessionId: game.id,
      state: game,
    }, game.id);
    triggerBroadcast(req, game.id);
    res.json({ success: true, game });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Host Score Adjustment (bonus, penalty, or score correction)
app.post('/api/game/adjust-score', async (req, res) => {
  try {
    const { teamId, memberId, delta = 0, newScore, reason } = req.body;
    const game = await mongoDb.games.getActiveGame();
    if (!game) {
      return res.status(404).json({ success: false, error: 'No active game found' });
    }

    const team = game.teams.find((t) => t.id === teamId);
    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }

    if (typeof newScore === 'number') {
      const scoreDiff = newScore - team.score;
      team.score = Math.max(0, newScore);
      if (memberId) {
        const member = team.members.find((m) => m.id === memberId);
        if (member) {
          member.score = Math.max(0, member.score + scoreDiff);
          member.pointsEarned = Math.max(0, (member.pointsEarned || 0) + scoreDiff);
        }
      }
    } else if (typeof delta === 'number') {
      team.score = Math.max(0, team.score + delta);
      if (memberId) {
        const member = team.members.find((m) => m.id === memberId);
        if (member) {
          member.score = Math.max(0, member.score + delta);
          member.pointsEarned = Math.max(0, (member.pointsEarned || 0) + delta);
        }
      }
    }

    updateGameTeamsCompletion(game);

    await mongoDb.games.updateOne(game.id, game);
    broadcastEvent(req, {
      type: 'score_updated',
      sessionId: game.id,
      teamId: team.id,
      reason: reason || 'Host score adjustment',
      state: game,
    }, game.id);
    triggerBroadcast(req, game.id);
    res.json({ success: true, game, team });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get games history
app.get('/api/games', async (req, res) => {
  try {
    const games = await mongoDb.games.find(50);
    res.json({ success: true, games });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete specific game record
app.delete('/api/games/:id', async (req, res) => {
  try {
    const deleted = await mongoDb.games.deleteOne(req.params.id);
    res.json({ success: true, deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear game history
app.post('/api/games/clear-history', async (req, res) => {
  try {
    await mongoDb.games.clearHistory();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset / End Game (Host-Only Permission Enforcement - Requirements 1, 2, 4, 5, 6, 7, 8)
app.post('/api/game/reset', async (req, res) => {
  try {
    // 1. Explicitly reject any requests identifying as Player or Team
    const isPlayerRole =
      req.headers['x-role'] === 'player' ||
      req.body?.role === 'player' ||
      Boolean(req.body?.teamId) ||
      Boolean(req.body?.accessCode);

    if (isPlayerRole) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Player clients are strictly prohibited from resetting the game session.',
      });
    }

    // 2. Validate Host Authorization
    const providedToken = extractHostToken(req);
    const game = await mongoDb.games.getActiveGame();

    if (game) {
      if (game.hostToken && (!providedToken || providedToken !== game.hostToken)) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Only the authenticated Host has permission to perform a full game reset.',
        });
      }

      // 3. Stop all active timers for this session
      stopTimer(req, game.id);

      // 4. Disconnect all Player WebSocket connections associated with the current session (Requirement 6)
      const disconnectFn = req.app.get('disconnectPlayersForSession');
      if (typeof disconnectFn === 'function') {
        disconnectFn(
          game.id,
          'The Host has reset the game. Please wait for a new session or Team Access Code.'
        );
      }

      broadcastEvent(req, {
        type: 'game_reset',
        sessionId: game.id,
        message: 'The Host has reset the game. Please wait for a new session or Team Access Code.',
      }, game.id);

      // 5. Atomic deletion of active session runtime data (Questions preserved untouched - Requirements 4, 5, 8)
      await mongoDb.games.deleteOne(game.id);
      await mongoDb.games.setActiveGameId(null);
    } else {
      if (!providedToken && req.headers['x-role'] !== 'host' && req.body?.role !== 'host') {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Host permission required to perform reset.',
        });
      }
      stopTimer(req);
    }

    // 6. Broadcast state change
    triggerBroadcast(req);

    res.json({
      success: true,
      message: 'Game session successfully reset by Host. All players disconnected and questions preserved.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default app;
