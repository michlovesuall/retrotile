import React from 'react';
import { Volume2, VolumeX, Monitor, Smartphone, RotateCcw, Sparkles, HelpCircle } from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

interface NavbarProps {
  viewMode: 'host' | 'player' | 'simulator';
  role: 'host' | 'player' | null;
  setViewMode: (mode: 'host' | 'player' | 'simulator') => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  scanlines: boolean;
  setScanlines: (on: boolean) => void;
  isConnected: boolean;
  onResetGame: () => void;
  onOpenQuestionEditor: () => void;
  questionCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  viewMode,
  role,
  setViewMode,
  isMuted,
  setIsMuted,
  scanlines,
  setScanlines,
  isConnected,
  onResetGame,
  onOpenQuestionEditor,
  questionCount,
}) => {
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEffects.setMuted(next);
    if (!next) soundEffects.playCoin();
  };

  return (
    <header className="sticky top-0 z-40 bg-[#fffdfa] border-b-3 border-black px-4 py-3 shadow-[0_4px_0_0_#000]">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#ffdf00] border-3 border-black shadow-[3px_3px_0px_#000] rounded-xl flex items-center justify-center font-heading text-sm text-black -rotate-3 hover:rotate-0 transition-transform">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-lg sm:text-xl tracking-tight text-black">
                RETRO TILE SHOWDOWN
              </h1>
              <span className="neo-badge bg-[#86efac] text-[10px] px-2 py-0.5 uppercase hidden sm:inline-block">
                NEO-ARCADE
              </span>
            </div>
            <p className="text-xs font-mono font-bold text-slate-600 hidden md:block">
              {questionCount || 50} TILES · 5 DIFFICULTY TIERS · LIVE STEAL BUZZERS
            </p>
          </div>
        </div>

        {/* Active View Mode Badge */}
        {role && (
          <div className="flex items-center gap-2">
            {role === 'host' && viewMode === 'simulator' && (
              <span className="neo-badge bg-[#ffdf00] text-black text-xs font-heading px-3 py-1.5 border-2 border-black flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> DUAL TEST MODE
              </span>
            )}
            {role === 'host' && viewMode === 'host' && (
              <span className="neo-badge bg-[#7dd3fc] text-black text-xs font-heading px-3 py-1.5 border-2 border-black flex items-center gap-1">
                <Monitor className="w-3.5 h-3.5" /> HOST MODE
              </span>
            )}
            {role === 'player' && (
              <span className="neo-badge bg-[#f472b6] text-black text-xs font-heading px-3 py-1.5 border-2 border-black flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5" /> PLAYER INTERFACE
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Question Bank Manager (Hidden on Landing Page, visible in Host view) */}
          {role === 'host' && (
            <button
              onClick={onOpenQuestionEditor}
              className="neo-btn-sm bg-[#ffdf00] text-black px-3 py-1.5 text-xs flex items-center gap-1.5"
              title="Questions Bank Editor"
            >
              <HelpCircle className="w-4 h-4 stroke-[2.5]" />
              <span className="font-heading">Q-BANK {questionCount !== undefined ? `(${questionCount})` : ''}</span>
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`neo-btn-sm p-1.5 ${
              !isMuted ? 'bg-[#86efac] text-black' : 'bg-slate-200 text-slate-500'
            }`}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 stroke-[2.5]" /> : <Volume2 className="w-4 h-4 stroke-[2.5]" />}
          </button>

          {/* Reset Game - Strictly visible for Host only (Requirement 1) */}
          {role === 'host' && (
            <button
              onClick={onResetGame}
              className="neo-btn-sm bg-[#ff7675] hover:bg-[#ff5252] text-black px-2.5 py-1.5 text-xs flex items-center gap-1 font-heading"
              title="Reset Game (Host Only)"
            >
              <RotateCcw className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">RESET</span>
            </button>
          )}

          {/* Connection Status */}
          <div
            className={`neo-badge text-[11px] font-mono font-bold px-2.5 py-1 ${
              isConnected ? 'bg-[#86efac] text-black' : 'bg-[#fed330] text-black'
            }`}
            title={isConnected ? 'WebSocket Server Connected' : 'Polling Sync Mode Active'}
          >
            <span className={`w-2 h-2 rounded-full mr-1.5 border border-black ${isConnected ? 'bg-black animate-ping' : 'bg-black'}`} />
            <span className="hidden xl:inline">{isConnected ? 'LIVE SYNC' : 'SYNCING'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
