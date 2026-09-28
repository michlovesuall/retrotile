import React, { useState } from 'react';
import { Siren, Zap, CheckCircle2, XCircle, SkipForward, Users } from 'lucide-react';
import { GameState, Question } from '../types/game';
import { CATEGORIES } from '../data/defaultQuestions';
import { soundEffects } from '../utils/soundEffects';

interface StealPhaseModalProps {
  gameState: GameState;
  questions: Question[];
  onResolveSteal: (isCorrect: boolean, memberId?: string, noOneStole?: boolean) => Promise<void>;
  onSimulateBuzz: (teamId: string) => Promise<any>;
}

export const StealPhaseModal: React.FC<StealPhaseModalProps> = ({
  gameState,
  questions = [],
  onResolveSteal,
  onSimulateBuzz,
}) => {
  const defaultFallbackQuestion: Question = {
    id: gameState?.selectedTileId || '1',
    question: 'Question data loading or unavailable.',
    answer: 'N/A',
    category: 'beginner',
    points: 2,
  };

  const currentQ: Question =
    (questions && questions.length > 0 && questions.find((q) => q && q.id === gameState?.selectedTileId)) ||
    (questions && questions.length > 0 && questions[0]) ||
    defaultFallbackQuestion;

  const cat = (currentQ?.category && CATEGORIES[currentQ.category]) || CATEGORIES.beginner;

  const originalTeamId = gameState?.turnOrder && gameState.turnOrder.length > 0
    ? gameState.turnOrder[gameState.currentTurnIndex % gameState.turnOrder.length]
    : gameState?.teams?.[0]?.id || '';

  const originalTeam = (gameState?.teams && gameState.teams.find((t) => t.id === originalTeamId)) ||
    gameState?.teams?.[0] || {
      id: 'team-default',
      name: 'Team 1',
      color: '#ffdf00',
      score: 0,
      maxScore: 60,
      members: [],
      accessCode: 'TEAM-1'
    };

  const lockedSteal = gameState?.stealState?.lockedBy;
  const stealingTeam = lockedSteal && gameState?.teams
    ? gameState.teams.find((t) => t.id === lockedSteal.teamId)
    : null;

  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    stealingTeam?.members?.[0]?.id || ''
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const eligibleOpponentTeams = (gameState?.teams || []).filter((t) => t.id !== originalTeamId);

  const handleCorrectSteal = async () => {
    setIsProcessing(true);
    soundEffects.playCorrect();
    try {
      await onResolveSteal(true, selectedMemberId);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWrongSteal = async () => {
    setIsProcessing(true);
    soundEffects.playWrong();
    try {
      await onResolveSteal(false, selectedMemberId);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNoSteal = async () => {
    setIsProcessing(true);
    soundEffects.playTileClick();
    try {
      await onResolveSteal(false, undefined, true);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4">
      {/* Alert Header */}
      <div className="neo-card-lg bg-[#ff7675] p-4 sm:p-5 text-center mb-4 border-3 border-black shadow-[6px_6px_0px_#000]">
        <div className="flex items-center justify-center gap-3 mb-1.5">
          <Siren className="w-7 h-7 stroke-[2.5] text-black animate-bounce" />
          <h2 className="font-heading text-xl sm:text-3xl text-black">
            STEAL OPPORTUNITY ACTIVE!
          </h2>
          <Siren className="w-7 h-7 stroke-[2.5] text-black animate-bounce" />
        </div>
        <p className="font-sans text-xs sm:text-sm font-bold text-black max-w-xl mx-auto">
          {originalTeam.name} missed! First opponent to buzz in can steal <span className="underline decoration-2">+{cat.points} Points</span> ({cat.name.toUpperCase()} Level)!
        </p>
      </div>

      {/* Lock Status Section */}
      <div className="neo-card-lg bg-white p-5 sm:p-6 text-center">
        {lockedSteal && stealingTeam ? (
          <div>
            <div className="inline-block neo-badge bg-[#86efac] text-black px-3 py-1 text-xs font-heading mb-3 rotate-[-1deg]">
              ⚡ BUZZER REGISTERED FIRST!
            </div>
            <h3 className="font-heading text-3xl sm:text-4xl text-black mb-2">
              {stealingTeam.name.toUpperCase()} LOCKED THE STEAL!
            </h3>
            <p className="font-mono text-xs font-bold text-slate-600">
              Buzzed at {new Date(lockedSteal.buzzedAt).toLocaleTimeString()}
            </p>

            {/* Member selector for stealing team */}
            <div className="mt-6 p-4 neo-card bg-[#faf7ee] max-w-lg mx-auto text-left">
              <label className="block font-heading text-xs text-black mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 stroke-[2.5]" />
                WHICH MEMBER FROM {stealingTeam.name.toUpperCase()} GAVE THE STEAL ANSWER?
              </label>
              <div className="flex flex-wrap gap-2">
                {stealingTeam.members.map((mem) => (
                  <button
                    key={mem.id}
                    type="button"
                    onClick={() => {
                      setSelectedMemberId(mem.id);
                      soundEffects.playTileClick();
                    }}
                    className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border-2 border-black transition-all ${
                      (selectedMemberId || stealingTeam.members[0].id) === mem.id
                        ? 'bg-[#7dd3fc] text-black shadow-[2px_2px_0px_#000]'
                        : 'bg-white text-black hover:bg-slate-50'
                    }`}
                  >
                    {mem.name} ({mem.score} pts)
                  </button>
                ))}
              </div>
            </div>

            {/* Decision Outcomes */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleCorrectSteal}
                className="neo-btn bg-[#86efac] hover:bg-[#6ee7b7] text-black px-6 py-4 text-xs sm:text-sm font-heading flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                STEAL IS CORRECT (+{cat.points} PTS)
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleWrongSteal}
                className="neo-btn bg-[#ff7675] hover:bg-[#ff5252] text-black px-6 py-4 text-xs sm:text-sm font-heading flex items-center gap-2 disabled:opacity-50"
              >
                <XCircle className="w-5 h-5 stroke-[2.5]" />
                STEAL IS WRONG (-5 PTS PENALTY)
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="inline-block neo-badge bg-[#ffdf00] text-black px-3 py-1 text-xs font-heading mb-3 animate-pulse">
              WAITING FOR TEAM BUZZERS...
            </div>
            <p className="font-sans text-base sm:text-lg font-bold text-slate-800 mb-6">
              Opponent teams can now tap the giant STEAL button on their phones!
            </p>

            {/* Quick Test Buzz Simulator */}
            <div className="p-4 neo-card bg-[#faf7ee] max-w-xl mx-auto">
              <span className="text-xs font-heading text-black block mb-2">
                HOST QUICK TEST: TRIGGER BUZZ FOR OPPONENT TEAM
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {eligibleOpponentTeams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => {
                      soundEffects.playBuzzer();
                      onSimulateBuzz(team.id);
                    }}
                    className="neo-btn-sm px-3 py-2 text-xs font-heading text-black"
                    style={{ backgroundColor: team.color }}
                  >
                    BUZZ AS {team.name.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Skip Option */}
            <div className="mt-6">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleNoSteal}
                className="neo-btn-sm bg-white text-black px-4 py-2 text-xs font-heading inline-flex items-center gap-2"
              >
                <SkipForward className="w-4 h-4 stroke-[2.5]" />
                NO TEAM STOLE / CANCEL & CONTINUE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
