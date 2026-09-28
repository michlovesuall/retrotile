import React, { useState } from 'react';
import { Clock, CheckCircle2, XCircle, AlertTriangle, Lightbulb, Eye, EyeOff, Users, Zap, Siren } from 'lucide-react';
import { GameState, Question, DifficultyLevel } from '../types/game';
import { CATEGORIES } from '../data/defaultQuestions';
import { soundEffects } from '../utils/soundEffects';

interface QuestionPageProps {
  gameState: GameState;
  questions: Question[];
  onAnswerQuestion: (isCorrect: boolean, memberId?: string, isPass?: boolean) => Promise<void>;
  onTriggerSteal: () => Promise<void>;
}

export const QuestionModalOrPage: React.FC<QuestionPageProps> = ({
  gameState,
  questions = [],
  onAnswerQuestion,
  onTriggerSteal,
}) => {
  // 1. Look up exact question by ID in the questions bank
  let resolvedQuestion = questions && questions.length > 0
    ? questions.find((q) => q && q.id === gameState?.selectedTileId)
    : undefined;

  // 2. If not found by exact ID, determine the category from the selectedTileId
  if (!resolvedQuestion && gameState?.selectedTileId) {
    const tileId = gameState.selectedTileId;
    const catKeys: DifficultyLevel[] = ['beginner', 'easy', 'moderate', 'hard', 'insane'];
    const matchedCategory = catKeys.find((c) => tileId.toLowerCase().includes(c));

    if (matchedCategory) {
      const catQuestions = questions.filter((q) => q && q.category === matchedCategory);
      const numMatch = tileId.match(/\d+/);
      const slotIndex = numMatch ? Math.max(0, parseInt(numMatch[0], 10) - 1) : 0;

      resolvedQuestion = catQuestions[slotIndex] || {
        id: tileId,
        category: matchedCategory,
        points: CATEGORIES[matchedCategory]?.points || 2,
        question: `[${CATEGORIES[matchedCategory]?.name || matchedCategory.toUpperCase()}] Slot #${slotIndex + 1}: No question configured yet for this category. (Add via Admin Setup)`,
        answer: 'N/A',
        hint: `Category: ${CATEGORIES[matchedCategory]?.name} (${CATEGORIES[matchedCategory]?.points} Points)`,
      };
    }
  }

  // 3. Fallback safely without cross-category pollution
  const currentQ: Question = resolvedQuestion || {
    id: gameState?.selectedTileId || 'tile-fallback',
    question: 'Question data loading or unavailable.',
    answer: 'N/A',
    category: 'beginner',
    points: 2,
  };

  const cat = (currentQ?.category && CATEGORIES[currentQ.category]) || CATEGORIES.beginner;

  const activeTeamId = gameState?.turnOrder && gameState.turnOrder.length > 0
    ? gameState.turnOrder[gameState.currentTurnIndex % gameState.turnOrder.length]
    : gameState?.teams?.[0]?.id || '';

  const activeTeam = (gameState?.teams && gameState.teams.find((t) => t.id === activeTeamId)) ||
    gameState?.teams?.[0] || {
      id: 'team-default',
      name: 'Team 1',
      color: '#ffdf00',
      score: 0,
      maxScore: 60,
      members: [{ id: 'm1', name: 'Player 1', score: 0 }],
      accessCode: 'TEAM-1'
    };

  const members = activeTeam?.members && activeTeam.members.length > 0
    ? activeTeam.members
    : [{ id: `${activeTeam?.id}-m1`, name: `${activeTeam?.name || 'Team'} Member`, score: 0 }];

  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    members[0]?.id || ''
  );

  const [showAnswer, setShowAnswer] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const totalDuration = gameState.timerDurationSeconds || 30;
  const timerSeconds = gameState.timerSecondsRemaining;
  const isUrgent = timerSeconds <= 5;
  const timerPct = Math.max(0, Math.min(100, Math.round((timerSeconds / totalDuration) * 100)));

  const handleCorrect = async () => {
    setIsProcessing(true);
    soundEffects.playCorrect();
    try {
      await onAnswerQuestion(true, selectedMemberId);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWrong = async () => {
    setIsProcessing(true);
    soundEffects.playWrong();
    try {
      await onAnswerQuestion(false, selectedMemberId);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePass = async () => {
    setIsProcessing(true);
    soundEffects.playTileClick();
    try {
      await onAnswerQuestion(false, selectedMemberId, true);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      {/* Main Question Card with Integrated Level, Points, Answering Team & Countdown Timer in Upper Header */}
      <div
        className="neo-card-lg bg-white p-4 sm:p-6 mb-4 relative overflow-hidden"
        style={{ borderTop: `6px solid ${cat.color}` }}
      >
        {/* Upper Header Bar: Level, Value, Answering Team (Left) + Countdown Timer (Right) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b-2 border-black">
          {/* Left: Category Level, Points & Answering Team */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <span
              className="neo-badge text-xs px-2.5 py-1 font-heading text-black border-2 border-black"
              style={{ backgroundColor: cat.color }}
            >
              {cat.name.toUpperCase()} LEVEL
            </span>

            <span className="neo-badge bg-[#86efac] text-black text-xs px-2.5 py-1 font-heading border-2 border-black">
              +{cat.points} PTS
            </span>

            <span className="neo-badge bg-[#faf7ee] text-slate-700 text-xs px-2 py-1 font-mono font-bold border-2 border-black hidden sm:inline-block">
              TILE #{currentQ.id}
            </span>

            <div className="flex items-center gap-1.5 neo-badge bg-[#ffdf00] text-black px-2.5 py-1 border-2 border-black">
              <span
                className="w-3 h-3 rounded-full border border-black inline-block shrink-0"
                style={{ backgroundColor: activeTeam.color }}
              />
              <span className="text-[10px] font-mono font-bold uppercase">TEAM:</span>
              <span className="font-heading text-xs text-black truncate max-w-[140px]">
                {activeTeam.name}
              </span>
            </div>
          </div>

          {/* Right: Countdown Timer Widget */}
          <div
            className={`neo-card-sm px-3 py-1.5 flex items-center gap-2.5 border-2 border-black transition-all ${
              isUrgent
                ? 'bg-rose-100 border-rose-600 animate-pulse'
                : timerSeconds <= 15
                ? 'bg-amber-50'
                : 'bg-[#faf7ee]'
            }`}
          >
            <Clock
              className={`w-4 h-4 stroke-[2.5] ${
                isUrgent ? 'text-rose-600 animate-spin' : 'text-black'
              }`}
            />

            <span
              className={`font-heading text-lg sm:text-xl tracking-widest leading-none ${
                isUrgent ? 'text-rose-600 font-extrabold' : 'text-black'
              }`}
            >
              00:{timerSeconds < 10 ? `0${timerSeconds}` : timerSeconds}
            </span>

            {/* Compact Progress Bar */}
            <div className="w-12 sm:w-16 bg-slate-200 h-2.5 rounded-full border-2 border-black overflow-hidden p-0.5 hidden sm:block">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isUrgent
                    ? 'bg-rose-500'
                    : timerSeconds <= 15
                    ? 'bg-amber-400'
                    : 'bg-[#86efac]'
                }`}
                style={{ width: `${timerPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Text */}
        <h3 className="font-heading text-lg sm:text-2xl md:text-3xl text-black leading-snug mb-4">
          "{currentQ.question}"
        </h3>

        {/* Hints & Peek Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200">
          {currentQ.hint && (
            <button
              type="button"
              onClick={() => {
                setShowHint(!showHint);
                soundEffects.playTileClick();
              }}
              className="neo-btn-sm bg-[#faf7ee] text-black px-2.5 py-1 text-xs flex items-center gap-1.5 font-heading"
            >
              <Lightbulb className="w-3.5 h-3.5 stroke-[2.5]" />
              {showHint ? 'Hide Hint' : 'Show Hint'}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setShowAnswer(!showAnswer);
              soundEffects.playTileClick();
            }}
            className="neo-btn-sm bg-[#ffdf00] text-black px-2.5 py-1 text-xs flex items-center gap-1.5 font-heading"
          >
            {showAnswer ? (
              <EyeOff className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
            )}
            {showAnswer ? 'Hide Correct Answer' : 'Host: Peek Answer'}
          </button>
        </div>

        {/* Expandable Hint Box */}
        {showHint && currentQ.hint && (
          <div className="mt-3 p-2.5 bg-[#fff9e6] neo-card-sm text-xs font-mono font-bold text-black border-2 border-black">
            💡 <strong>HINT:</strong> {currentQ.hint}
          </div>
        )}

        {/* Expandable Correct Answer Box */}
        {showAnswer && (
          <div className="mt-3 p-2.5 bg-[#86efac] neo-card-sm text-xs font-mono font-bold text-black border-2 border-black">
            🎯 <strong>CORRECT ANSWER:</strong> {currentQ.answer}
          </div>
        )}
      </div>

      {/* ONE ROW LAYOUT: Which member is answering (Left) + Host Evaluation Decision (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left Column: Which Member Is Answering */}
        <div className="lg:col-span-5 neo-card bg-[#faf7ee] p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-heading text-xs sm:text-sm text-black flex items-center gap-1.5">
                <Users className="w-4 h-4 stroke-[2.5]" />
                MEMBER ANSWERING:
              </label>
              <span className="neo-badge bg-black text-white text-[10px] px-1.5 py-0.5 font-mono">
                +{cat.points} PTS
              </span>
            </div>
            <p className="text-[11px] font-mono font-semibold text-slate-600 mb-3">
              Select which <strong className="text-black">{activeTeam.name}</strong> player answered:
            </p>

            {/* Member Selection Chips */}
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
              {members.map((mem, idx) => {
                const isSelected = selectedMemberId === mem.id;
                return (
                  <button
                    key={mem.id || `mem-${idx}`}
                    type="button"
                    onClick={() => {
                      setSelectedMemberId(mem.id);
                      soundEffects.playTileClick();
                    }}
                    className={`p-2 text-left rounded-lg border-2 border-black transition-all flex items-center justify-between gap-1 text-xs font-mono font-bold ${
                      isSelected
                        ? 'bg-[#7dd3fc] text-black shadow-[3px_3px_0px_#000] scale-[1.02]'
                        : 'bg-white text-black hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{mem.name}</span>
                    <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded border border-black shrink-0">
                      {mem.score}p
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-black/20 flex items-center justify-between text-[10px] font-mono text-slate-600">
            <span>Points will be credited individually</span>
            <span className="font-bold text-black">{members.length} members in team</span>
          </div>
        </div>

        {/* Right Column: Host Evaluation Decision */}
        <div className="lg:col-span-7 neo-card-lg bg-white p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b-2 border-black pb-2">
              <span className="font-heading text-xs text-black flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 stroke-[2.5]" />
                HOST EVALUATION DECISION
              </span>
              <span className="text-[11px] font-mono font-bold text-rose-600">
                Wrong answer = -5 pts penalty
              </span>
            </div>

            {/* Decision Buttons Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Correct */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleCorrect}
                className="p-3 neo-btn bg-[#86efac] hover:bg-[#6ee7b7] text-black flex flex-col items-center justify-center gap-1 text-center disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                <span className="font-heading text-xs">CORRECT</span>
                <span className="text-[10px] font-mono font-bold">+{cat.points} PTS</span>
              </button>

              {/* Wrong (-5 Penalty + Steal) */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleWrong}
                className="p-3 neo-btn bg-[#ff7675] hover:bg-[#ff5252] text-black flex flex-col items-center justify-center gap-1 text-center disabled:opacity-50"
              >
                <XCircle className="w-5 h-5 stroke-[2.5]" />
                <span className="font-heading text-xs">WRONG</span>
                <span className="text-[10px] font-mono font-bold">-5p & Steal</span>
              </button>

              {/* Pass (0 Penalty + Steal) */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={handlePass}
                className="p-3 neo-btn bg-[#7dd3fc] hover:bg-[#38bdf8] text-black flex flex-col items-center justify-center gap-1 text-center disabled:opacity-50"
              >
                <Zap className="w-5 h-5 stroke-[2.5]" />
                <span className="font-heading text-xs">PASS / STEAL</span>
                <span className="text-[10px] font-mono font-bold">0p & Steal</span>
              </button>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-black/20 text-center text-[10px] font-mono font-bold text-slate-500">
            Clicking Wrong or Pass/Steal immediately activates the phone buzzer steal window for other teams
          </div>
        </div>
      </div>
    </div>
  );
};
