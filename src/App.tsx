/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useGameState } from './hooks/useGameState';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { AdminSetup } from './components/AdminSetup';
import { LobbyPhase } from './components/LobbyPhase';
import { ShufflePhase } from './components/ShufflePhase';
import { TileBoardPage } from './components/TileBoardPage';
import { QuestionModalOrPage } from './components/QuestionModalOrPage';
import { StealPhaseModal } from './components/StealPhaseModal';
import { PlayerPhoneView } from './components/PlayerPhoneView';
import { QuestionEditorModal } from './components/QuestionEditorModal';
import { PhoneSimulatorDrawer } from './components/PhoneSimulatorDrawer';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { soundEffects } from './utils/soundEffects';

export default function App() {
  const {
    gameState,
    questions,
    isConnected,
    isLoading,
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
  } = useGameState();

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [viewMode, setViewModeState] = useState<'host' | 'player' | 'simulator'>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('viewMode');
      if (stored === 'host' || stored === 'player' || stored === 'simulator') {
        return stored;
      }
    }
    return 'host';
  });

  const [role, setRoleState] = useState<'host' | 'player' | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('role');
      if (stored === 'host' || stored === 'player') {
        return stored;
      }
    }
    return null;
  });

  const setViewMode = (mode: 'host' | 'player' | 'simulator') => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('viewMode', mode);
    }
  };

  const setRole = (r: 'host' | 'player' | null) => {
    setRoleState(r);
    if (typeof window !== 'undefined') {
      if (r) {
        sessionStorage.setItem('role', r);
      } else {
        sessionStorage.removeItem('role');
      }
    }
  };

  const [isMuted, setIsMuted] = useState(false);
  const [scanlines, setScanlines] = useState(false);
  const [isQuestionEditorOpen, setIsQuestionEditorOpen] = useState(false);
  const [phonePrefilledCode, setPhonePrefilledCode] = useState<string>('');

  // Handle switching to Phone view for a specific team
  const handleOpenPhoneViewForTeam = (accessCode: string) => {
    setPhonePrefilledCode(accessCode);
    setViewMode('player');
    soundEffects.playTileClick();
  };

  // Render Host Screen based on current game phase
  const renderHostPhase = () => {
    if (!gameState || gameState.phase === 'landing') {
      return (
        <LandingPage
          onSelectHost={async () => {
            setRole('host');
            setViewMode('host');
            await startSetup();
          }}
          onSelectPlayer={() => {
            setRole('player');
            setViewMode('player');
          }}
          onSelectDualTest={async () => {
            setRole('host');
            setViewMode('simulator');
            await startSetup();
          }}
        />
      );
    }

    if (gameState.phase === 'setup') {
      return (
        <AdminSetup
          questions={questions}
          onOpenQuestionEditor={() => setIsQuestionEditorOpen(true)}
          onCreateGame={async (count, options) => {
            await createGame(count, [], options);
          }}
          onSaveQuestions={saveQuestions}
          onAddQuestion={addQuestion}
          onUpdateQuestion={updateQuestion}
          onBulkAddQuestions={bulkAddQuestions}
          onDeleteQuestion={deleteQuestion}
          onClearAllQuestions={clearAllQuestions}
          onResetDefaultQuestions={resetDefaultQuestions}
          onBackToLanding={resetGame}
        />
      );
    }

    if (gameState.phase === 'lobby') {
      return (
        <LobbyPhase
          gameState={gameState}
          onProceedToShuffle={async () => {
            await shuffleTurns();
          }}
          onOpenPhoneViewForTeam={handleOpenPhoneViewForTeam}
        />
      );
    }

    if (gameState.phase === 'shuffle') {
      return (
        <ShufflePhase
          gameState={gameState}
          onShuffleAgain={async () => {
            await shuffleTurns();
          }}
          onStartGameBoard={async () => {
            await startGameBoard();
          }}
        />
      );
    }

    if (gameState.phase === 'question') {
      return (
        <QuestionModalOrPage
          gameState={gameState}
          questions={questions}
          onAnswerQuestion={answerQuestion}
          onTriggerSteal={triggerSteal}
        />
      );
    }

    if (gameState.phase === 'steal') {
      return (
        <StealPhaseModal
          gameState={gameState}
          questions={questions}
          onResolveSteal={resolveSteal}
          onSimulateBuzz={async (teamId) => {
            await buzzSteal(teamId);
          }}
        />
      );
    }

    // Default: 'tile_board' (3/4 Screen Tiles + 1/4 Leaderboard)
    return (
      <TileBoardPage
        gameState={gameState}
        questions={questions}
        onSelectTile={selectTile}
        onOpenPhoneViewForTeam={handleOpenPhoneViewForTeam}
        onAdjustScore={adjustTeamScore}
      />
    );
  };

  // Show beautiful retro arcade loading screen if game state is being fetched from MongoDB
  if (isLoading && !gameState) {
    return (
      <div className="min-h-screen bg-[#faf7ee] text-slate-950 flex flex-col justify-center items-center font-sans relative">
        {scanlines && <div className="fixed inset-0 crt-overlay z-50 pointer-events-none" />}
        <div className="text-center space-y-4">
          <div className="inline-block animate-bounce w-14 h-14 bg-[#ffdf00] border-4 border-black shadow-[4px_4px_0px_#000] rounded-xl flex flex-wrap items-center justify-center font-heading text-2xl text-black">
            ⚡
          </div>
          <h2 className="font-heading text-xl tracking-widest text-black animate-pulse">
            LOADING CORES...
          </h2>
          <p className="font-mono text-xs text-slate-500 font-bold">
            RETRIEVING NEURAL ARCHIVE DATA
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf7ee] text-slate-950 flex flex-col relative font-sans">
      {/* Optional CRT scanlines overlay */}
      {scanlines && <div className="fixed inset-0 crt-overlay z-50 pointer-events-none" />}

      {/* Top Arcade Navigation */}
      <Navbar
        viewMode={viewMode}
        role={role}
        setViewMode={(mode) => {
          if (!role || role === mode || (role === 'host' && mode === 'simulator')) {
            setViewMode(mode);
          }
        }}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        scanlines={scanlines}
        setScanlines={setScanlines}
        isConnected={isConnected}
        onResetGame={() => {
          setResetError(null);
          setIsResetConfirmOpen(true);
        }}
        onOpenQuestionEditor={() => setIsQuestionEditorOpen(true)}
        questionCount={questions.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {role === null ? (
          /* Show landing page if no role has been selected yet on this client device/tab */
          <div className="py-4">
            <LandingPage
              onSelectHost={async () => {
                setRole('host');
                setViewMode('host');
                if (!gameState || gameState.phase === 'landing') {
                  await startSetup();
                }
              }}
              onSelectPlayer={() => {
                setRole('player');
                setViewMode('player');
              }}
              onSelectDualTest={async () => {
                setRole('host');
                setViewMode('simulator');
                if (!gameState || gameState.phase === 'landing') {
                  await startSetup();
                }
              }}
            />
          </div>
        ) : viewMode === 'player' ? (
          /* Phone View Mode */
          <div className="py-6">
            <PlayerPhoneView
              gameState={gameState}
              onJoinTeam={joinTeam}
              onBuzzSteal={buzzSteal}
              prefilledAccessCode={phonePrefilledCode}
              resetNotification={resetNotification}
              onClearResetNotification={clearResetNotification}
              onSwitchToHostView={() => {
                setRole(null);
                setViewMode('host');
              }}
              onSwitchToLandingView={() => {
                // Return to landing page locally without triggering a global reset (Requirement 1)
                setRole(null);
                setViewMode('host');
              }}
            />
          </div>
        ) : viewMode === 'simulator' ? (
          /* Split Test Mode: Host Board on Left + Live Phone on Right */
          <div className="max-w-[1850px] mx-auto p-2 sm:p-4 grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-8 overflow-y-auto">
              {renderHostPhase()}
            </div>
            <div className="xl:col-span-4 sticky top-16 h-[calc(100vh-80px)]">
              <PhoneSimulatorDrawer
                gameState={gameState}
                onJoinTeam={joinTeam}
                onBuzzSteal={buzzSteal}
              />
            </div>
          </div>
        ) : (
          /* Standard Host Projector / Screen View */
          <div className="py-4">
            {renderHostPhase()}
          </div>
        )}
      </main>

      {/* Host Reset Game Confirmation Prompt (Requirement 3) */}
      <ConfirmationDialog
        isOpen={isResetConfirmOpen}
        title="Reset Game?"
        confirmLabel="Confirm Reset"
        cancelLabel="Cancel"
        confirmVariant="danger"
        message={
          <div className="space-y-3 font-sans">
            <p className="font-bold text-slate-900">
              This will:
            </p>
            <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside font-medium bg-red-50 p-3 rounded-lg border border-red-200">
              <li><strong>Disconnect</strong> all currently connected players.</li>
              <li><strong>Remove</strong> all player and team-session data.</li>
              <li><strong>Reset</strong> the Host&apos;s current game/session state.</li>
              <li><strong>Clear</strong> scores, answers, progress, and active game data.</li>
              <li><strong>Return</strong> the Host to the initial game setup state.</li>
              <li><strong className="text-emerald-700">Preserve</strong> the existing question bank.</li>
            </ul>
            {resetError && (
              <div className="p-2.5 bg-red-100 border border-red-400 text-red-800 text-xs font-bold rounded">
                ⚠️ {resetError}
              </div>
            )}
            <p className="text-[11px] font-mono text-slate-500 font-bold">
              Only the authenticated Host may perform this action.
            </p>
          </div>
        }
        onConfirm={async () => {
          try {
            const res = await resetGame();
            if (res && !res.success) {
              setResetError(res.error || 'Failed to reset game session.');
              return;
            }
            setIsResetConfirmOpen(false);
            setResetError(null);
            // Return Host to initial setup state (Requirement 7)
            setRole('host');
            setViewMode('host');
            await startSetup();
          } catch (err: any) {
            setResetError(err.message || 'Error executing game reset.');
          }
        }}
        onCancel={() => {
          setIsResetConfirmOpen(false);
          setResetError(null);
        }}
      />

      {/* Question Bank Manager Modal */}
      {isQuestionEditorOpen && (
        <QuestionEditorModal
          questions={questions}
          totalQuestions={gameState?.totalQuestionsTarget || 80}
          onSaveQuestions={saveQuestions}
          onClearAllQuestions={clearAllQuestions}
          onResetDefaultQuestions={resetDefaultQuestions}
          onClose={() => setIsQuestionEditorOpen(false)}
        />
      )}
    </div>
  );
}
