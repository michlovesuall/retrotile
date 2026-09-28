import React, { useState, useEffect } from 'react';
import { Smartphone, Users, Trophy, Siren, CheckCircle2, Plus, Trash2, ArrowRight, Clock, ShieldAlert, ArrowLeft, Gamepad2 } from 'lucide-react';
import { GameState, Team } from '../types/game';
import { soundEffects } from '../utils/soundEffects';

interface PlayerPhoneViewProps {
  gameState: GameState | null;
  onJoinTeam: (accessCode: string, memberNames: string[], teamName?: string) => Promise<any>;
  onBuzzSteal: (teamId: string) => Promise<any>;
  prefilledAccessCode?: string;
  onSwitchToHostView?: () => void;
  onSwitchToLandingView?: () => void;
  isSimulator?: boolean;
  resetNotification?: string | null;
  onClearResetNotification?: () => void;
}

export const PlayerPhoneView: React.FC<PlayerPhoneViewProps> = ({
  gameState,
  onJoinTeam,
  onBuzzSteal,
  prefilledAccessCode = '',
  onSwitchToHostView,
  onSwitchToLandingView,
  isSimulator = false,
  resetNotification = null,
  onClearResetNotification,
}) => {
  // Find initial matching team from gameState if prefilled code was supplied
  const initialMatchingTeam = gameState?.teams?.find(
    (t) => t.accessCode.toUpperCase() === prefilledAccessCode.trim().toUpperCase()
  );

  const [accessCodeInput, setAccessCodeInput] = useState(prefilledAccessCode);
  const [teamNameInput, setTeamNameInput] = useState(initialMatchingTeam?.name || '');
  const [memberNames, setMemberNames] = useState<string[]>(
    initialMatchingTeam?.members?.length
      ? initialMatchingTeam.members.map((m) => m.name)
      : ['Player 1', 'Player 2', 'Player 3']
  );
  const [currentTeam, setCurrentTeam] = useState<Team | null>(() => {
    if (!isSimulator && typeof window !== 'undefined') {
      const storedId = sessionStorage.getItem('sessionJoinedTeamId');
      if (storedId && gameState?.teams) {
        const found = gameState.teams.find((t) => t.id === storedId);
        if (found && found.isJoined) {
          return found;
        }
      }
    }
    return prefilledAccessCode && initialMatchingTeam?.isJoined ? initialMatchingTeam : null;
  });
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [buzzStatus, setBuzzStatus] = useState<'idle' | 'buzzed' | 'won' | 'lost'>('idle');

  const lastMatchedCodeRef = React.useRef<string | null>(null);

  // Check URL query parameters for scanned QR code PIN (?code=TEAM-XXXX)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const codeFromUrl = params.get('code') || params.get('join') || params.get('pin');
      if (codeFromUrl) {
        setAccessCodeInput(codeFromUrl.toUpperCase());
      }
    }
  }, []);

  // Sync state with prefilledAccessCode prop or gameState.teams updates
  useEffect(() => {
    const code = prefilledAccessCode || accessCodeInput;
    if (prefilledAccessCode && prefilledAccessCode !== accessCodeInput) {
      setAccessCodeInput(prefilledAccessCode);
    }
    if (!code || !gameState?.teams) return;

    const cleanCode = code.trim().toUpperCase();
    const matched = gameState.teams.find(
      (t) => t.accessCode.toUpperCase() === cleanCode
    );

    if (matched) {
      const storedId = (!isSimulator && typeof window !== 'undefined') ? sessionStorage.getItem('sessionJoinedTeamId') : null;
      const isAuthorizedSession = isSimulator || Boolean(prefilledAccessCode) || (storedId === matched.id) || (currentTeam?.id === matched.id);

      if ((matched.isJoined || storedId === matched.id || currentTeam?.id === matched.id) && isAuthorizedSession) {
        setCurrentTeam((prev) => {
          if (
            prev &&
            prev.id === matched.id &&
            prev.score === matched.score &&
            prev.name === matched.name &&
            prev.isJoined === true &&
            JSON.stringify(prev.members) === JSON.stringify(matched.members)
          ) {
            return prev;
          }
          return { ...matched, isJoined: true };
        });
      } else if (!isAuthorizedSession && !storedId) {
        setCurrentTeam(null);
      }

      // Only auto-populate input fields once per matching code if not already customized by user
      if (!currentTeam && lastMatchedCodeRef.current !== cleanCode) {
        lastMatchedCodeRef.current = cleanCode;
        if (!teamNameInput || teamNameInput === initialMatchingTeam?.name) {
          setTeamNameInput(matched.name);
        }
        if (matched.members && matched.members.length > 0 && memberNames.length === 3 && memberNames[0] === 'Player 1') {
          setMemberNames(matched.members.map((m) => m.name));
        }
      }
    }
  }, [prefilledAccessCode, accessCodeInput, gameState?.teams, isSimulator, currentTeam]);

  // Automatically reset player team if session was reset or resetNotification received (Requirements 6, 9, 10)
  useEffect(() => {
    if (resetNotification) {
      setCurrentTeam(null);
      setAccessCodeInput('');
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
    }
  }, [resetNotification]);

  // Keep currentTeam synced with live stats from gameState without extra redraws
  useEffect(() => {
    if (!gameState) {
      if (currentTeam) {
        setCurrentTeam(null);
      }
      return;
    }
    if (!currentTeam) return;

    const updated = gameState.teams.find((t) => t.id === currentTeam.id);
    if (updated) {
      setCurrentTeam((prev) => {
        if (!prev) return { ...updated, isJoined: true };
        if (
          prev.score === updated.score &&
          prev.name === updated.name &&
          prev.isJoined === updated.isJoined &&
          prev.wrongAnswersCount === updated.wrongAnswersCount &&
          prev.correctAnswersCount === updated.correctAnswersCount &&
          prev.stealsWonCount === updated.stealsWonCount &&
          JSON.stringify(prev.members) === JSON.stringify(updated.members)
        ) {
          return prev; // Equivalent, preserve reference to prevent re-render
        }
        return { ...updated, isJoined: true };
      });
    } else {
      // Team no longer exists in session (session was reset)
      setCurrentTeam(null);
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
    }
  }, [gameState, currentTeam?.id]);

  useEffect(() => {
    if (!gameState?.stealState) {
      setBuzzStatus('idle');
      return;
    }

    if (gameState.stealState.lockedBy) {
      if (currentTeam && gameState.stealState.lockedBy.teamId === currentTeam.id) {
        setBuzzStatus('won');
      } else {
        setBuzzStatus('lost');
      }
    } else if (gameState.stealState.isOpen) {
      if (buzzStatus !== 'buzzed') {
        setBuzzStatus('idle');
      }
    }
  }, [gameState?.stealState, currentTeam?.id]);

  const handleAddMember = () => {
    if (memberNames.length >= 8) return;
    soundEffects.playTileClick();
    setMemberNames([...memberNames, `Player ${memberNames.length + 1}`]);
  };

  const handleRemoveMember = (idx: number) => {
    if (memberNames.length <= 1) return;
    soundEffects.playTileClick();
    setMemberNames(memberNames.filter((_, i) => i !== idx));
  };

  const handleMemberNameChange = (idx: number, val: string) => {
    const updated = [...memberNames];
    updated[idx] = val;
    setMemberNames(updated);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCodeInput.trim() || !teamNameInput.trim()) {
      setErrorMessage('Please enter both team access code and team name.');
      return;
    }

    setIsJoining(true);
    setErrorMessage(null);
    try {
      const res = await onJoinTeam(accessCodeInput.trim(), memberNames, teamNameInput.trim());
      if (res.success && res.team) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('sessionJoinedTeamId', res.team.id);
          sessionStorage.setItem('sessionJoinedTeamCode', accessCodeInput.trim().toUpperCase());
          if (gameState?.id) {
            sessionStorage.setItem('sessionJoinedSessionId', gameState.id);
          }
        }
        setCurrentTeam({ ...res.team, isJoined: true });
      } else {
        setErrorMessage(res.error || 'Invalid team access code or code not found in current game.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Connection error');
    } finally {
      setIsJoining(false);
    }
  };

  const handlePressSteal = async () => {
    if (!currentTeam || !gameState?.stealState?.isOpen || gameState.stealState.lockedBy) {
      return;
    }

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch (e) {}
    }

    soundEffects.playBuzzer();
    setBuzzStatus('buzzed');
    try {
      const res = await onBuzzSteal(currentTeam.id);
      if (res.locked) {
        setBuzzStatus('won');
      } else if (res.lockedByOther) {
        setBuzzStatus('lost');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ========================================================
  // VIEW 1: JOIN FORM (If not yet joined as a team)
  // ========================================================
  if (!currentTeam) {
    return (
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="neo-card-lg bg-white p-6 sm:p-7 border-3 border-black shadow-[8px_8px_0px_#000]">
          <div className="text-center mb-6">
            <div className="inline-block neo-badge bg-[#7dd3fc] text-black px-3 py-0.5 text-xs font-heading mb-2">
              PLAYER PHONE CHECK-IN
            </div>
            <h2 className="font-heading text-2xl text-black">
              JOIN GAME LOBBY
            </h2>
            <p className="text-xs font-sans font-semibold text-slate-700 mt-1">
              Enter the team access code provided by your host to join!
            </p>
          </div>

          {resetNotification && (
            <div className="mb-4 p-3.5 bg-amber-50 border-2 border-black rounded-lg text-black text-xs font-sans flex items-start gap-2.5 shadow-[2px_2px_0px_#000]">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 stroke-[2.5]" />
              <div className="flex-1">
                <span className="font-heading text-[11px] block uppercase text-amber-900 tracking-wider">
                  Session Notice
                </span>
                <span className="text-slate-800 text-xs font-bold block mt-0.5 leading-snug">
                  {resetNotification}
                </span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3 bg-[#ff7675] neo-card-sm text-black font-mono font-bold text-xs flex items-center gap-2 border-2 border-black">
              <ShieldAlert className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Join Form */}
          <form onSubmit={handleJoin} className="space-y-5">
            {/* Access Code Input */}
            <div>
              <label className="block font-heading text-xs text-black mb-1.5 flex items-center justify-between">
                <span>TEAM ACCESS CODE:</span>
                <span className="font-mono text-[10px] text-slate-500 font-bold">e.g. TEAM-4B9A</span>
              </label>
              <input
                type="text"
                value={accessCodeInput}
                onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. TEAM-4B9A"
                required
                disabled={isJoining}
                className="w-full neo-input p-3 text-center font-heading text-xl text-black tracking-widest uppercase disabled:opacity-50"
              />
            </div>
            
            {/* Team Name Input */}
            <div>
              <label className="block font-heading text-xs text-black mb-1.5">TEAM NAME:</label>
              <input 
                type="text" 
                value={teamNameInput} 
                onChange={(e) => setTeamNameInput(e.target.value)} 
                required 
                maxLength={24}
                disabled={isJoining}
                className="w-full neo-input p-3 font-bold text-black disabled:opacity-50" 
              />
            </div>

            {/* Members Roster */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-heading text-xs text-black flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 stroke-[2.5]" />
                  MEMBERS ({memberNames.length}):
                </label>
                <button type="button" onClick={handleAddMember} disabled={isJoining} className="neo-btn-sm bg-[#86efac] hover:bg-[#6ee7b7] text-black px-2 py-1 text-xs font-heading disabled:opacity-50">
                  <Plus className="w-3 h-3 stroke-[3]" /> ADD PLAYER
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {memberNames.map((name, idx) => (
                  <div key={`member-input-${idx}`} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleMemberNameChange(idx, e.target.value)}
                      placeholder={`Player ${idx + 1}`}
                      required
                      disabled={isJoining}
                      className="flex-1 neo-input px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50"
                    />
                    {memberNames.length > 1 && (
                      <button type="button" onClick={() => handleRemoveMember(idx)} disabled={isJoining} className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" disabled={isJoining} className="w-full neo-btn bg-[#86efac] hover:bg-[#6ee7b7] py-4 font-heading text-base text-black flex items-center justify-center gap-2 disabled:opacity-50">
              {isJoining ? 'CONNECTING...' : 'JOIN GAME LOBBY'}
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </form>

          {/* Switch View Buttons */}
          <div className="mt-6 pt-4 border-t-2 border-black/10 flex items-center justify-between text-xs font-mono font-bold">
            {onSwitchToHostView && (
              <button
                type="button"
                onClick={onSwitchToHostView}
                className="text-slate-600 hover:text-black flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Host
              </button>
            )}
            {onSwitchToLandingView && (
              <button
                type="button"
                onClick={onSwitchToLandingView}
                className="text-slate-600 hover:text-black"
              >
                Home
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ========================================================
  // ========================================================
  // VIEW 2: ACTIVE TEAM PHONE VIEW (In Lobby or In Game)
  // ========================================================
  const targetPoints = currentTeam.targetPoints || currentTeam.maxScore || (currentTeam.members.length * 20) || 60;
  const isTeamCompleted = currentTeam.isCompleted || currentTeam.score >= targetPoints;

  // Determine active turn team among eligible non-completed teams
  const eligibleOrder = (gameState?.turnOrder || []).filter((teamId) => {
    const t = gameState?.teams?.find((tm) => tm.id === teamId);
    return t && !t.isCompleted && t.score < (t.targetPoints || t.maxScore || 60);
  });
  const eligibleTurnTeams = gameState?.teams?.filter(
    (t) => !t.isCompleted && t.score < (t.targetPoints || t.maxScore || 60)
  ) || [];
  const activeTurnTeamId = eligibleOrder.length > 0 && gameState
    ? eligibleOrder[gameState.currentTurnIndex % eligibleOrder.length]
    : (eligibleTurnTeams[0]?.id || '');
  const activeTurnTeam = gameState?.teams?.find((t) => t.id === activeTurnTeamId);

  const isStealActive = gameState?.phase === 'steal' && gameState.stealState?.isOpen && !isTeamCompleted;
  const isLockedByMe = gameState?.stealState?.lockedBy?.teamId === currentTeam.id;
  const isLockedByOther = Boolean(gameState?.stealState?.lockedBy && !isLockedByMe);
  const isExcludedFromSteal = Boolean(gameState?.stealState?.excludedTeamIds?.includes(currentTeam.id)) || isTeamCompleted;

  const scorePct = Math.min(
    100,
    Math.max(0, Math.round((currentTeam.score / targetPoints) * 100))
  );

  // Calculate member score sum vs team level points (steals, bonuses)
  const memberPointsSum = (currentTeam.members || []).reduce((acc, m) => acc + (m.pointsEarned ?? m.score ?? 0), 0);
  const teamBonusOrAdjustment = Math.max(0, currentTeam.score - memberPointsSum);

  // ========================================================
  // COMPLETED TEAM VIEW (Team Performance Summary)
  // ========================================================
  if (isTeamCompleted && gameState?.phase !== 'lobby') {
    return (
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        <div className="neo-card-lg bg-white p-5 sm:p-6 border-3 border-black shadow-[8px_8px_0px_#000]">
          {/* Top Header Badge */}
          <div className="flex items-center justify-between border-b-3 border-black pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span
                className="w-4 h-4 rounded-full border-2 border-black"
                style={{ backgroundColor: currentTeam.color }}
              />
              <div>
                <h2 className="font-heading text-lg text-black truncate max-w-[180px]">
                  {currentTeam.name}
                </h2>
                <span className="font-mono text-xs font-bold text-slate-600">
                  CODE: {currentTeam.accessCode}
                </span>
              </div>
            </div>

            <div className="neo-badge bg-[#86efac] text-black px-2.5 py-1 text-xs font-heading border-2 border-black animate-pulse flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 stroke-[2.5]" />
              TARGET REACHED
            </div>
          </div>

          {/* 1. HIGHEST PRIORITY: Total Team Points Earned */}
          <div className="neo-card bg-[#ffdf00] p-5 text-center border-3 border-black shadow-[4px_4px_0px_#000] mb-5">
            <span className="neo-badge bg-black text-[#ffdf00] text-[11px] px-3 py-0.5 font-heading uppercase tracking-wider mb-2 inline-block">
              ★ TEAM TOTAL POINTS EARNED ★
            </span>
            <div className="font-heading text-4xl sm:text-5xl text-black my-1 tracking-tight">
              {currentTeam.score} <span className="text-xl sm:text-2xl font-mono text-black/80 font-extrabold">/ {targetPoints} PTS</span>
            </div>
            <p className="text-xs font-mono font-bold text-black/90 mt-2 bg-white/60 p-2 rounded border border-black/20">
              🎉 <strong>TARGET REACHED!</strong> Your team has completed its required points and is no longer included in the active turn rotation.
            </p>
          </div>

          {/* 2. HIGHEST PRIORITY: Points Earned by Each Member */}
          <div className="neo-card bg-[#faf7ee] p-4 border-2 border-black mb-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-black/10">
              <h3 className="font-heading text-sm text-black flex items-center gap-1.5">
                <Users className="w-4 h-4 stroke-[2.5]" />
                MEMBER PERFORMANCE
              </h3>
              <span className="text-xs font-mono font-bold text-slate-600">
                {currentTeam.members.length} Players
              </span>
            </div>

            <div className="space-y-2">
              {currentTeam.members.map((member, idx) => {
                const memPoints = member.pointsEarned ?? member.score ?? 0;
                const memPct = currentTeam.score > 0 ? Math.round((memPoints / currentTeam.score) * 100) : 0;

                return (
                  <div
                    key={member.id || idx}
                    className="p-3 bg-white neo-card-sm border-2 border-black flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 neo-card-sm bg-black text-white text-xs font-heading flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <span className="font-heading text-sm text-black block truncate max-w-[150px]">
                          {member.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 font-bold">
                          {memPct}% of team total
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="neo-badge bg-[#7dd3fc] text-black text-xs px-2.5 py-1 font-heading border border-black">
                        {memPoints} PTS
                      </span>
                    </div>
                  </div>
                );
              })}

              {teamBonusOrAdjustment > 0 && (
                <div className="p-2.5 bg-amber-50 neo-card-sm border-2 border-amber-600 flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-amber-900">★ Team Bonus / Steal Points:</span>
                  <span className="neo-badge bg-amber-200 text-black text-xs px-2 py-0.5">
                    +{teamBonusOrAdjustment} PTS
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3. LIVE SPECTATOR: Current Game Status (Now Playing & Current Turn) */}
          <div className="neo-card bg-[#e0f2fe] p-4 border-2 border-black mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="neo-badge bg-[#0284c7] text-white text-[10px] px-2 py-0.5 font-heading uppercase flex items-center gap-1">
                <Gamepad2 className="w-3.5 h-3.5" /> LIVE SHOWDOWN WATCHER
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-600 flex items-center gap-1">
                <Clock className="w-3 h-3 animate-spin" /> Spectator Mode
              </span>
            </div>

            <div className="bg-white p-3 neo-card-sm border-2 border-black space-y-2 text-center">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                  NOW PLAYING
                </span>
                <span
                  className="font-heading text-lg sm:text-xl block truncate"
                  style={{ color: activeTurnTeam?.color || '#000' }}
                >
                  {activeTurnTeam ? activeTurnTeam.name : 'All Teams Completed'}
                </span>
              </div>

              {activeTurnTeam && activeTurnTeam.members && activeTurnTeam.members.length > 0 && (
                <div className="pt-1 border-t border-black/10">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                    CURRENT TURN
                  </span>
                  <span className="font-mono text-xs font-extrabold text-black">
                    {activeTurnTeam.members[0]?.name || 'Active Player'}
                  </span>
                </div>
              )}

              <p className="text-[11px] font-mono font-semibold text-slate-600 pt-1">
                {gameState?.phase === 'question'
                  ? 'Trivia Question active • Timer counting down'
                  : gameState?.phase === 'steal'
                  ? 'Steal Window active for unfinished opponents'
                  : gameState?.phase === 'game_over'
                  ? '🏆 Showdown Concluded!'
                  : 'Tile board in progress'}
              </p>
            </div>
          </div>

          {/* 4. SECONDARY PRIORITY: Team Statistics */}
          <div className="neo-card bg-[#faf7ee] p-4 border-2 border-black">
            <h4 className="font-heading text-xs text-black mb-3 flex items-center gap-1.5 uppercase">
              <Trophy className="w-3.5 h-3.5 stroke-[2.5]" />
              TEAM GAMEPLAY STATISTICS
            </h4>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-white p-2.5 neo-card-sm border-2 border-black">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                  Correct Answers
                </span>
                <span className="font-heading text-xl text-emerald-600">
                  {currentTeam.correctAnswersCount || 0}
                </span>
              </div>

              <div className="bg-white p-2.5 neo-card-sm border-2 border-black">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                  Wrong Answers
                </span>
                <span className="font-heading text-xl text-rose-600">
                  {currentTeam.wrongAnswersCount || 0}
                </span>
              </div>

              <div className="bg-white p-2.5 neo-card-sm border-2 border-black">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                  Successful Steals
                </span>
                <span className="font-heading text-xl text-sky-600">
                  {currentTeam.stealsWonCount || 0}
                </span>
              </div>

              <div className="bg-white p-2.5 neo-card-sm border-2 border-black">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                  Passes
                </span>
                <span className="font-heading text-xl text-slate-700">
                  {currentTeam.passesCount || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-5 pt-3 border-t-2 border-black/10 flex items-center justify-between text-xs font-mono font-bold">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('sessionJoinedTeamId');
                }
                setCurrentTeam(null);
              }}
              className="text-slate-500 hover:text-rose-600"
            >
              Change Access Code
            </button>

            {onSwitchToHostView && (
              <button
                type="button"
                onClick={onSwitchToHostView}
                className="text-slate-600 hover:text-black"
              >
                Host View
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ========================================================
  // ACTIVE / UNFINISHED TEAM VIEW
  // ========================================================
  return (
    <div className="max-w-md mx-auto px-4 py-4">
      <div className="neo-card-lg bg-white p-5 border-3 border-black shadow-[8px_8px_0px_#000]">
        {/* Top Team Header */}
        <div className="flex items-center justify-between border-b-3 border-black pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span
              className="w-4 h-4 rounded-full border-2 border-black"
              style={{ backgroundColor: currentTeam.color }}
            />
            <div>
              <h2 className="font-heading text-base text-black truncate max-w-[160px]">
                {currentTeam.name}
              </h2>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-600">
                  CODE: {currentTeam.accessCode}
                </span>
                <span className="neo-badge bg-[#86efac] text-black text-[9px] font-mono px-1.5 py-0.2 flex items-center gap-0.5 border border-black">
                  CONNECTED
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="font-heading text-xl text-black block leading-none">
              {currentTeam.score} PTS
            </span>
            <span className="font-mono text-[9px] font-bold text-slate-500 uppercase">
              TARGET {targetPoints} PTS
            </span>
          </div>
        </div>

        {/* Phase Specific Banner */}
        {gameState?.phase === 'lobby' ? (
          <div className="py-8 px-4 text-center neo-card bg-[#faf7ee] border-2 border-black mb-4">
            <div className="w-12 h-12 neo-card bg-[#86efac] text-black flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 stroke-[3]" />
            </div>
            <h3 className="font-heading text-lg text-black">
              CHECKED INTO LOBBY!
            </h3>
            <p className="text-xs font-sans font-bold text-slate-600 mt-1 max-w-xs mx-auto">
              You are connected as <strong className="text-black">{currentTeam.name}</strong>. Waiting for the Host to shuffle turn order and launch the showdown...
            </p>

            <div className="mt-4 pt-3 border-t-2 border-black/10 flex items-center justify-center gap-1 text-[11px] font-mono font-bold text-slate-500">
              <Clock className="w-3.5 h-3.5 animate-spin" /> Live sync active
            </div>
          </div>
        ) : (
          /* Live Game State Indicator */
          <div className="space-y-4 mb-4">
            {/* Score Progress Bar */}
            <div>
              <div className="flex justify-between text-xs font-mono font-bold text-slate-600 mb-1">
                <span>TEAM SCORE PROGRESS</span>
                <span>{scorePct}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 neo-card-sm overflow-hidden p-0.5 border-2 border-black">
                <div
                  className="h-full rounded-sm transition-all duration-300"
                  style={{ width: `${scorePct}%`, backgroundColor: currentTeam.color }}
                />
              </div>
            </div>

            {/* Turn Indicator Banner */}
            {(() => {
              const activeTurnTeamName = activeTurnTeam?.name || 'Unknown Team';
              const isMyTurn = activeTurnTeamId === currentTeam.id;

              return (
                <div className={`p-4 neo-card text-center border-2 border-black ${
                  isMyTurn 
                    ? 'bg-[#86efac] text-black animate-pulse' 
                    : 'bg-[#faf7ee] text-slate-700'
                }`}>
                  {isMyTurn ? (
                    <div className="space-y-1">
                      <div className="inline-block neo-badge bg-black text-[#86efac] text-[10px] px-2 py-0.5 font-heading uppercase">
                        ★ ACTIVE TURN
                      </div>
                      <h4 className="font-heading text-lg text-black mt-1">
                        IT'S YOUR TURN!
                      </h4>
                      <p className="text-xs font-mono font-bold text-black/80">
                        Select a tile on the host board to choose your trivia challenge!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="inline-block neo-badge bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 font-heading uppercase">
                        WAITING
                      </div>
                      <h4 className="font-heading text-sm text-black mt-1">
                        CURRENT TURN: <span className="font-extrabold" style={{ color: activeTurnTeam?.color }}>{activeTurnTeamName}</span>
                      </h4>
                      <p className="text-xs font-mono font-bold text-slate-500">
                        Wait for your turn or be ready on the buzzers to steal!
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Steal Buzzer Button (Active when Steal Phase is Triggered) */}
            {isStealActive ? (
              <div className="py-4">
                {isExcludedFromSteal ? (
                  <div className="p-5 neo-card bg-[#faf7ee] text-black text-center border-2 border-black">
                    <span className="font-heading text-sm text-red-500 block">
                      ⚠️ LOCKED OUT OF STEAL
                    </span>
                    <p className="text-xs font-mono font-bold mt-1 text-slate-700">
                      Your team gave an incorrect answer or was excluded, and cannot buzz in on this question!
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(gameState.stealState?.lockedBy)}
                    onClick={handlePressSteal}
                    className={`w-full py-8 sm:py-12 md:py-16 neo-btn text-center font-heading text-lg sm:text-2xl md:text-3xl tracking-wider uppercase transition-all duration-150 ${
                      isLockedByMe
                        ? 'bg-[#86efac] text-black scale-105 border-4 border-black shadow-[6px_6px_0px_#000]'
                        : isLockedByOther
                        ? 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed border-2 border-black'
                        : 'bg-[#ff7675] hover:bg-[#ff5252] text-black border-4 border-black animate-bounce shadow-[8px_8px_0px_#000] active:translate-x-1 active:translate-y-1'
                    }`}
                  >
                    <Siren className="w-8 h-8 mx-auto mb-1 stroke-[2.5]" />
                    {isLockedByMe
                      ? '⚡ BUZZER LOCKED BY YOU!'
                      : isLockedByOther
                      ? 'LOCKED BY ANOTHER TEAM'
                      : '🚨 SLAM TO STEAL POINTS!'}
                  </button>
                )}
              </div>
            ) : (
              <div className="p-4 neo-card bg-[#faf7ee] text-center border-2 border-black">
                <span className="font-heading text-sm text-black block">
                  SHOWDOWN IN PROGRESS
                </span>
                <p className="text-xs font-mono font-bold text-slate-600 mt-1">
                  Keep your phone ready for steal opportunities!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Team Members List */}
        <div className="pt-3 border-t-2 border-black">
          <span className="block font-heading text-xs text-black mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 stroke-[2.5]" />
            TEAM MEMBERS ({currentTeam.members.length}):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {currentTeam.members.map((mem, idx) => (
              <span
                key={mem.id || idx}
                className="neo-badge bg-[#faf7ee] text-black px-2.5 py-1 text-xs font-mono font-bold border border-black"
              >
                {mem.name} ({mem.pointsEarned ?? mem.score ?? 0}p)
              </span>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 pt-3 border-t-2 border-black/10 flex items-center justify-between text-xs font-mono font-bold">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                sessionStorage.removeItem('sessionJoinedTeamId');
              }
              setCurrentTeam(null);
            }}
            className="text-slate-500 hover:text-rose-600"
          >
            Change Access Code
          </button>

          {onSwitchToHostView && (
            <button
              type="button"
              onClick={onSwitchToHostView}
              className="text-slate-600 hover:text-black"
            >
              Host View
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
