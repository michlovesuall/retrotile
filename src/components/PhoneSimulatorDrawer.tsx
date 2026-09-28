import React, { useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { GameState } from '../types/game';
import { PlayerPhoneView } from './PlayerPhoneView';
import { soundEffects } from '../utils/soundEffects';

interface PhoneSimulatorDrawerProps {
  gameState: GameState | null;
  onJoinTeam: (accessCode: string, memberNames: string[], teamName?: string) => Promise<any>;
  onBuzzSteal: (teamId: string) => Promise<any>;
  onClose?: () => void;
}

export const PhoneSimulatorDrawer: React.FC<PhoneSimulatorDrawerProps> = ({
  gameState,
  onJoinTeam,
  onBuzzSteal,
  onClose,
}) => {
  const [selectedTeamCode, setSelectedTeamCode] = useState<string>(
    gameState?.teams?.[0]?.accessCode || ''
  );

  React.useEffect(() => {
    if (gameState?.teams?.length) {
      if (!selectedTeamCode || !gameState.teams.some((t) => t.accessCode === selectedTeamCode)) {
        setSelectedTeamCode(gameState.teams[0].accessCode);
      }
    }
  }, [gameState?.teams, selectedTeamCode]);

  return (
    <div className="neo-card-lg bg-white flex flex-col h-full overflow-hidden shadow-[8px_8px_0px_#000]">
      {/* Simulator Bezel */}
      <div className="bg-[#fffdfa] p-3 border-b-3 border-black flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 stroke-[2.5]" />
          <span className="font-heading text-xs text-black">PHONE SIMULATOR</span>
        </div>

        {gameState && gameState.teams.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold text-slate-600 hidden sm:inline">TEAM:</span>
            <select
              value={selectedTeamCode}
              onChange={(e) => {
                setSelectedTeamCode(e.target.value);
                soundEffects.playTileClick();
              }}
              className="neo-input text-xs font-mono font-bold text-black py-1 px-2"
            >
              {gameState.teams.map((t) => (
                <option key={t.id} value={t.accessCode}>
                  {t.name} ({t.accessCode})
                </option>
              ))}
            </select>
          </div>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 text-black rounded"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Simulator Content */}
      <div className="flex-1 overflow-y-auto p-2 bg-[#faf7ee]">
        <PlayerPhoneView
          key={selectedTeamCode}
          gameState={gameState}
          onJoinTeam={onJoinTeam}
          onBuzzSteal={onBuzzSteal}
          prefilledAccessCode={selectedTeamCode}
          isSimulator={true}
        />
      </div>
    </div>
  );
};
