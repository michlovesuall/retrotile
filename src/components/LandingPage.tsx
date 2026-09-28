import React from 'react';
import { Monitor, Smartphone, Sparkles, Clock, AlertTriangle, Zap, Shuffle, Users, CheckCircle, Shield } from 'lucide-react';
import { CATEGORIES } from '../data/defaultQuestions';
import { soundEffects } from '../utils/soundEffects';

interface LandingPageProps {
  onSelectHost: () => void;
  onSelectPlayer: () => void;
  onSelectDualTest: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSelectHost,
  onSelectPlayer,
  onSelectDualTest,
}) => {
  const [showPinPrompt, setShowPinPrompt] = React.useState<'host' | 'dual' | null>(null);
  const [pinInput, setPinInput] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '062700') {
      soundEffects.playCoin();
      const target = showPinPrompt;
      setShowPinPrompt(null);
      setPinInput('');
      setErrorMsg('');
      if (target === 'host') {
        onSelectHost();
      } else if (target === 'dual') {
        onSelectDualTest();
      }
    } else {
      soundEffects.playWrong();
      setErrorMsg('⚠️ ACCESS DENIED: INVALID HOST PIN');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 neo-badge bg-[#ffdf00] text-black px-4 py-1 text-xs font-heading mb-3 rotate-[-1deg]">
          <span>★</span> OFFICIAL GAME MECHANICS <span>★</span>
        </div>
        <h1 className="font-heading text-3xl sm:text-5xl md:text-6xl text-black tracking-tight leading-none mb-3">
          RETRO TILE QUIZ SHOWDOWN
        </h1>
        <p className="font-sans text-sm sm:text-base text-slate-700 font-semibold max-w-xl mx-auto">
          An arcade-style tile trivia challenge with tiered difficulties, live buzzers, individual player tracking, and rapid-fire point stealing.
        </p>
      </div>

      {/* 3 Action Buttons in the Middle */}
      <div className="neo-card-lg bg-white p-5 sm:p-7 mb-10 border-3 border-black shadow-[8px_8px_0px_#000]">
        <div className="text-center mb-4">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
            CHOOSE YOUR VIEW MODE TO BEGIN
          </span>
          <h2 className="font-heading text-xl sm:text-2xl text-black mt-0.5">
            START OR JOIN THE SHOWDOWN
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {/* 1. HOST Button */}
          <button
            type="button"
            onClick={() => {
              soundEffects.playTileClick();
              setShowPinPrompt('host');
              setPinInput('');
              setErrorMsg('');
            }}
            className="neo-card p-5 bg-[#7dd3fc] hover:bg-[#38bdf8] text-black text-left flex flex-col justify-between transition-transform hover:-translate-y-1 active:translate-y-0 cursor-pointer group shadow-[5px_5px_0px_#000]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 neo-card bg-white text-black flex items-center justify-center">
                <Monitor className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span className="neo-badge bg-black text-white text-[10px] font-mono px-2 py-0.5 uppercase">
                ADMIN
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono font-bold text-black/70 uppercase block">
                MAIN BOARD & CONTROLS
              </span>
              <h3 className="font-heading text-2xl text-black tracking-wide">
                HOST
              </h3>
              <p className="text-xs font-sans text-slate-900 font-medium mt-1">
                Projector / TV big-screen tile grid, admin setup, and question host controls.
              </p>
            </div>
          </button>

          {/* 2. PLAYER Button */}
          <button
            type="button"
            onClick={() => {
              soundEffects.playTileClick();
              onSelectPlayer();
            }}
            className="neo-card p-5 bg-[#f472b6] hover:bg-[#f43f5e] text-black text-left flex flex-col justify-between transition-transform hover:-translate-y-1 active:translate-y-0 cursor-pointer group shadow-[5px_5px_0px_#000]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 neo-card bg-white text-black flex items-center justify-center">
                <Smartphone className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span className="neo-badge bg-black text-white text-[10px] font-mono px-2 py-0.5 uppercase">
                CLIENT
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono font-bold text-black/70 uppercase block">
                MOBILE PHONE SCREEN
              </span>
              <h3 className="font-heading text-2xl text-black tracking-wide">
                PLAYER
              </h3>
              <p className="text-xs font-sans text-slate-900 font-medium mt-1">
                Join with your team access code or QR scan to buzz in and steal points.
              </p>
            </div>
          </button>

          {/* 3. DUAL TEST Button */}
          <button
            type="button"
            onClick={() => {
              soundEffects.playTileClick();
              setShowPinPrompt('dual');
              setPinInput('');
              setErrorMsg('');
            }}
            className="neo-card p-5 bg-[#ffdf00] hover:bg-[#fed330] text-black text-left flex flex-col justify-between transition-transform hover:-translate-y-1 active:translate-y-0 cursor-pointer group shadow-[5px_5px_0px_#000]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 neo-card bg-white text-black flex items-center justify-center">
                <Sparkles className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span className="neo-badge bg-black text-white text-[10px] font-mono px-2 py-0.5 uppercase">
                SPLIT
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono font-bold text-black/70 uppercase block">
                LOCAL SIMULATOR
              </span>
              <h3 className="font-heading text-2xl text-black tracking-wide">
                DUAL TEST
              </h3>
              <p className="text-xs font-sans text-slate-900 font-medium mt-1">
                Side-by-side view with the Host Board on the left and a live Phone Buzzer on the right.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* GAME MECHANICS SECTION */}
      <div className="space-y-6">
        {/* Mechanics Section Title */}
        <div className="flex items-center gap-2 border-b-3 border-black pb-3">
          <span className="neo-badge bg-black text-white px-2.5 py-1 text-xs font-heading">
            RULES
          </span>
          <h2 className="font-heading text-xl sm:text-2xl text-black">
            COMPLETE GAME MECHANICS & PLAYBOOK
          </h2>
        </div>

        {/* 1. Difficulty Matrix & Point Values */}
        <div className="neo-card bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 neo-card bg-[#ffdf00] text-[#000] flex items-center justify-center font-heading text-xs">
              01
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">
                CORE MATRIX
              </span>
              <h3 className="font-heading text-base sm:text-lg text-black">
                5 DIFFICULTY TIERS & TILE REMOVAL
              </h3>
            </div>
          </div>

          <p className="text-xs font-sans text-slate-700 font-semibold mb-4 leading-relaxed">
            The board displays questions categorized across 5 difficulty levels. When a team selects a tile, that specific tile is revealed and permanently removed from the board once answered.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {Object.values(CATEGORIES).map((cat) => (
              <div
                key={cat.id}
                className="neo-card p-3 flex flex-col justify-between"
                style={{ backgroundColor: cat.color }}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="neo-badge bg-white text-black px-2 py-0.5 text-[10px] font-heading">
                      {cat.name}
                    </span>
                    <span className="font-heading text-base text-black">
                      +{cat.points}p
                    </span>
                  </div>
                  <p className="text-[11px] font-sans font-semibold text-black leading-snug">
                    {cat.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2-Column Rules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 2. 30-Second Countdown */}
          <div className="neo-card bg-white p-5 flex items-start gap-4">
            <div className="w-10 h-10 neo-card bg-[#86efac] text-black flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="neo-badge bg-black text-white text-[9px] font-mono px-1.5 py-0.2">
                  RULE 02
                </span>
                <h4 className="font-heading text-sm text-black">
                  DECISIVE COUNTDOWN CLOCK
                </h4>
              </div>
              <p className="text-xs font-sans text-slate-700 font-semibold leading-relaxed">
                Revealing a tile activates an immediate <strong>30-second countdown</strong>. The active team must discuss and announce their final answer before the buzzer alerts.
              </p>
            </div>
          </div>

          {/* 3. Wrong Answer Penalty vs Pass */}
          <div className="neo-card bg-white p-5 flex items-start gap-4">
            <div className="w-10 h-10 neo-card bg-[#ff7675] text-black flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="neo-badge bg-black text-white text-[9px] font-mono px-1.5 py-0.2">
                  RULE 03
                </span>
                <h4 className="font-heading text-sm text-black">
                  WRONG (-5 PTS) VS PASS (0 PTS)
                </h4>
              </div>
              <p className="text-xs font-sans text-slate-700 font-semibold leading-relaxed">
                Giving an incorrect answer inflicts a <strong>-5 points penalty</strong> and triggers the Steal Phase. Teams may alternatively choose to <strong>PASS (0 points penalty)</strong> to safely unlock the Steal Phase for others without losing points.
              </p>
            </div>
          </div>

          {/* 4. Multi-Stage Steal Exclusion */}
          <div className="neo-card bg-white p-5 flex items-start gap-4">
            <div className="w-10 h-10 neo-card bg-[#f472b6] text-black flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="neo-badge bg-black text-white text-[9px] font-mono px-1.5 py-0.2">
                  RULE 04
                </span>
                <h4 className="font-heading text-sm text-black">
                  MULTI-STAGE CUMULATIVE STEALS
                </h4>
              </div>
              <p className="text-xs font-sans text-slate-700 font-semibold leading-relaxed">
                When a steal occurs, the first opponent team to buzz in locks the steal. If they get it wrong, they suffer the <strong>-5 pts penalty</strong> and are <strong>excluded</strong>, and the buzzer is re-opened for remaining non-excluded teams!
              </p>
            </div>
          </div>

          {/* 5. Proportional Max & MVP Leaderboard */}
          <div className="neo-card bg-white p-5 flex items-start gap-4">
            <div className="w-10 h-10 neo-card bg-[#c084fc] text-black flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="neo-badge bg-black text-white text-[9px] font-mono px-1.5 py-0.2">
                  RULE 05
                </span>
                <h4 className="font-heading text-sm text-black">
                  PROPORTIONAL CAP & MVP LEADERBOARD
                </h4>
              </div>
              <p className="text-xs font-sans text-slate-700 font-semibold leading-relaxed">
                Each active member adds <strong>20 maximum points</strong> to the team capacity. Points scored are distributed both to the team score and to the answering individual for a live MVP Leaderboard!
              </p>
            </div>
          </div>

          {/* 6. Slot-Machine Randomizer */}
          <div className="neo-card bg-white p-5 flex items-start gap-4">
            <div className="w-10 h-10 neo-card bg-[#fb923c] text-black flex items-center justify-center shrink-0">
              <Shuffle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="neo-badge bg-black text-white text-[9px] font-mono px-1.5 py-0.2">
                  RULE 06
                </span>
                <h4 className="font-heading text-sm text-black">
                  SLOT-MACHINE TURN SHUFFLE
                </h4>
              </div>
              <p className="text-xs font-sans text-slate-700 font-semibold leading-relaxed">
                Before the board opens, teams are shuffled using an animated slot machine sequencer to randomly set a fair, authoritative playing order.
              </p>
            </div>
          </div>

          {/* 7. Host PIN Security Gate */}
          <div className="neo-card bg-[#faf7ee] border-2 border-dashed border-black/40 p-5 flex items-start gap-4">
            <div className="w-10 h-10 neo-card bg-[#ffdf00] text-black flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="neo-badge bg-black text-white text-[9px] font-mono px-1.5 py-0.2">
                  RULE 07
                </span>
                <h4 className="font-heading text-sm text-black">
                  SECURE HOST AUTHORIZATION
                </h4>
              </div>
              <p className="text-xs font-sans text-slate-700 font-semibold leading-relaxed">
                Host actions, simulation tools, and full board questions/answers are securely protected by a 6-digit Host Authorization PIN to prevent player interference.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Retro Arcade Host PIN Gate Modal */}
      {showPinPrompt && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="neo-card-lg max-w-sm w-full bg-[#faf7ee] p-6 border-4 border-black shadow-[8px_8px_0px_#000] text-center relative animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 neo-card bg-[#ffdf00] text-black flex items-center justify-center mx-auto mb-4 border-2 border-black">
              <Shield className="w-8 h-8 stroke-[2.5]" />
            </div>

            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 block mb-1">
              HOST SECURITY GATE
            </span>
            <h3 className="font-heading text-xl text-black uppercase mb-1">
              ENTER HOST PIN
            </h3>
            <p className="text-xs font-sans font-semibold text-slate-600 mb-4">
              Please enter the 6-digit Host Authorization PIN to access administrative game views.
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setPinInput(clean);
                    setErrorMsg('');
                  }}
                  placeholder="••••••"
                  className="w-full tracking-[1em] text-center font-heading text-2xl py-3 border-3 border-black rounded-none bg-white text-black shadow-[4px_4px_0px_#000] focus:outline-none focus:ring-0 focus:border-black placeholder:text-slate-300"
                  autoFocus
                  required
                />
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-red-100 border-2 border-red-500 text-red-600 font-mono text-[11px] font-bold">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playTileClick();
                    setShowPinPrompt(null);
                    setPinInput('');
                    setErrorMsg('');
                  }}
                  className="py-2.5 px-4 neo-btn bg-slate-200 hover:bg-slate-300 text-black text-xs font-heading uppercase"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-4 neo-btn bg-[#86efac] hover:bg-[#6ee7b7] text-black text-xs font-heading uppercase"
                >
                  ACCESS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
