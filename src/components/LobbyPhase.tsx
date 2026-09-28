import React, { useState, useEffect } from 'react';
import { Smartphone, Users, CheckCircle2, Clock, Shuffle, Copy, Check, QrCode, X, ArrowRight, ShieldCheck, Gamepad2 } from 'lucide-react';
import { GameState, Team } from '../types/game';
import { QRCodeDisplay } from './QRCodeDisplay';
import { soundEffects } from '../utils/soundEffects';

interface LobbyPhaseProps {
  gameState: GameState;
  onProceedToShuffle: () => void;
  onOpenPhoneViewForTeam: (accessCode: string) => void;
}

export const LobbyPhase: React.FC<LobbyPhaseProps> = ({
  gameState,
  onProceedToShuffle,
  onOpenPhoneViewForTeam,
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [qrModalTeam, setQrModalTeam] = useState<Team | null>(null);
  const [lanUrl, setLanUrl] = useState<string>('');

  useEffect(() => {
    fetch('/api/lan-info')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.primaryUrl) {
          setLanUrl(data.primaryUrl);
        }
      })
      .catch(() => {});
  }, []);

  const currentJoinUrl = lanUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  const handleCopyCode = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    soundEffects.playTileClick();
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const joinedTeams = gameState.teams.filter((t) => t.isJoined);
  const readyCount = joinedTeams.length;
  const totalTeams = gameState.teams.length;
  const canStartGame = readyCount >= 1; // Can start as long as at least 1 team joined

  const getTeamJoinUrl = (accessCode: string) => {
    return `${currentJoinUrl}/?code=${encodeURIComponent(accessCode)}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Top Banner: Host Game Lobby */}
      <div className="neo-card-lg bg-[#fffdfa] p-6 mb-8 border-3 border-black text-center relative overflow-hidden">
        <div className="inline-block neo-badge bg-[#86efac] text-black px-4 py-1 text-xs font-heading mb-3 rotate-[-1deg] border-2 border-black">
          🟢 LIVE GAME LOBBY CREATED
        </div>
        
        <h2 className="font-heading text-2xl sm:text-4xl text-black tracking-tight">
          TEAMS: ENTER ACCESS CODES TO JOIN
        </h2>
        <p className="font-sans text-sm sm:text-base font-semibold text-slate-700 max-w-2xl mx-auto mt-2">
          Players open <span className="font-mono text-black font-extrabold bg-[#7dd3fc] px-2 py-0.5 rounded border border-black">{currentJoinUrl}</span> on your phone and enter your assigned team PIN below!
        </p>

        {/* Connection Link & General QR */}
        <div className="mt-5 pt-5 border-t-2 border-black/10 flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2 bg-[#faf7ee] neo-card-sm px-4 py-2">
            <span className="text-xs font-mono font-bold text-slate-600">APP URL:</span>
            <span className="font-mono text-sm font-extrabold text-black">{currentJoinUrl}</span>
            <button
              type="button"
              onClick={() => handleCopyCode(currentJoinUrl, 'url')}
              className="neo-btn-sm bg-white hover:bg-slate-100 text-black px-2.5 py-1 text-xs font-heading ml-2"
            >
              {copiedCode === 'url' ? 'COPIED!' : 'COPY'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="neo-badge bg-[#ffdf00] text-black text-xs font-heading px-3 py-1.5 border-2 border-black">
              {readyCount} / {totalTeams} TEAMS CHECKED IN
            </span>
          </div>
        </div>
      </div>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {gameState.teams.map((team, idx) => (
          <div
            key={team.id}
            className={`neo-card p-5 bg-white relative overflow-hidden transition-all ${
              team.isJoined ? 'border-4 border-black shadow-[6px_6px_0px_#000]' : 'opacity-90'
            }`}
            style={{ borderTop: `10px solid ${team.color}` }}
          >
            {/* Team Header & Status */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                  TEAM #{idx + 1}
                </span>
                <h3 className="font-heading text-lg sm:text-xl text-black truncate max-w-[180px]">
                  {team.name}
                </h3>
              </div>

              {/* Status Badge */}
              <div
                className={`neo-badge text-xs px-2.5 py-1 shrink-0 ${
                  team.isJoined
                    ? 'bg-[#86efac] text-black border-2 border-black'
                    : 'bg-[#ffdf00] text-black border-2 border-black animate-pulse'
                }`}
              >
                {team.isJoined ? (
                  <span className="flex items-center font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 stroke-[2.5]" /> JOINED
                  </span>
                ) : (
                  <span className="flex items-center font-bold">
                    <Clock className="w-3.5 h-3.5 mr-1 stroke-[2.5]" /> WAITING
                  </span>
                )}
              </div>
            </div>

            {/* Access PIN Box */}
            <div className="neo-card-sm bg-[#faf7ee] p-3.5 mb-4 border-2 border-black">
              <span className="text-[10px] font-mono font-bold text-slate-600 uppercase block mb-0.5">
                REQUIRED ACCESS CODE
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-heading text-2xl text-black tracking-widest">
                  {team.accessCode}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopyCode(team.accessCode, team.accessCode)}
                    className="neo-btn-sm bg-white hover:bg-slate-100 text-black p-2 text-xs font-heading"
                    title="Copy Access Code"
                  >
                    {copiedCode === team.accessCode ? (
                      <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    ) : (
                      <Copy className="w-4 h-4 stroke-[2.5]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playTileClick();
                      setQrModalTeam(team);
                    }}
                    className="neo-btn-sm bg-[#ffdf00] hover:bg-[#fed330] text-black p-2 text-xs font-heading"
                    title="Show direct QR code for this team"
                  >
                    <QrCode className="w-4 h-4 stroke-[2.5]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playTileClick();
                      onOpenPhoneViewForTeam(team.accessCode);
                    }}
                    className="neo-btn-sm bg-[#7dd3fc] hover:bg-[#38bdf8] text-black p-2 text-xs font-heading"
                    title="Open phone view as this team"
                  >
                    <Smartphone className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </div>

            {/* Roster & Members */}
            <div>
              <div className="flex items-center justify-between text-xs font-heading text-slate-700 mb-1.5">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 stroke-[2.5]" />
                  ROSTER ({team.members.length})
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-500">
                  {team.isJoined ? 'Ready' : 'Pending'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 p-2 bg-[#faf7ee] neo-card-sm min-h-[38px] border-2 border-black">
                {team.members.map((mem, mIdx) => (
                  <span
                    key={mem.id || mIdx}
                    className="neo-badge bg-white text-black px-2 py-0.5 text-xs font-mono font-bold border border-black"
                  >
                    {mem.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Host Controls Footer */}
      <div className="neo-card-lg bg-[#fffdfa] p-6 flex flex-wrap items-center justify-between gap-4 border-3 border-black">
        <div>
          <h4 className="font-heading text-lg text-black flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 stroke-[2.5]" />
            HOST LOBBY CONTROLS
          </h4>
          <p className="text-xs font-sans text-slate-700 font-bold mt-0.5">
            {readyCount === totalTeams
              ? '🎉 All teams have joined! Click below to shuffle turn order and launch the game.'
              : readyCount >= 1
              ? `${readyCount} of ${totalTeams} teams have joined. You can launch now or wait for remaining teams.`
              : 'Waiting for teams to enter their access codes...'}
          </p>
        </div>

        <button
          type="button"
          disabled={!canStartGame}
          onClick={() => {
            soundEffects.playShuffle();
            onProceedToShuffle();
          }}
          className="neo-btn bg-[#86efac] hover:bg-[#6ee7b7] text-black px-8 py-4 text-sm sm:text-base font-heading flex items-center gap-3 disabled:opacity-40"
        >
          <Shuffle className="w-5 h-5 stroke-[2.5]" />
          {readyCount >= 1 ? 'SHUFFLE TURNS & START GAME' : 'WAITING FOR TEAMS...'}
          <ArrowRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Direct Team QR Modal */}
      {qrModalTeam && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neo-card-lg bg-white p-6 max-w-sm w-full text-center shadow-[10px_10px_0px_#000]">
            <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                  TEAM DIRECT JOIN QR
                </span>
                <h3 className="font-heading text-base text-black" style={{ color: qrModalTeam.color }}>
                  {qrModalTeam.name}
                </h3>
              </div>
              <button
                onClick={() => setQrModalTeam(null)}
                className="neo-btn-sm bg-white text-black p-1.5"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="my-3 flex justify-center">
              <QRCodeDisplay
                value={getTeamJoinUrl(qrModalTeam.accessCode)}
                size={200}
                label={`CODE: ${qrModalTeam.accessCode}`}
                sublabel="Scan to connect as this team automatically"
              />
            </div>

            <p className="text-xs font-mono font-bold text-slate-700 mt-3">
              Scanning auto-fills access code <strong>{qrModalTeam.accessCode}</strong> for quick check-in!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
