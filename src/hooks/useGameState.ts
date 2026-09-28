import { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Question } from '../types/game';
import { DEFAULT_QUESTIONS } from '../data/defaultQuestions';
import { soundEffects } from '../utils/soundEffects';

// Module-level cache and per-tab sessionStorage helper
let globalCachedGameState: GameState | null = null;
let globalCachedQuestions: Question[] = [];
let globalHasLoadedOnce = false;

function getInitialCachedState(): GameState | null {
  if (typeof window !== 'undefined') {
    try {
      const saved = sessionStorage.getItem('retro_quiz_last_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          globalCachedGameState = parsed;
          globalHasLoadedOnce = true;
          return parsed;
        }
      }
    } catch (e) {}
  }
  return globalCachedGameState;
}

function isEquivalentState(a: GameState | null, b: GameState | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.phase === b.phase &&
    a.currentTurnIndex === b.currentTurnIndex &&
    a.selectedTileId === b.selectedTileId &&
    a.isTimerRunning === b.isTimerRunning &&
    a.timerSecondsRemaining === b.timerSecondsRemaining &&
    JSON.stringify(a.answeredTileIds) === JSON.stringify(b.answeredTileIds) &&
    JSON.stringify(a.teams) === JSON.stringify(b.teams) &&
    JSON.stringify(a.stealState) === JSON.stringify(b.stealState)
  );
}

export function useGameState() {
  const initialCached = getInitialCachedState();
  const [gameState, setGameStateState] = useState<GameState | null>(initialCached);
  const [questions, setQuestionsState] = useState<Question[]>(
    globalCachedQuestions.length > 0 ? globalCachedQuestions : DEFAULT_QUESTIONS
  );
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialCached && !globalHasLoadedOnce);
  const [lastBuzzedTeam, setLastBuzzedTeam] = useState<string | null>(null);
  const [resetNotification, setResetNotification] = useState<string | null>(null);
  const clearResetNotification = useCallback(() => {
    setResetNotification(null);
  }, []);
  const [lanInfo, setLanInfo] = useState<{
    primaryIp: string;
    primaryUrl: string;
    port: number;
    allIps: Array<{ name: string; address: string; isPrivate: boolean; priority: number }>;
    instructions: string;
    currentOrigin?: string;
    isLocalhost?: boolean;
  } | null>(null);

  // Wrappers to sync cache, session storage, and deduplicate identical state updates
  const setGameState = useCallback((state: GameState | null | ((prev: GameState | null) => GameState | null)) => {
    setGameStateState((prev) => {
      const next = typeof state === 'function' ? state(prev) : state;
      if (isEquivalentState(prev, next)) {
        return prev; // Deduplicate redundant renders
      }
      globalCachedGameState = next;
      if (next) {
        globalHasLoadedOnce = true;
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('retro_quiz_last_state', JSON.stringify(next));
          } catch (e) {}
        }
      }
      return next;
    });
  }, []);

  const setQuestions = useCallback((qs: Question[] | ((prev: Question[]) => Question[])) => {
    setQuestionsState((prev) => {
      const next = typeof qs === 'function' ? qs(prev) : qs;
      globalCachedQuestions = next;
      return next;
    });
  }, []);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const prevTimerRef = useRef<number | null>(null);
  const gameStateRef = useRef<GameState | null>(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
    // Send session subscription when gameState.id becomes available
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && gameState?.id) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'SUBSCRIBE', sessionId: gameState.id }));
      } catch (e) {}
    }
  }, [gameState?.id]);

  // Fetch current state via REST
  const fetchCurrentState = useCallback(async () => {
    try {
      const res = await fetch('/api/game/current');
      if (res.ok) {
        const data = await res.json();
        if (data.game) {
          setGameState(data.game);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch game state via REST:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch questions
  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch('/api/questions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.questions)) {
          setQuestions(data.questions);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch questions:', err);
    }
  }, []);

  // Fetch local LAN network info (prioritized for router/hotspot)
  const fetchLanInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/lan-info');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLanInfo(data);
          return data;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch LAN info:', err);
    }
    return null;
  }, []);

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        console.log('[WebSocket] Connected to quiz server');
        if (gameStateRef.current?.id) {
          try {
            ws.send(JSON.stringify({ type: 'SUBSCRIBE', sessionId: gameStateRef.current.id }));
          } catch (e) {}
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Handle game_reset from Host (Requirements 6, 9, 10)
          if (msg.type === 'game_reset') {
            if (typeof window !== 'undefined') {
              const keysToRemove = [
                'sessionId',
                'playerId',
                'teamId',
                'teamAccessCode',
                'playerName',
                'reconnectToken',
                'retro_quiz_last_state',
                'sessionJoinedTeamId',
                'sessionJoinedTeamCode',
                'sessionJoinedSessionId',
              ];
              keysToRemove.forEach((key) => {
                try {
                  sessionStorage.removeItem(key);
                  localStorage.removeItem(key);
                } catch (e) {}
              });
            }
            globalCachedGameState = null;
            setGameState(null);
            setResetNotification(
              msg.message || 'The Host has reset the game. Please wait for a new session or Team Access Code.'
            );
            soundEffects.playShuffle();
            return;
          }

          // If message is tagged with a sessionId, verify it matches our current session (if bound)
          if (msg.sessionId && gameStateRef.current?.id && msg.sessionId !== gameStateRef.current.id) {
            return;
          }

          if ((msg.type === 'STATE_UPDATE' || msg.type === 'game_state_updated') && msg.state) {
            setGameState(msg.state);
          } else if (msg.type === 'player_joined' && msg.state) {
            setGameState(msg.state);
          } else if (msg.type === 'session_started' && msg.state) {
            setGameState(msg.state);
          } else if (msg.type === 'session_ended') {
            if (msg.state) setGameState(msg.state);
          } else if (msg.type === 'question_selected' && msg.state) {
            setGameState(msg.state);
          } else if (msg.type === 'answer_submitted' && msg.state) {
            setGameState(msg.state);
          } else if (msg.type === 'score_updated' && msg.state) {
            setGameState(msg.state);
          } else if (msg.type === 'buzzer_locked') {
            if (msg.lockedBy) {
              setLastBuzzedTeam(msg.lockedBy.teamName);
              soundEffects.playBuzzer();
            }
            if (msg.state) setGameState(msg.state);
          } else if (msg.type === 'buzzer_released' && msg.state) {
            setGameState(msg.state);
          } else if (msg.type === 'TIMER_TICK') {
            if (msg.seconds !== undefined) {
              setGameState((prev) => {
                if (!prev || prev.timerSecondsRemaining === msg.seconds) return prev;
                return { ...prev, timerSecondsRemaining: msg.seconds };
              });
              if (msg.seconds <= 5 && msg.seconds > 0) {
                soundEffects.playTick(true);
              } else if (msg.seconds % 5 === 0) {
                soundEffects.playTick(false);
              }
            }
          } else if (msg.type === 'TIMER_STOPPED') {
            setGameState((prev) => (prev ? { ...prev, isTimerRunning: false } : prev));
          } else if (msg.type === 'TIMER_EXPIRED') {
            setGameState((prev) => (prev ? { ...prev, timerSecondsRemaining: 0, isTimerRunning: false } : prev));
          } else if (msg.type === 'STEAL_ALERT') {
            soundEffects.playStealAlarm();
            if (msg.state) {
              setGameState(msg.state);
            }
            if (msg.lockedBy) {
              setLastBuzzedTeam(msg.lockedBy.teamName);
              soundEffects.playBuzzer();
            }
          }
        } catch (e) {
          console.error('[WebSocket] Error parsing message:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Retry connection in 2.5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 2500);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (e) {
      console.warn('[WebSocket] Connection failed, using HTTP polling fallback');
      setIsConnected(false);
    }
  }, []);

  // Initialize
  useEffect(() => {
    fetchCurrentState();
    fetchQuestions();
    fetchLanInfo();
    connectWebSocket();

    // Secondary polling interval in case WS drops
    pollIntervalRef.current = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetchCurrentState();
      }
    }, 1500);

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [fetchCurrentState, fetchQuestions, fetchLanInfo, connectWebSocket]);

  // Sound triggers on phase/state transitions
  useEffect(() => {
    if (!gameState) return;

    if (prevPhaseRef.current !== gameState.phase) {
      if (gameState.phase === 'steal') {
        soundEffects.playStealAlarm();
      } else if (gameState.phase === 'shuffle') {
        soundEffects.playShuffle();
      } else if (gameState.phase === 'game_over') {
        soundEffects.playVictory();
      }
      prevPhaseRef.current = gameState.phase;
    }

    if (gameState.lastAnswerResult) {
      if (gameState.lastAnswerResult.isCorrect) {
        soundEffects.playCorrect();
      } else if (gameState.lastAnswerResult.pointsDelta < 0) {
        soundEffects.playWrong();
      }
    }

    prevTimerRef.current = gameState.timerSecondsRemaining;
  }, [gameState]);

  // API Actions
  const startSetup = async () => {
    try {
      soundEffects.playCoin();
      const existingToken = typeof window !== 'undefined' ? sessionStorage.getItem('retro_host_token') : null;
      const res = await fetch('/api/game/start-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(existingToken ? { 'x-host-token': existingToken } : {}),
        },
        body: JSON.stringify({ hostToken: existingToken }),
      });
      const data = await res.json();
      if (data.success && data.game) {
        if (data.hostToken && typeof window !== 'undefined') {
          sessionStorage.setItem('retro_host_token', data.hostToken);
        }
        setGameState(data.game);
        return data.game;
      }
    } catch (err) {
      console.error('Error starting game setup:', err);
    }
  };

  const createGame = async (
    groupCount: number,
    groupNames: string[] = [],
    options?: { timerSeconds?: number; totalQuestions?: number }
  ) => {
    try {
      soundEffects.playCoin();
      const existingToken = typeof window !== 'undefined' ? sessionStorage.getItem('retro_host_token') : null;
      const res = await fetch('/api/game/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(existingToken ? { 'x-host-token': existingToken } : {}),
        },
        body: JSON.stringify({
          groupCount,
          groupNames,
          timerSeconds: options?.timerSeconds,
          totalQuestions: options?.totalQuestions,
          hostToken: existingToken,
        })
      });
      const data = await res.json();
      if (data.success && data.game) {
        if (data.hostToken && typeof window !== 'undefined') {
          sessionStorage.setItem('retro_host_token', data.hostToken);
        }
        setGameState(data.game);
        return { success: true, game: data.game };
      } else {
        soundEffects.playWrong();
        return { success: false, error: data.error || 'Failed to create game session' };
      }
    } catch (err: any) {
      soundEffects.playWrong();
      return { success: false, error: err.message || 'Network error creating game' };
    }
  };

  const joinTeam = async (accessCode: string, memberNames: string[], teamName?: string) => {
    try {
      const res = await fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode, memberNames, teamName })
      });
      const data = await res.json();
      if (data.success) {
        soundEffects.playCoin();
        if (data.game) setGameState(data.game);
        return { success: true, team: data.team };
      } else {
        soundEffects.playWrong();
        return { success: false, error: data.error };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const shuffleTurns = async () => {
    try {
      soundEffects.playShuffle();
      const res = await fetch('/api/game/shuffle', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.game) {
        setGameState(data.game);
      }
    } catch (err) {
      console.error('Error shuffling turns:', err);
    }
  };

  const startGameBoard = async () => {
    try {
      soundEffects.playCoin();
      const res = await fetch('/api/game/start-board', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.game) {
        setGameState(data.game);
      }
    } catch (err) {
      console.error('Error starting game board:', err);
    }
  };

  const selectTile = async (tileId: string) => {
    try {
      soundEffects.playTileClick();
      const res = await fetch('/api/game/select-tile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tileId })
      });
      const data = await res.json();
      if (data.success && data.game) {
        setGameState(data.game);
      }
    } catch (err) {
      console.error('Error selecting tile:', err);
    }
  };

  const answerQuestion = async (isCorrect: boolean, memberId?: string, isPass?: boolean) => {
    try {
      const res = await fetch('/api/game/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCorrect, memberId, isPass })
      });
      const data = await res.json();
      if (data.success && data.game) {
        setGameState(data.game);
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
    }
  };

  const triggerSteal = async () => {
    try {
      soundEffects.playStealAlarm();
      const res = await fetch('/api/game/trigger-steal', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.game) {
        setGameState(data.game);
      }
    } catch (err) {
      console.error('Error triggering steal:', err);
    }
  };

  const buzzSteal = async (teamId: string) => {
    try {
      soundEffects.playBuzzer();
      // Also send via WebSocket for ultra-fast reaction
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'BUZZ', teamId }));
      }

      const res = await fetch('/api/game/buzz-steal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId })
      });
      const data = await res.json();
      if (data.game) {
        setGameState(data.game);
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const resolveSteal = async (isCorrect: boolean, memberId?: string, noOneStole?: boolean) => {
    try {
      const res = await fetch('/api/game/resolve-steal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCorrect, memberId, noOneStole })
      });
      const data = await res.json();
      if (data.success && data.game) {
        setGameState(data.game);
      }
    } catch (err) {
      console.error('Error resolving steal:', err);
    }
  };

  const adjustTeamScore = async (teamId: string, delta: number, memberId?: string, reason?: string) => {
    try {
      soundEffects.playCoin();
      const res = await fetch('/api/game/adjust-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, delta, memberId, reason })
      });
      const data = await res.json();
      if (data.success && data.game) {
        setGameState(data.game);
        return { success: true, game: data.game };
      }
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const resetGame = async () => {
    try {
      soundEffects.playCoin();
      const hostToken =
        (typeof window !== 'undefined' ? sessionStorage.getItem('retro_host_token') : null) ||
        gameState?.hostToken ||
        '';

      const res = await fetch('/api/game/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-host-token': hostToken,
          'x-role': 'host',
        },
        body: JSON.stringify({
          hostToken,
          role: 'host',
          sessionId: gameState?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        soundEffects.playWrong();
        return { success: false, error: data.error || 'Failed to reset game' };
      }

      // Clear client session cache
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('retro_quiz_last_state');
          sessionStorage.removeItem('retro_host_token');
          sessionStorage.removeItem('sessionJoinedTeamId');
          sessionStorage.removeItem('sessionJoinedTeamCode');
          sessionStorage.removeItem('sessionJoinedSessionId');
        } catch (e) {}
      }
      globalCachedGameState = null;
      setGameState(null);
      return { success: true };
    } catch (err: any) {
      soundEffects.playWrong();
      console.error('Error resetting game:', err);
      return { success: false, error: err.message || 'Connection error' };
    }
  };

  const saveQuestions = async (
    updatedQuestions: Question[],
    totalTilesTarget?: number
  ): Promise<{ success: boolean; count?: number; error?: string; questions?: Question[] }> => {
    try {
      const res = await fetch('/api/questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: updatedQuestions,
          totalTiles: totalTilesTarget || (gameState?.totalQuestionsTarget || 80),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        const finalQs = Array.isArray(data.questions) ? data.questions : updatedQuestions;
        setQuestions(finalQs);
        return { success: true, count: data.count || finalQs.length, questions: finalQs };
      } else {
        const errorMsg = data?.error || `Server error (status ${res.status})`;
        console.error('[Questions] Error saving questions:', errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Network connection error';
      console.error('[Questions] Connection error saving questions:', err);
      return { success: false, error: errorMsg };
    }
  };

  const updateQuestion = async (id: string, updatedData: Partial<Question>) => {
    try {
      soundEffects.playCoin();
      const res = await fetch(`/api/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.question) {
          setQuestions((prev) => prev.map((q) => (q.id === id ? data.question : q)));
          return true;
        }
      }
    } catch (err) {
      console.error('Error updating question:', err);
    }
    return false;
  };

  const bulkAddQuestions = async (
    newQuestions: Question[],
    totalTilesTarget?: number
  ): Promise<{ success: boolean; count?: number; error?: string; questions?: Question[] }> => {
    try {
      soundEffects.playCoin();
      const res = await fetch('/api/questions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: newQuestions,
          totalTiles: totalTilesTarget || (gameState?.totalQuestionsTarget || 80),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        if (Array.isArray(data.allQuestions)) {
          setQuestions(data.allQuestions);
        } else if (Array.isArray(data.questions)) {
          setQuestions((prev) => [...data.questions, ...prev]);
        }
        return { success: true, count: data.count || newQuestions.length, questions: data.questions };
      } else {
        const errorMsg = data?.error || `Server error (status ${res.status})`;
        console.error('[Questions] Error bulk adding questions:', errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Network connection error';
      console.error('[Questions] Connection error bulk adding questions:', err);
      return { success: false, error: errorMsg };
    }
  };

  const addQuestion = async (newQuestion: Question, totalTilesTarget?: number) => {
    try {
      soundEffects.playCoin();
      const res = await fetch('/api/questions/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: newQuestion,
          totalTiles: totalTilesTarget || (gameState?.totalQuestionsTarget || 80),
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.question) {
          setQuestions((prev) => [data.question, ...prev]);
          return true;
        }
      }
    } catch (err) {
      console.error('Error adding question:', err);
    }
    return false;
  };

  const deleteQuestion = async (id: string) => {
    try {
      soundEffects.playWrong();
      const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
        return true;
      }
    } catch (err) {
      console.error('Error deleting question:', err);
    }
    return false;
  };

  const clearAllQuestions = async () => {
    try {
      soundEffects.playWrong();
      const res = await fetch('/api/questions/clear', { method: 'POST' });
      if (res.ok) {
        setQuestions([]);
        return true;
      }
    } catch (err) {
      console.error('Error clearing questions:', err);
    }
    return false;
  };

  const resetDefaultQuestions = async () => {
    try {
      soundEffects.playCoin();
      const res = await fetch('/api/questions/reset', { method: 'POST' });
      const data = await res.json();
      if (data.questions) {
        setQuestions(data.questions);
        return true;
      }
    } catch (err) {
      console.error('Error resetting default questions:', err);
    }
    return false;
  };

  const fetchGamesHistory = async () => {
    try {
      const res = await fetch('/api/games');
      if (res.ok) {
        const data = await res.json();
        return data.games || [];
      }
    } catch (err) {
      console.error('Error fetching games history:', err);
    }
    return [];
  };

  const deleteGameRecord = async (id: string) => {
    try {
      const res = await fetch(`/api/games/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (err) {
      console.error('Error deleting game record:', err);
      return false;
    }
  };

  const clearGamesHistory = async () => {
    try {
      const res = await fetch('/api/games/clear-history', { method: 'POST' });
      return res.ok;
    } catch (err) {
      console.error('Error clearing games history:', err);
      return false;
    }
  };

  // Granular React state setters to update components without page reloads
  const setTeams = useCallback((teamsOrUpdater: any[] | ((prev: any[]) => any[])) => {
    setGameState((prev) => {
      if (!prev) return prev;
      const nextTeams = typeof teamsOrUpdater === 'function' ? teamsOrUpdater(prev.teams) : teamsOrUpdater;
      return { ...prev, teams: nextTeams, updatedAt: Date.now() };
    });
  }, [setGameState]);

  const setCurrentQuestion = useCallback((q: Question | null) => {
    setGameState((prev) => {
      if (!prev) return prev;
      return { ...prev, currentQuestion: q, updatedAt: Date.now() };
    });
  }, [setGameState]);

  const setScores = useCallback((teamId: string, score: number) => {
    setGameState((prev) => {
      if (!prev) return prev;
      const updatedTeams = prev.teams.map((t) => (t.id === teamId ? { ...t, score } : t));
      return { ...prev, teams: updatedTeams, updatedAt: Date.now() };
    });
  }, [setGameState]);

  const setPlayers = useCallback((teamId: string, members: any[]) => {
    setGameState((prev) => {
      if (!prev) return prev;
      const updatedTeams = prev.teams.map((t) => (t.id === teamId ? { ...t, members } : t));
      return { ...prev, teams: updatedTeams, updatedAt: Date.now() };
    });
  }, [setGameState]);

  const validateAccessCode = async (accessCode: string) => {
    try {
      const res = await fetch('/api/game/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection error' };
    }
  };

  return {
    gameState,
    setGameState,
    setTeams,
    setCurrentQuestion,
    setScores,
    setPlayers,
    lanInfo,
    fetchLanInfo,
    validateAccessCode,
    teams: gameState?.teams || [],
    currentQuestion: gameState?.currentQuestion || null,
    phase: gameState?.phase || 'landing',
    questions,
    isConnected,
    isLoading,
    lastBuzzedTeam,
    startSetup,
    createGame,
    joinTeam,
    shuffleTurns,
    startGameBoard,
    selectTile,
    answerQuestion,
    triggerSteal,
    buzzSteal,
    resolveSteal,
    adjustTeamScore,
    resetGame,
    saveQuestions,
    updateQuestion,
    bulkAddQuestions,
    addQuestion,
    deleteQuestion,
    clearAllQuestions,
    resetDefaultQuestions,
    resetNotification,
    clearResetNotification,
    fetchGamesHistory,
    deleteGameRecord,
    clearGamesHistory,
    fetchQuestions,
    refreshState: fetchCurrentState,
  };
}
