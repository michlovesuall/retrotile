import React, { useState, useEffect } from 'react';
import { Shuffle, ArrowRight, Play, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';
import { GameState, Team } from '../types/game';
import { soundEffects } from '../utils/soundEffects';

interface ShufflePhaseProps {
  gameState: GameState;
  onShuffleAgain: () => Promise<void>;
  onStartGameBoard: () => void;
}

export const ShufflePhase: React.FC<ShufflePhaseProps> = ({
  gameState,
  onShuffleAgain,
  onStartGameBoard,
}) => {
  const [isShuffling, setIsShuffling] = useState(false);
  const [displayOrder, setDisplayOrder] = useState<Team[]>([]);

  const orderedTeams = gameState.turnOrder
    .map((id) => gameState.teams.find((t) => t.id === id))
    .filter(Boolean) as Team[];

  useEffect(() => {
    setDisplayOrder(orderedTeams);
  }, [gameState.turnOrder, gameState.teams]);

  const handleShuffle = async () => {
    setIsShuffling(true);
    let count = 0;
    const maxSpins = 16;

    const interval = setInterval(() => {
      soundEffects.playShuffle();
      setDisplayOrder((prev) => [...prev].sort(() => Math.random() - 0.5));
      count++;

      if (count >= maxSpins) {
        clearInterval(interval);
        onShuffleAgain().then(() => {
          setIsShuffling(false);
          soundEffects.playCoin();
          try {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.6 },
            });
          } catch (e) {}
        });
      }
    }, 90);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Title Marquee */}
      <div className="neo-card-lg bg-white p-6 sm:p-8 text-center mb-8">
        <div className="inline-block neo-badge bg-[#7dd3fc] text-black px-4 py-1 text-xs font-heading mb-3 rotate-[-2deg]">
          TURN ORDER RANDOMIZER
        </div>
        <h2 className="font-heading text-3xl sm:text-4xl text-black">
          TURN ORDER SHUFFLE
        </h2>
        <p className="font-sans text-sm sm:text-base font-semibold text-slate-700 mt-2">
          Who will choose the first tile? Reshuffle or proceed to the game board!
        </p>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={isShuffling}
            onClick={handleShuffle}
            className="neo-btn bg-[#ffdf00] hover:bg-[#fed330] text-black px-6 py-3.5 text-xs sm:text-sm font-heading flex items-center gap-2 disabled:opacity-50"
          >
            <Shuffle className={`w-4 h-4 stroke-[2.5] ${isShuffling ? 'animate-spin' : ''}`} />
            {isShuffling ? 'SHUFFLING REELS...' : 'RESHUFFLE TURN ORDER'}
          </button>
        </div>
      </div>

      {/* Shuffled Order Display */}
      <div className="space-y-3 mb-8">
        {displayOrder.map((team, index) => {
          const isFirst = index === 0;
          return (
            <div
              key={team.id}
              className={`neo-card p-4 sm:p-5 flex items-center justify-between transition-all ${
                isFirst
                  ? 'bg-[#fff9e6] shadow-[6px_6px_0px_#000] scale-[1.01]'
                  : 'bg-white'
              }`}
              style={{ borderLeft: `10px solid ${team.color}` }}
            >
              <div className="flex items-center gap-4">
                {/* Position Badge */}
                <div
                  className={`w-12 h-12 neo-card flex flex-col items-center justify-center font-heading ${
                    isFirst ? 'bg-[#ffdf00] text-black' : 'bg-[#faf7ee] text-slate-900'
                  }`}
                >
                  <span className="text-[9px] uppercase font-mono font-bold leading-none">TURN</span>
                  <span className="text-base font-extrabold leading-none mt-0.5">#{index + 1}</span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-lg sm:text-xl text-black">
                      {team.name}
                    </h3>
                    {isFirst && (
                      <span className="neo-badge bg-[#86efac] text-black text-[10px] px-2 py-0.5 font-heading flex items-center gap-1">
                        <Flame className="w-3 h-3 fill-black" />
                        CHOOSES 1ST TILE!
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-600 mt-1">
                    {team.members.map((m) => m.name).join(', ')} ({team.members.length} Players · Max {team.maxScore} PTS)
                  </p>
                </div>
              </div>

              {/* Access Pin Info */}
              <div className="text-right hidden sm:block">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                  PIN CODE
                </span>
                <span className="neo-badge bg-[#faf7ee] text-black text-xs font-mono font-extrabold px-2 py-0.5">
                  {team.accessCode}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Start Game CTA */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            soundEffects.playCoin();
            onStartGameBoard();
          }}
          className="neo-btn bg-[#86efac] hover:bg-[#6ee7b7] text-black px-10 py-5 text-sm sm:text-base font-heading inline-flex items-center gap-3"
        >
          <Play className="w-5 h-5 fill-black stroke-black" />
          ENTER {gameState.totalQuestionsTarget || 50}-TILE GAME BOARD
          <ArrowRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
