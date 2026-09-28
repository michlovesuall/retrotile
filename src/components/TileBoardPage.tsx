import React, { useState } from 'react';
import { Trophy, Users, Zap, ChevronDown, ChevronUp, Sparkles, Smartphone, Plus, Minus, CheckCircle2 } from 'lucide-react';
import { GameState, Question, DifficultyLevel } from '../types/game';
import { CATEGORIES } from '../data/defaultQuestions';
import { soundEffects } from '../utils/soundEffects';

interface TileBoardPageProps {
  gameState: GameState;
  questions: Question[];
  onSelectTile: (tileId: string) => void;
  onOpenPhoneViewForTeam: (accessCode: string) => void;
  onAdjustScore?: (teamId: string, delta: number, memberId?: string, reason?: string) => Promise<any>;
}

export const TileBoardPage: React.FC<TileBoardPageProps> = ({
  gameState,
  questions,
  onSelectTile,
  onOpenPhoneViewForTeam,
  onAdjustScore,
}) => {
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Determine active turn team among eligible non-completed teams
  const eligibleTurnTeams = gameState.teams.filter(
    (t) => !t.isCompleted && t.score < (t.targetPoints || t.maxScore || 60)
  );
  const eligibleOrder = (gameState.turnOrder || []).filter((teamId) => {
    const t = gameState.teams.find((tm) => tm.id === teamId);
    return t && !t.isCompleted && t.score < (t.targetPoints || t.maxScore || 60);
  });
  const activeTeamId = eligibleOrder.length > 0
    ? eligibleOrder[gameState.currentTurnIndex % eligibleOrder.length]
    : (eligibleTurnTeams[0]?.id || gameState.teams[0]?.id);
  const activeTeam = gameState.teams.find((t) => t.id === activeTeamId) || gameState.teams[0];

  const categoryOrder: DifficultyLevel[] = ['beginner', 'easy', 'moderate', 'hard', 'insane'];
  const sortedTeams = [...gameState.teams].sort((a, b) => b.score - a.score);

  const toggleExpand = (teamId: string) => {
    setExpandedTeamId(expandedTeamId === teamId ? null : teamId);
    soundEffects.playTileClick();
  };

  const handleScoreDelta = async (e: React.MouseEvent, teamId: string, delta: number) => {
    e.stopPropagation();
    if (onAdjustScore) {
      await onAdjustScore(teamId, delta, undefined, 'Host Score Adjustment');
    }
  };

  const answeredCount = gameState.answeredTileIds.length;
  const totalQuestions = questions.length;
  const remainingCount = Math.max(0, totalQuestions - answeredCount);

  return (
    <div className="w-full max-w-[1720px] mx-auto px-2 sm:px-4 py-4">
      {/* Current Turn Notification Bar */}
      <div className="mb-5 neo-card-lg bg-white p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 neo-card flex items-center justify-center font-heading text-base text-black"
            style={{ backgroundColor: activeTeam?.color || '#ffdf00' }}
          >
            {eligibleOrder.length > 0 ? `#${((gameState.currentTurnIndex % eligibleOrder.length) + 1)}` : '★'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="neo-badge bg-[#ffdf00] text-black text-[10px] px-2 py-0.5 font-heading uppercase">
                ★ CURRENT TURN
              </span>
              <span className="text-xs font-mono font-bold text-slate-600">
                {eligibleTurnTeams.length > 0 ? 'CHOOSE A TILE TO BEGIN' : 'ALL TEAMS COMPLETED TARGET!'}
              </span>
            </div>
            <h2 className="font-heading text-xl sm:text-2xl text-black tracking-tight">
              {activeTeam ? activeTeam.name : 'Showdown Complete'}
            </h2>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="flex items-center gap-3 text-xs font-mono font-bold">
          <div className="neo-badge bg-[#faf7ee] text-black px-3 py-1.5">
            REMAINING: <span className="text-black font-extrabold ml-1">{remainingCount}</span>/{totalQuestions}
          </div>
          <div className="neo-badge bg-[#86efac] text-black px-3 py-1.5 hidden md:inline-flex">
            CLEARED: <span className="font-extrabold ml-1">{answeredCount}</span>
          </div>
          {activeTeam && (
            <button
              onClick={() => onOpenPhoneViewForTeam(activeTeam.accessCode)}
              className="neo-btn-sm bg-[#7dd3fc] text-black px-3 py-1.5 text-xs flex items-center gap-1 font-heading"
            >
              <Smartphone className="w-3.5 h-3.5 stroke-[2.5]" />
              OPEN {activeTeam.name.toUpperCase()} PHONE
            </button>
          )}
        </div>
      </div>

      {/* Main Split: 3/4 Screen (lg:col-span-9) for Tiles & 1/4 Screen (lg:col-span-3) for Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ======================================================== */}
        {/* 3/4 SCREEN: 50 NEOBRUTALIST TILES MATRIX (lg:col-span-9) */}
        {/* ======================================================== */}
        <div className="lg:col-span-9 neo-card-lg bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between mb-5 pb-3 border-b-3 border-black">
            <div>
              <h3 className="font-heading text-lg sm:text-xl text-black flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-black" /> {gameState.totalQuestionsTarget || totalQuestions} TRIVIA TILES MATRIX
              </h3>
              <p className="text-xs font-mono font-bold text-slate-600 mt-0.5">
                Click any available tile to initiate the 30-second question showdown
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold">
              <span className="neo-badge bg-[#86efac] text-[10px] px-2 py-0.5">
                AVAILABLE
              </span>
              <span className="neo-badge bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 line-through">
                CLEARED
              </span>
            </div>
          </div>

          {/* Dynamic Category Matrix (2 columns per category, 10-80 total questions) */}
          {questions.length === 0 ? (
            <div className="neo-card bg-[#faf7ee] p-8 text-center space-y-4">
              <div className="w-14 h-14 neo-card bg-[#ffdf00] text-black mx-auto flex items-center justify-center font-heading text-xl">
                0
              </div>
              <h4 className="font-heading text-xl text-black">NO QUESTIONS LOADED</h4>
              <p className="text-xs font-mono font-bold text-slate-600 max-w-md mx-auto">
                The question bank is currently empty. Click <strong>50 Q-BANK</strong> in the top bar to paste your questions in the format:
                <br />
                <code className="bg-white px-2.5 py-1 neo-card-sm inline-block mt-2 text-black">
                  question;answer;hint
                </code>
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Category Header Row (5 categories x 2 columns = 10 columns) */}
              <div className="grid grid-cols-10 gap-2 mb-1">
                {categoryOrder.map((catKey) => (
                  <div
                    key={catKey}
                    className="col-span-2 text-center p-2 font-heading text-[10px] text-black border-2 border-black truncate"
                    style={{ backgroundColor: CATEGORIES[catKey].color }}
                  >
                    {CATEGORIES[catKey].name}
                  </div>
                ))}
              </div>

              {/* Dynamic Tile Matrix (rows determined by questions per category / 2) */}
              {(() => {
                const targetTotal = gameState.totalQuestionsTarget || 50;
                const qPerCat = Math.max(1, Math.round(targetTotal / 5));
                const rowCount = Math.max(1, Math.ceil(qPerCat / 2));
                const rowIndices = Array.from({ length: rowCount }, (_, i) => i);
                const tileHeightClass = rowCount >= 8 ? 'h-10 sm:h-11 text-xs' : rowCount >= 6 ? 'h-12 text-sm' : 'h-14 sm:h-16';

                return (
                  <div className="grid grid-cols-10 gap-2">
                    {rowIndices.map((rowIndex) =>
                      categoryOrder.map((catKey) => {
                        const catQuestions = (questions || []).filter(
                          (q) => q && q.category === catKey
                        );
                        // We need 2 questions per category per row
                        const q1 = catQuestions[rowIndex * 2];
                        const q2 = catQuestions[rowIndex * 2 + 1];

                        const renderTile = (q: Question | undefined, slotIdx: number) => {
                          if (!q) {
                            return (
                              <div
                                key={`${catKey}-${rowIndex}-${slotIdx}`}
                                className={`${tileHeightClass} opacity-0 pointer-events-none select-none`}
                              />
                            );
                          }

                          const isAnswered = (gameState.answeredTileIds || []).includes(q.id);
                          const catInfo =
                            (q.category && CATEGORIES[q.category]) ||
                            CATEGORIES[catKey] ||
                            CATEGORIES.beginner;

                          if (isAnswered) {
                            return (
                              <div
                                key={q.id}
                                className={`${tileHeightClass} rounded-lg border-2 border-dashed border-slate-400 bg-slate-100 flex flex-col items-center justify-center text-slate-400 select-none opacity-60`}
                              >
                                <span className="font-heading text-[9px] line-through">CLEARED</span>
                              </div>
                            );
                          }

                          return (
                            <button
                              key={q.id}
                              onClick={() => {
                                soundEffects.playTileClick();
                                onSelectTile(q.id);
                              }}
                              className={`${tileHeightClass} neo-btn rounded-lg flex flex-col items-center justify-center p-1 transition-all hover:scale-105 active:scale-95 text-black`}
                              style={{ backgroundColor: catInfo.color }}
                            >
                              <span className="font-heading text-xs">+{catInfo.points}p</span>
                            </button>
                          );
                        };

                        return (
                          <React.Fragment key={`${catKey}-${rowIndex}`}>
                            {renderTile(q1, 0)}
                            {renderTile(q2, 1)}
                          </React.Fragment>
                        );
                      })
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 1/4 SCREEN: ARCADE LEADERBOARD (lg:col-span-3)           */}
        {/* ======================================================== */}
        <div className="lg:col-span-3 neo-card-lg bg-white p-4 sm:p-5 flex flex-col">
          {/* Leaderboard Header */}
          <div className="border-b-3 border-black pb-3 mb-3 flex items-center justify-between">
            <h3 className="font-heading text-base text-black flex items-center gap-2">
              <Trophy className="w-5 h-5 text-black" /> LEADERBOARD
            </h3>
            <span className="neo-badge bg-[#ffdf00] text-black text-[10px] px-2 py-0.5 font-mono font-bold">
              {gameState.teams.length} TEAMS
            </span>
          </div>

          <p className="text-xs font-mono font-bold text-slate-600 mb-3 leading-snug">
            Max points proportional (20 pts/player). Wrong answers deduct 5 points.
          </p>

          {/* Teams Ranked List */}
          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-270px)] pr-1">
            {sortedTeams.map((team, rankIdx) => {
              const isTurn = team.id === activeTeamId;
              const isExpanded = expandedTeamId === team.id;
              const pct = Math.min(100, Math.max(0, Math.round((team.score / (team.maxScore || 60)) * 100)));

              return (
                <div
                  key={team.id}
                  className={`neo-card p-3.5 transition-all ${
                    isTurn ? 'bg-[#fff9e6] shadow-[5px_5px_0px_#000]' : 'bg-[#fffdfa]'
                  }`}
                  style={{ borderLeft: `8px solid ${team.color}` }}
                >
                  {/* Team Top Row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
                      <span className="w-5 h-5 neo-card-sm bg-black text-white flex items-center justify-center font-heading text-[10px] shrink-0">
                        #{rankIdx + 1}
                      </span>
                      <span className="font-heading text-xs sm:text-sm text-black truncate">
                        {team.name}
                      </span>
                      {team.isCompleted || team.score >= (team.targetPoints || team.maxScore || 60) ? (
                        <span className="neo-badge bg-[#86efac] text-black text-[9px] px-1.5 py-0.2 font-heading border border-black uppercase flex items-center gap-0.5 shrink-0">
                          <CheckCircle2 className="w-2.5 h-2.5 stroke-[3]" /> COMPLETED
                        </span>
                      ) : isTurn ? (
                        <span className="neo-badge bg-[#ffdf00] text-black text-[9px] px-1.5 py-0.2 font-heading border border-black uppercase shrink-0">
                          TURN
                        </span>
                      ) : null}
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-1.5">
                      <div className="text-right">
                        <span className="font-heading text-sm sm:text-base text-black block leading-none">
                          {team.score}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          /{team.targetPoints || team.maxScore || 60}P
                        </span>
                      </div>

                      {/* Quick Host Score Adjustment Buttons */}
                      {onAdjustScore && (
                        <div className="flex items-center gap-0.5 ml-1">
                          <button
                            type="button"
                            onClick={(e) => handleScoreDelta(e, team.id, -5)}
                            className="w-5 h-5 neo-btn-sm bg-rose-200 hover:bg-rose-300 text-rose-950 p-0 flex items-center justify-center text-[10px] font-extrabold border border-black"
                            title="Host score adjustment: -5 PTS"
                          >
                            <Minus className="w-3 h-3 stroke-[3]" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleScoreDelta(e, team.id, 5)}
                            className="w-5 h-5 neo-btn-sm bg-[#86efac] hover:bg-[#6ee7b7] text-black p-0 flex items-center justify-center text-[10px] font-extrabold border border-black"
                            title="Host score adjustment: +5 PTS"
                          >
                            <Plus className="w-3 h-3 stroke-[3]" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar towards Max Score */}
                  <div className="w-full bg-slate-200 h-3 rounded-full border-2 border-black overflow-hidden mb-2">
                    <div
                      className="h-full transition-all duration-500 rounded-full border-r-2 border-black"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: team.color,
                      }}
                    />
                  </div>

                  {/* Stats Badges */}
                  <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-700 mb-2">
                    <span>{pct}% TO MAX</span>
                    <span className="text-rose-600">
                      -{((team.wrongAnswersCount || 0) * 5)}p
                    </span>
                    <span className="text-emerald-700">
                      ★ {team.stealsWonCount || 0} steals
                    </span>
                  </div>

                  {/* Member Scores Toggle Button */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(team.id)}
                    className="w-full py-1.5 px-2 bg-white hover:bg-slate-50 neo-card-sm text-xs font-mono font-bold text-black flex items-center justify-between"
                  >
                    <span>Member Scores ({team.members.length})</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {/* Expanded Member Scores */}
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t-2 border-black space-y-1">
                      {team.members.map((mem) => (
                        <div
                          key={mem.id}
                          className="flex items-center justify-between text-xs font-mono font-bold px-2 py-1 bg-white neo-card-sm"
                        >
                          <span className="text-slate-800 truncate max-w-[130px]">{mem.name}</span>
                          <span className="neo-badge bg-[#7dd3fc] text-black text-[10px] px-1.5 py-0.2">
                            {mem.score} PTS
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
