import React, { useState, useEffect } from 'react';
import {
  Users,
  HelpCircle,
  Clock,
  ArrowRight,
  Edit3,
  CheckCircle2,
  ClipboardPaste,
  Trash2,
  ArrowLeft,
  Plus,
  Minus,
  Grid,
  Layers,
  Sparkles,
  RotateCcw,
  AlertCircle,
  Check,
  Database,
  RefreshCw,
  ExternalLink,
  X,
  Search,
  Download,
  Wifi,
  QrCode,
  Copy,
} from 'lucide-react';
import { Question, DifficultyLevel } from '../types/game';
import { CATEGORIES } from '../data/defaultQuestions';
import { PasteQuestionsModal } from './PasteQuestionsModal';
import { AddQuestionModal } from './AddQuestionModal';
import { EditQuestionModal } from './EditQuestionModal';
import { ConfirmationDialog } from './ConfirmationDialog';
import { QRCodeDisplay } from './QRCodeDisplay';
import { soundEffects } from '../utils/soundEffects';

interface AdminSetupProps {
  questions: Question[];
  onOpenQuestionEditor: () => void;
  onCreateGame: (
    groupCount: number,
    options?: { timerSeconds?: number; totalQuestions?: number }
  ) => Promise<any>;
  onSaveQuestions?: (updated: Question[], totalTilesTarget?: number) => Promise<{ success: boolean; count?: number; error?: string; questions?: Question[] } | boolean>;
  onAddQuestion?: (question: Question) => Promise<boolean | { success: boolean; error?: string }>;
  onUpdateQuestion?: (id: string, updated: Partial<Question>) => Promise<boolean | { success: boolean; error?: string }>;
  onBulkAddQuestions?: (questions: Question[], totalTilesTarget?: number) => Promise<{ success: boolean; count?: number; error?: string; questions?: Question[] } | boolean>;
  onDeleteQuestion?: (id: string) => Promise<boolean>;
  onClearAllQuestions?: () => Promise<boolean>;
  onResetDefaultQuestions?: () => Promise<boolean | void>;
  onBackToLanding?: () => void;
}

const DEFAULT_GROUP_NAMES = [
  'Cyber Dragons',
  'Pixel Ninjas',
  'Neon Phantoms',
  'Quantum Titans',
  'Arcade Wizards',
  'Retro Knights',
  'Byte Brawlers',
  'Turbo Raiders',
  'Solar Strikers',
  'Vortex Vipers',
  'Matrix Mavericks',
  'Hyper Hawks',
  'Glitch Guardians',
  'Laser Lions',
  'Sonic Shamrocks',
];

const GROUP_COLORS = [
  '#7dd3fc',
  '#f472b6',
  '#fde047',
  '#86efac',
  '#c084fc',
  '#fb923c',
  '#ff7675',
  '#a7f3d0',
  '#38bdf8',
  '#e879f9',
  '#facc15',
  '#4ade80',
  '#818cf8',
  '#f87171',
  '#2dd4bf',
];

const CATEGORY_KEYS: DifficultyLevel[] = ['beginner', 'easy', 'moderate', 'hard', 'insane'];

export const AdminSetup: React.FC<AdminSetupProps> = ({
  questions,
  onOpenQuestionEditor,
  onCreateGame,
  onSaveQuestions,
  onAddQuestion,
  onUpdateQuestion,
  onBulkAddQuestions,
  onDeleteQuestion,
  onClearAllQuestions,
  onResetDefaultQuestions,
  onBackToLanding,
}) => {
  const [groupCount, setGroupCount] = useState<number>(4);
  const [totalQuestions, setTotalQuestions] = useState<number>(50); // Min 10, Max 80 (steps of 10 = 2 per category)
  const [timerSeconds, setTimerSeconds] = useState<number>(30); // Countdown duration in seconds
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all');
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteModalCategory, setPasteModalCategory] = useState<DifficultyLevel>('moderate');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalCategory, setAddModalCategory] = useState<DifficultyLevel>('moderate');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pasteSuccessNotice, setPasteSuccessNotice] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    mode: string;
    databaseName: string;
    isAtlasConfigured: boolean;
    lastError?: string | null;
  } | null>(null);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  const [lanInfo, setLanInfo] = useState<{
    primaryIp: string;
    primaryUrl: string;
    port: number;
    allIps: Array<{ name: string; address: string; isPrivate: boolean }>;
    instructions: string;
  } | null>(null);
  const [copiedLanUrl, setCopiedLanUrl] = useState(false);
  const [isLanQrOpen, setIsLanQrOpen] = useState(false);

  const fetchDbStatus = async () => {
    try {
      const res = await fetch('/api/db-status');
      const data = await res.json();
      if (data.success) {
        setDbStatus(data);
      }
    } catch {}
  };

  const fetchLanInfo = async () => {
    try {
      const res = await fetch('/api/lan-info');
      const data = await res.json();
      if (data.success) {
        setLanInfo(data);
      }
    } catch {}
  };

  // Check live database connection status and LAN network info
  useEffect(() => {
    fetchDbStatus();
    fetchLanInfo();
  }, []);

  const handleCopyLanUrl = (url: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLanUrl(true);
      soundEffects.playTileClick();
      setTimeout(() => setCopiedLanUrl(false), 2000);
    }
  };

  const handleReconnectDb = async () => {
    setIsTestingDb(true);
    soundEffects.playTileClick();
    try {
      const res = await fetch('/api/db-status/reconnect', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDbStatus(data);
        if (data.connected) {
          soundEffects.playCoin();
        } else {
          soundEffects.playWrong();
        }
      }
    } catch {
      soundEffects.playWrong();
    } finally {
      setIsTestingDb(false);
    }
  };

  const questionsPerCategory = Math.max(1, Math.round(totalQuestions / CATEGORY_KEYS.length));
  const rowsCount = Math.round(questionsPerCategory / 2);

  // Group count +/- modifiers (min 2, max 15)
  const handleIncrementGroup = () => {
    if (groupCount < 15) {
      soundEffects.playTileClick();
      setGroupCount((prev) => prev + 1);
    }
  };

  const handleDecrementGroup = () => {
    if (groupCount > 2) {
      soundEffects.playTileClick();
      setGroupCount((prev) => prev - 1);
    }
  };

  // Total questions +/- modifiers (min 25, max 100)
  const QUESTION_PRESETS = [25, 50, 75, 80, 100];

  const handleIncrementQuestions = () => {
    if (totalQuestions < 100) {
      soundEffects.playTileClick();
      setTotalQuestions((prev) => {
        const next = QUESTION_PRESETS.find((p) => p > prev);
        return next !== undefined ? next : Math.min(100, prev + 10);
      });
    }
  };

  const handleDecrementQuestions = () => {
    if (totalQuestions > 25) {
      soundEffects.playTileClick();
      setTotalQuestions((prev) => {
        const reversed = [...QUESTION_PRESETS].reverse();
        const prevMatch = reversed.find((p) => p < prev);
        return prevMatch !== undefined ? prevMatch : Math.max(25, prev - 10);
      });
    }
  };

  // Timer duration +/- modifiers (min 5s, max 120s, step 5s)
  const handleIncrementTimer = () => {
    if (timerSeconds < 120) {
      soundEffects.playTileClick();
      setTimerSeconds((prev) => Math.min(120, prev + 5));
    }
  };

  const handleDecrementTimer = () => {
    if (timerSeconds > 5) {
      soundEffects.playTileClick();
      setTimerSeconds((prev) => Math.max(5, prev - 5));
    }
  };

  const handleDeleteAllQuestions = () => {
    if (questions.length === 0) return;
    soundEffects.playTileClick();
    setConfirmDialog({
      isOpen: true,
      title: 'DELETE ALL QUESTIONS?',
      message: `Are you sure you want to DELETE ALL ${questions.length} questions? This will completely empty the questions bank.`,
      confirmLabel: `Delete All (${questions.length})`,
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        soundEffects.playWrong();
        if (onClearAllQuestions) {
          await onClearAllQuestions();
        } else if (onSaveQuestions) {
          await onSaveQuestions([], totalQuestions);
        }
        setPasteSuccessNotice('All questions removed! Question bank is now empty.');
        setTimeout(() => setPasteSuccessNotice(null), 3500);
      },
    });
  };

  const handleRestoreDefaults = () => {
    soundEffects.playTileClick();
    setConfirmDialog({
      isOpen: true,
      title: 'RESTORE 50 DEFAULT QUESTIONS?',
      message: 'This will reset your questions bank back to the standard 50 default questions.',
      confirmLabel: 'Restore 50 Defaults',
      confirmVariant: 'warning',
      onConfirm: async () => {
        setConfirmDialog(null);
        soundEffects.playCoin();
        if (onResetDefaultQuestions) {
          await onResetDefaultQuestions();
          setPasteSuccessNotice('Restored 50 default questions successfully!');
          setTimeout(() => setPasteSuccessNotice(null), 3500);
        }
      },
    });
  };

  const handleSingleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundEffects.playWrong();
    if (onDeleteQuestion) {
      await onDeleteQuestion(id);
    } else if (onSaveQuestions) {
      const remaining = questions.filter((q) => q.id !== id);
      await onSaveQuestions(remaining, totalQuestions);
    }
  };

  const handleAddQuestionModal = async (newQ: Question): Promise<boolean> => {
    // Validate category capacity before adding
    const currentInCat = questions.filter((q) => q.category === newQ.category).length;
    if (currentInCat >= questionsPerCategory) {
      setErrorMessage(
        `Category "${CATEGORIES[newQ.category]?.name || newQ.category}" already contains ${currentInCat} questions, which is the maximum allowed (${questionsPerCategory}) based on the selected ${totalQuestions}-tile game configuration.`
      );
      soundEffects.playWrong();
      return false;
    }

    if (onAddQuestion) {
      const res = await onAddQuestion(newQ);
      const isOk = typeof res === 'boolean' ? res : Boolean(res && res.success);
      if (isOk) {
        setPasteSuccessNotice(`Added question to ${CATEGORIES[newQ.category]?.name || 'category'}!`);
        setTimeout(() => setPasteSuccessNotice(null), 3000);
      }
      return isOk;
    } else if (onSaveQuestions) {
      const updated = [newQ, ...questions];
      const res = await onSaveQuestions(updated, totalQuestions);
      const isOk = typeof res === 'boolean' ? res : Boolean(res && res.success);
      if (isOk) {
        setPasteSuccessNotice(`Added question to ${CATEGORIES[newQ.category]?.name || 'category'}!`);
        setTimeout(() => setPasteSuccessNotice(null), 3000);
      }
      return isOk;
    }
    return false;
  };

  const handleUpdateQuestionModal = async (id: string, updatedData: Partial<Question>): Promise<boolean> => {
    if (onUpdateQuestion) {
      const res = await onUpdateQuestion(id, updatedData);
      const isOk = typeof res === 'boolean' ? res : Boolean(res && res.success);
      if (isOk) {
        setPasteSuccessNotice('Question updated successfully in database!');
        setTimeout(() => setPasteSuccessNotice(null), 3000);
      }
      return isOk;
    } else if (onSaveQuestions) {
      const updated = questions.map((q) => (q.id === id ? { ...q, ...updatedData } : q));
      const res = await onSaveQuestions(updated, totalQuestions);
      const isOk = typeof res === 'boolean' ? res : Boolean(res && res.success);
      if (isOk) {
        setPasteSuccessNotice('Question updated successfully in database!');
        setTimeout(() => setPasteSuccessNotice(null), 3000);
      }
      return isOk;
    }
    return false;
  };

  const handleExportQuestions = () => {
    soundEffects.playCoin();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(questions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `trivia_questions_mongodb_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportPastedQuestions = async (
    newQuestions: Question[],
    mode: 'append' | 'replace_category' | 'replace_all',
    targetCategory: DifficultyLevel
  ): Promise<{ success: boolean; count?: number; error?: string }> => {
    let updated: Question[] = [];
    if (mode === 'replace_all') {
      updated = newQuestions;
    } else if (mode === 'replace_category') {
      const distinctCats = Array.from(new Set(newQuestions.map((q) => q.category)));
      const remaining = questions.filter(
        (q) => !distinctCats.includes(q.category) && q.category !== targetCategory
      );
      updated = [...remaining, ...newQuestions];
    } else {
      updated = [...questions, ...newQuestions];
    }

    // Strict validation before save: questionCount <= maximumQuestionsPerCategory for each category
    for (const catKey of CATEGORY_KEYS) {
      const catCount = updated.filter((q) => q.category === catKey).length;
      if (catCount > questionsPerCategory) {
        const errorMsg = `Category "${CATEGORIES[catKey]?.name || catKey}" contains ${catCount} questions, but the maximum allowed for this ${totalQuestions}-tile game configuration is ${questionsPerCategory}.`;
        setErrorMessage(errorMsg);
        soundEffects.playWrong();
        return { success: false, error: errorMsg };
      }
    }

    if (onSaveQuestions) {
      const res = await onSaveQuestions(updated, totalQuestions);
      const isSuccess = typeof res === 'boolean' ? res : Boolean(res && res.success);
      if (!isSuccess) {
        soundEffects.playWrong();
        const errorMsg = (typeof res === 'object' && res?.error) ? res.error : 'Database insertion failed.';
        setErrorMessage(errorMsg);
        return { success: false, error: errorMsg };
      }
      const categoryName = CATEGORIES[targetCategory]?.name || targetCategory;
      const successMsg =
        mode === 'replace_category'
          ? `${newQuestions.length} questions successfully inserted into ${categoryName}.`
          : `${newQuestions.length} questions successfully saved to Local MongoDB.`;
      setPasteSuccessNotice(successMsg);
      setTimeout(() => setPasteSuccessNotice(null), 3500);
      return { success: true, count: newQuestions.length };
    }

    return { success: true, count: newQuestions.length };
  };

  const openPasteForCategory = (catKey: DifficultyLevel) => {
    setPasteModalCategory(catKey);
    setIsPasteModalOpen(true);
  };

  const openAddForCategory = (catKey: DifficultyLevel) => {
    setAddModalCategory(catKey);
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    // Final pre-flight validation: ensure no category exceeds questionsPerCategory
    for (const catKey of CATEGORY_KEYS) {
      const catCount = questions.filter((q) => q.category === catKey).length;
      if (catCount > questionsPerCategory) {
        setErrorMessage(
          `Cannot start game: Category "${CATEGORIES[catKey]?.name || catKey}" contains ${catCount} questions, but the maximum allowed for this ${totalQuestions}-tile configuration is ${questionsPerCategory}.`
        );
        soundEffects.playWrong();
        setIsSubmitting(false);
        return;
      }
    }

    soundEffects.playCoin();
    try {
      const res = await onCreateGame(groupCount, {
        timerSeconds,
        totalQuestions,
      });
      if (res && res.success === false) {
        setErrorMessage(res.error || 'Failed to create game session. Please check database connection.');
        soundEffects.playWrong();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during game creation.');
      soundEffects.playWrong();
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredQuestions = questions.filter((q) => {
    if (!q) return false;
    const matchesCategory = selectedCategoryTab === 'all' || q.category === selectedCategoryTab;
    const matchesSearch =
      !searchQuery.trim() ||
      (q.question && q.question.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.answer && q.answer.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.hint && q.hint.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="neo-card-lg bg-white p-6 sm:p-8 mb-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-3 border-black pb-5 mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <div className="neo-badge bg-[#7dd3fc] text-black px-3 py-0.5 text-xs font-heading">
                SETUP CONTROLS
              </div>

              {dbStatus && (
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playTileClick();
                    setIsDbModalOpen(true);
                  }}
                  className={`neo-badge text-[10px] font-mono font-bold px-2 py-0.5 border border-black flex items-center gap-1.5 cursor-pointer hover:brightness-95 transition-all shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 ${
                    dbStatus.connected
                      ? 'bg-[#86efac] text-black'
                      : 'bg-[#ffdf00] text-black'
                  }`}
                  title="Click to view Local MongoDB status and diagnostics"
                >
                  <span
                    className={`w-2 h-2 rounded-full inline-block ${
                      dbStatus.connected
                        ? 'bg-emerald-600 animate-pulse'
                        : 'bg-amber-600'
                    }`}
                  />
                  {dbStatus.connected
                    ? 'DB: LOCAL MONGODB (127.0.0.1)'
                    : 'DB: LOCAL FALLBACK ACTIVE'}
                  <Database className="w-3 h-3 stroke-[2.5]" />
                </button>
              )}

              {onBackToLanding && (
                <button
                  type="button"
                  onClick={onBackToLanding}
                  className="neo-btn-sm bg-white hover:bg-slate-100 text-black px-2 py-0.5 text-[11px] font-mono font-bold flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3 stroke-[2.5]" />
                  LANDING
                </button>
              )}
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl text-black">
              ADMIN GAME SETUP
            </h2>
            <p className="text-xs font-mono font-bold text-slate-600 mt-1">
              CONFIGURE GROUPS, DYNAMIC QUESTIONS MATRIX & COUNTDOWN TIMER
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAddModalCategory(selectedCategoryTab !== 'all' ? (selectedCategoryTab as DifficultyLevel) : 'moderate');
                setIsAddModalOpen(true);
              }}
              className="neo-btn bg-[#86efac] hover:bg-[#6ee7b7] text-black px-3.5 py-2.5 text-xs font-heading flex items-center gap-1.5 shadow-[3px_3px_0px_#000]"
              title="Add a single trivia question"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              ADD QUESTION
            </button>

            <button
              type="button"
              onClick={() => {
                setPasteModalCategory(selectedCategoryTab !== 'all' ? (selectedCategoryTab as DifficultyLevel) : 'moderate');
                setIsPasteModalOpen(true);
              }}
              className="neo-btn bg-[#faf7ee] hover:bg-[#ffdf00] text-black px-3.5 py-2.5 text-xs font-heading flex items-center gap-1.5"
              title="Paste questions in question;answer;hint format"
            >
              <ClipboardPaste className="w-4 h-4 stroke-[2.5]" />
              PASTE QUESTIONS
            </button>

            <button
              type="button"
              onClick={handleDeleteAllQuestions}
              disabled={questions.length === 0}
              className="neo-btn bg-[#ff7675] hover:bg-[#ff5252] text-black px-3.5 py-2.5 text-xs font-heading flex items-center gap-1.5 disabled:opacity-40"
              title="Remove all questions from the question bank"
            >
              <Trash2 className="w-4 h-4 stroke-[2.5]" />
              DELETE ALL ({questions.length})
            </button>

            <button
              type="button"
              onClick={onOpenQuestionEditor}
              className="neo-btn bg-[#ffdf00] text-black px-3.5 py-2.5 text-xs font-heading flex items-center gap-1.5"
            >
              <Edit3 className="w-4 h-4 stroke-[2.5]" />
              EDIT QUESTIONS ({questions.length})
            </button>
          </div>
        </div>

        {pasteSuccessNotice && (
          <div className="mb-6 p-3.5 neo-card bg-[#86efac] text-black text-xs font-mono font-bold flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-5 h-5 stroke-[2.5] text-black shrink-0" />
            <span>{pasteSuccessNotice}</span>
          </div>
        )}

        {/* LAN Host Server & Player Connection Banner (Offline Ready) */}
        {lanInfo && (
          <div className="mb-6 p-4 sm:p-5 neo-card bg-[#e0f2fe] border-3 border-black text-black">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 neo-card bg-[#38bdf8] flex items-center justify-center shrink-0 border-2 border-black">
                  <Wifi className="w-5 h-5 text-black stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="neo-badge bg-black text-[#7dd3fc] text-[10px] font-mono px-2 py-0.5 uppercase">
                      OFFLINE LAN READY
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-700">
                      Port {lanInfo.port}
                    </span>
                  </div>
                  <h3 className="font-heading text-sm sm:text-base text-black mt-0.5">
                    GAME SERVER ADDRESS: <span className="font-mono bg-white px-2 py-0.5 rounded border border-black text-blue-900 select-all">{lanInfo.primaryUrl}</span>
                  </h3>
                  <p className="text-xs font-sans font-semibold text-slate-700 mt-1">
                    Connect all devices to the same Wi-Fi router or mobile hotspot, then open the address above on player phones.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyLanUrl(lanInfo.primaryUrl)}
                  className="neo-btn-sm bg-white hover:bg-slate-100 text-black px-3 py-1.5 text-xs font-heading flex items-center gap-1.5"
                >
                  {copiedLanUrl ? <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> : <Copy className="w-3.5 h-3.5 stroke-[2.5]" />}
                  {copiedLanUrl ? 'COPIED!' : 'COPY URL'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsLanQrOpen(!isLanQrOpen)}
                  className="neo-btn-sm bg-[#ffdf00] hover:bg-[#fde047] text-black px-3 py-1.5 text-xs font-heading flex items-center gap-1.5"
                >
                  <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
                  {isLanQrOpen ? 'HIDE QR' : 'SHOW QR'}
                </button>
              </div>
            </div>

            {/* Expandable LAN Connection QR Code */}
            {isLanQrOpen && (
              <div className="mt-4 pt-4 border-t-2 border-black/20 flex flex-col sm:flex-row items-center justify-center gap-4 bg-white/70 p-4 rounded-lg">
                <QRCodeDisplay
                  value={lanInfo.primaryUrl}
                  size={160}
                  label="SCAN WITH PHONE CAMERA"
                  sublabel={lanInfo.primaryUrl}
                />
                <div className="max-w-xs text-xs font-mono font-bold text-slate-700 text-center sm:text-left space-y-1">
                  <p className="text-black font-extrabold font-heading text-sm">📱 QUICK PHONE JOIN</p>
                  <p>1. Connect player phone to host hotspot / Wi-Fi.</p>
                  <p>2. Scan this QR code or type <strong className="text-black">{lanInfo.primaryUrl}</strong> in phone browser.</p>
                  <p>3. Tap <strong>PLAYER</strong> and enter the team access code.</p>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Top Controls Grid: Groups (+/-), Questions (+/-), Timer (+/-) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1: Participating Groups with +/- mechanism */}
            <div className="neo-card bg-[#faf7ee] p-5 flex flex-col justify-between">
              <div>
                <label className="block font-heading text-xs sm:text-sm text-black mb-1 flex items-center gap-1.5">
                  <Users className="w-4 h-4 stroke-[2.5]" />
                  PARTICIPATING GROUPS
                </label>
                <p className="text-[11px] font-mono font-semibold text-slate-600 mb-4">
                  Min: 2 groups | Max: 15 groups
                </p>

                {/* +/- Stepper Component */}
                <div className="flex items-center justify-between bg-white p-2 rounded-xl border-3 border-black shadow-[4px_4px_0px_#000] mb-3">
                  <button
                    type="button"
                    onClick={handleDecrementGroup}
                    disabled={groupCount <= 2}
                    className="w-12 h-12 neo-btn bg-[#ff7675] hover:bg-[#ff5252] disabled:opacity-40 text-black flex items-center justify-center rounded-lg"
                    title="Remove a group"
                  >
                    <Minus className="w-6 h-6 stroke-[3]" />
                  </button>

                  <div className="text-center px-2">
                    <span className="font-heading text-3xl sm:text-4xl text-black block leading-none">
                      {groupCount}
                    </span>
                    <span className="font-mono text-[10px] font-extrabold uppercase text-slate-500">
                      GROUPS
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleIncrementGroup}
                    disabled={groupCount >= 15}
                    className="w-12 h-12 neo-btn bg-[#86efac] hover:bg-[#6ee7b7] disabled:opacity-40 text-black flex items-center justify-center rounded-lg"
                    title="Add a group (up to 15)"
                  >
                    <Plus className="w-6 h-6 stroke-[3]" />
                  </button>
                </div>

                {/* Quick Presets for Groups */}
                <div className="flex items-center gap-1 mb-3">
                  {[2, 4, 6, 8, 10, 12, 15].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        soundEffects.playTileClick();
                        setGroupCount(preset);
                      }}
                      className={`flex-1 py-0.5 text-[10px] font-mono font-bold rounded border transition-all ${
                        groupCount === preset
                          ? 'bg-[#7dd3fc] text-black border-black shadow-[1px_1px_0px_#000]'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Group color pills preview */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-black/10">
                {Array.from({ length: groupCount }).map((_, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded border border-black text-[10px] font-mono font-bold text-black"
                    style={{ backgroundColor: GROUP_COLORS[idx % GROUP_COLORS.length] }}
                  >
                    Team {idx + 1}
                  </span>
                ))}
              </div>
            </div>

            {/* Step 2: Dynamic Total Questions with +/- mechanism */}
            <div className="neo-card bg-[#faf7ee] p-5 flex flex-col justify-between">
              <div>
                <label className="block font-heading text-xs sm:text-sm text-black mb-1 flex items-center gap-1.5">
                  <Grid className="w-4 h-4 stroke-[2.5]" />
                  TOTAL QUESTIONS
                </label>
                <p className="text-[11px] font-mono font-semibold text-slate-600 mb-4">
                  {questionsPerCategory} per category ({totalQuestions} ÷ 5)
                </p>

                {/* +/- Stepper Component */}
                <div className="flex items-center justify-between bg-white p-2 rounded-xl border-3 border-black shadow-[4px_4px_0px_#000] mb-3">
                  <button
                    type="button"
                    onClick={handleDecrementQuestions}
                    disabled={totalQuestions <= 25}
                    className="w-12 h-12 neo-btn bg-[#ff7675] hover:bg-[#ff5252] disabled:opacity-40 text-black flex items-center justify-center rounded-lg"
                    title="Decrease total question tiles"
                  >
                    <Minus className="w-6 h-6 stroke-[3]" />
                  </button>

                  <div className="text-center px-2">
                    <span className="font-heading text-3xl sm:text-4xl text-black block leading-none">
                      {totalQuestions}
                    </span>
                    <span className="font-mono text-[10px] font-extrabold uppercase text-slate-500">
                      TILES TOTAL
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleIncrementQuestions}
                    disabled={totalQuestions >= 100}
                    className="w-12 h-12 neo-btn bg-[#86efac] hover:bg-[#6ee7b7] disabled:opacity-40 text-black flex items-center justify-center rounded-lg"
                    title="Increase total question tiles"
                  >
                    <Plus className="w-6 h-6 stroke-[3]" />
                  </button>
                </div>

                {/* Quick Presets for Total Questions */}
                <div className="flex items-center gap-1 mb-3">
                  {[25, 50, 75, 80, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        soundEffects.playTileClick();
                        setTotalQuestions(preset);
                      }}
                      className={`flex-1 py-0.5 text-[10px] font-mono font-bold rounded border transition-all ${
                        totalQuestions === preset
                          ? 'bg-[#ffdf00] text-black border-black shadow-[1px_1px_0px_#000]'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Matrix dimensions summary */}
              <div className="bg-white p-2 rounded border border-black text-[10px] font-mono font-bold text-slate-700 flex items-center justify-between">
                <span>{questionsPerCategory} / category</span>
                <span className="bg-[#7dd3fc] text-black px-1.5 py-0.5 rounded border border-black">
                  {rowsCount} Rows × 10 Cols
                </span>
              </div>
            </div>

            {/* Step 3: Countdown Timer Entry in Seconds with +/- mechanism */}
            <div className="neo-card bg-[#faf7ee] p-5 flex flex-col justify-between">
              <div>
                <label className="block font-heading text-xs sm:text-sm text-black mb-1 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 stroke-[2.5]" />
                  COUNTDOWN TIMER
                </label>
                <p className="text-[11px] font-mono font-semibold text-slate-600 mb-4">
                  Duration per question in seconds
                </p>

                {/* +/- Stepper Component */}
                <div className="flex items-center justify-between bg-white p-2 rounded-xl border-3 border-black shadow-[4px_4px_0px_#000] mb-4">
                  <button
                    type="button"
                    onClick={handleDecrementTimer}
                    disabled={timerSeconds <= 5}
                    className="w-12 h-12 neo-btn bg-[#ff7675] hover:bg-[#ff5252] disabled:opacity-40 text-black flex items-center justify-center rounded-lg"
                    title="Decrease 5 seconds"
                  >
                    <Minus className="w-6 h-6 stroke-[3]" />
                  </button>

                  <div className="text-center px-2">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="font-heading text-3xl sm:text-4xl text-black leading-none">
                        {timerSeconds}
                      </span>
                      <span className="font-heading text-base text-slate-600">s</span>
                    </div>
                    <span className="font-mono text-[10px] font-extrabold uppercase text-slate-500">
                      PER TILE
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleIncrementTimer}
                    disabled={timerSeconds >= 120}
                    className="w-12 h-12 neo-btn bg-[#86efac] hover:bg-[#6ee7b7] disabled:opacity-40 text-black flex items-center justify-center rounded-lg"
                    title="Increase 5 seconds"
                  >
                    <Plus className="w-6 h-6 stroke-[3]" />
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-black/10">
                {[15, 30, 45, 60, 90].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => {
                      soundEffects.playTileClick();
                      setTimerSeconds(sec);
                    }}
                    className={`flex-1 py-1 text-[10px] font-mono font-bold rounded border transition-all ${
                      timerSeconds === sec
                        ? 'bg-[#ffdf00] text-black border-black shadow-[2px_2px_0px_#000]'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick presets row for Total Questions */}
          <div className="p-3 bg-[#fff9e6] neo-card-sm border-2 border-black flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 stroke-[2.5]" />
              <span className="font-heading text-xs text-black">
                QUESTIONS MATRIX SIZES (2 COLUMNS PER CATEGORY):
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[25, 50, 75, 80, 100].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    soundEffects.playTileClick();
                    setTotalQuestions(num);
                  }}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border-2 border-black transition-all ${
                    totalQuestions === num
                      ? 'bg-[#7dd3fc] text-black shadow-[2px_2px_0px_#000] scale-105'
                      : 'bg-white text-black hover:bg-slate-100'
                  }`}
                >
                  {num} ({num / 5}/cat)
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Per-Category Status & Quota Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-heading text-xs sm:text-sm text-black flex items-center gap-1.5">
                <Grid className="w-4 h-4 stroke-[2.5]" />
                CATEGORY MATRIX QUOTAS ({questionsPerCategory} TILES PER CATEGORY NEEDED):
              </label>
              <span className="text-[11px] font-mono text-slate-600 font-bold">
                Max {questionsPerCategory} questions per category
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {CATEGORY_KEYS.map((catKey) => {
                const cat = CATEGORIES[catKey];
                const count = questions.filter((q) => q && q.category === catKey).length;
                const isReady = count >= questionsPerCategory;

                return (
                  <div
                    key={catKey}
                    className="p-3 neo-card-sm flex flex-col justify-between transition-all"
                    style={{ backgroundColor: cat.color }}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-heading text-xs text-black">
                          {cat.name}
                        </span>
                        <span className="font-mono text-[10px] font-extrabold text-black">
                          +{cat.points}p
                        </span>
                      </div>

                      <div className="flex items-center justify-between mb-2">
                        <span className="font-heading text-lg text-black">
                          {count} / {questionsPerCategory}
                        </span>
                        {isReady ? (
                          <span className="bg-white text-emerald-800 border border-black text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Check className="w-3 h-3 stroke-[3]" /> READY
                          </span>
                        ) : (
                          <span className="bg-[#ffdf00] text-black border border-black text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                            {questionsPerCategory - count} MORE
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 pt-2 border-t border-black/20">
                      <button
                        type="button"
                        onClick={() => openAddForCategory(catKey)}
                        className="flex-1 py-1 bg-white hover:bg-slate-100 text-black text-[10px] font-heading rounded border border-black"
                        title={`Add question to ${cat.name}`}
                      >
                        + ADD
                      </button>
                      <button
                        type="button"
                        onClick={() => openPasteForCategory(catKey)}
                        className="flex-1 py-1 bg-white hover:bg-slate-100 text-black text-[10px] font-heading rounded border border-black"
                        title={`Paste questions into ${cat.name}`}
                      >
                        PASTE
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 4: Questions Bank Preview Panel */}
          <div className="pt-6 border-t-3 border-black">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <label className="block font-heading text-sm text-black flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 stroke-[2.5]" />
                  QUESTIONS MATRIX PREVIEW ({questions.length} TOTAL IN BANK)
                </label>
                <p className="text-xs font-mono text-slate-600 mt-0.5 font-medium">
                  {totalQuestions} questions will be loaded onto the game board ({questionsPerCategory} questions per category, 2 columns each)
                </p>
              </div>

              {/* Action buttons (Export JSON, Add, Paste) */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportQuestions}
                  disabled={questions.length === 0}
                  className="neo-btn-sm bg-white hover:bg-slate-100 text-black px-2.5 py-1 text-xs font-heading flex items-center gap-1.5 disabled:opacity-40"
                  title="Export question bank as JSON"
                >
                  <Download className="w-3.5 h-3.5 stroke-[2.5]" /> EXPORT JSON
                </button>
              </div>
            </div>

            {/* Search & Category Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 bg-[#faf7ee] p-2.5 rounded-lg border-2 border-black">
              {/* Live Search Input */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 stroke-[2.5]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions, answers, hints..."
                  className="w-full neo-input pl-9 pr-7 py-1.5 text-xs font-bold text-black"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black font-bold text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Category tabs */}
              <div className="flex flex-wrap gap-1.5 p-1 bg-white border-2 border-black rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryTab('all')}
                  className={`px-2.5 py-1 text-xs font-heading rounded ${
                    selectedCategoryTab === 'all'
                      ? 'bg-black text-white shadow-[2px_2px_0px_#000]'
                      : 'text-black hover:bg-black/10'
                  }`}
                >
                  ALL ({questions.length})
                </button>
                {Object.values(CATEGORIES).map((cat) => {
                  const countInBank = questions.filter((q) => q.category === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryTab(cat.id)}
                      className={`px-2 py-1 text-xs font-heading rounded border-2 border-black transition-all ${
                        selectedCategoryTab === cat.id
                          ? 'shadow-[2px_2px_0px_#000]'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: cat.color }}
                    >
                      {cat.name} ({countInBank})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Questions preview grid */}
            <div className="max-h-72 overflow-y-auto pr-2 space-y-2 bg-[#faf7ee] p-3 neo-card-sm border-2 border-black">
              {filteredQuestions.length === 0 ? (
                <div className="p-8 text-center space-y-3 bg-white neo-card-sm">
                  <div className="w-12 h-12 neo-card bg-[#ffdf00] text-black mx-auto flex items-center justify-center font-heading text-lg">
                    0
                  </div>
                  <p className="font-heading text-sm text-black">NO MATCHING QUESTIONS FOUND</p>
                  <p className="text-xs font-mono font-semibold text-slate-600">
                    {searchQuery
                      ? `No questions found matching "${searchQuery}". Clear your search or add a new question.`
                      : questions.length === 0
                      ? 'The question bank is currently empty. Add your questions or paste below.'
                      : 'No questions currently match this category.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAddModalCategory(
                          selectedCategoryTab !== 'all' ? (selectedCategoryTab as DifficultyLevel) : 'moderate'
                        );
                        setIsAddModalOpen(true);
                      }}
                      className="neo-btn bg-[#86efac] text-black px-3.5 py-2 text-xs font-heading flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" /> ADD QUESTION
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasteModalCategory(
                          selectedCategoryTab !== 'all' ? (selectedCategoryTab as DifficultyLevel) : 'moderate'
                        );
                        setIsPasteModalOpen(true);
                      }}
                      className="neo-btn bg-[#ffdf00] text-black px-3.5 py-2 text-xs font-heading flex items-center gap-1.5"
                    >
                      <ClipboardPaste className="w-4 h-4 stroke-[2.5]" /> PASTE QUESTIONS
                    </button>
                  </div>
                </div>
              ) : (
                filteredQuestions.map((q, idx) => {
                  const cat = CATEGORIES[q.category] || CATEGORIES.beginner;
                  return (
                    <div
                      key={q.id || idx}
                      className="flex items-center justify-between gap-3 p-2.5 bg-white neo-card-sm text-xs hover:border-black transition-all"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                        <span
                          className="neo-badge px-2 py-0.5 text-[10px] font-heading shrink-0"
                          style={{ backgroundColor: cat.color }}
                        >
                          +{cat.points} PTS
                        </span>
                        <span className="font-sans font-semibold text-black truncate">
                          {q.question}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="font-mono font-bold text-xs neo-badge bg-[#86efac] text-black px-2 py-0.5 truncate max-w-[150px]">
                          Ans: {q.answer}
                        </div>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => {
                            soundEffects.playTileClick();
                            setEditingQuestion(q);
                          }}
                          className="p-1.5 bg-slate-100 hover:bg-[#7dd3fc] text-black rounded border border-black transition-all"
                          title="Edit this question"
                        >
                          <Edit3 className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => handleSingleDelete(q.id, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                          title="Delete this question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 bg-[#ff7675] neo-card-sm text-black font-mono font-bold text-xs flex items-center gap-2 border-2 border-black">
              <AlertCircle className="w-5 h-5 shrink-0 stroke-[2.5]" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit CTA */}
          <div className="pt-6 border-t-3 border-black flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs font-mono text-slate-600">
              Board Setup: <strong className="text-black">{groupCount} Teams</strong> •{' '}
              <strong className="text-black">{totalQuestions} Tiles ({questionsPerCategory}/cat)</strong> •{' '}
              <strong className="text-black">{timerSeconds}s Timer</strong>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="neo-btn bg-[#86efac] hover:bg-[#6ee7b7] text-black px-8 py-4 text-sm sm:text-base font-heading flex items-center gap-3 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>GENERATING ACCESS CODES...</>
              ) : (
                <>
                  CREATE GROUPS & LAUNCH LOBBY
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Add Single Question Modal */}
      {isAddModalOpen && (
        <AddQuestionModal
          defaultCategory={addModalCategory}
          onAddQuestion={handleAddQuestionModal}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* Edit Existing Question Modal */}
      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          onUpdateQuestion={handleUpdateQuestionModal}
          onClose={() => setEditingQuestion(null)}
        />
      )}

      {/* Paste / Bulk Import Questions Modal */}
      {isPasteModalOpen && (
        <PasteQuestionsModal
          defaultCategory={pasteModalCategory}
          totalQuestions={totalQuestions}
          maxPerCategory={questionsPerCategory}
          existingQuestions={questions}
          onImportQuestions={handleImportPastedQuestions}
          onClose={() => setIsPasteModalOpen(false)}
        />
      )}

      {/* In-App Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmationDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          confirmVariant={confirmDialog.confirmVariant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Local MongoDB Diagnostics Modal */}
      {isDbModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neo-card-lg bg-white w-full max-w-lg p-6 shadow-[10px_10px_0px_#000] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 neo-card flex items-center justify-center ${
                    dbStatus?.connected ? 'bg-[#86efac]' : 'bg-[#ffdf00]'
                  }`}
                >
                  <Database className="w-5 h-5 text-black stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-heading text-lg text-black leading-tight">Database Connection</h3>
                  <p className="text-[11px] font-mono font-bold text-slate-500">Local MongoDB & Offline LAN Mode</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDbModalOpen(false)}
                className="neo-btn-sm bg-slate-100 hover:bg-slate-200 text-black p-1.5"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Status Card */}
            <div className="space-y-4 font-sans mb-6">
              <div
                className={`p-4 border-2 border-black rounded-lg ${
                  dbStatus?.connected ? 'bg-[#dcfce7]' : 'bg-[#fef9c3]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      dbStatus?.connected ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'
                    }`}
                  />
                  <span className="font-heading text-sm text-black">
                    {dbStatus?.connected
                      ? 'Connected to Local MongoDB (127.0.0.1:27017)'
                      : 'Running on High-Speed Local Persistent Storage (.data/db.json)'}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-700 leading-relaxed">
                  {dbStatus?.connected
                    ? `Local database "${dbStatus.databaseName}" is live on the Host laptop. All sessions, questions, and scores persist locally without Internet.`
                    : dbStatus?.lastError ||
                      'Local MongoDB is not running on 127.0.0.1:27017. Start the MongoDB service and restart the application, or continue using the built-in local persistence.'}
                </p>
              </div>

              {/* Step by step help if not connected to Local MongoDB */}
              {!dbStatus?.connected && (
                <div className="p-3.5 bg-slate-50 border-2 border-black rounded-lg space-y-2">
                  <h4 className="font-heading text-xs text-black flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 stroke-[2.5]" />
                    HOW TO START LOCAL MONGODB:
                  </h4>
                  <ol className="text-xs font-bold text-slate-700 space-y-1.5 list-decimal list-inside">
                    <li>
                      Ensure MongoDB Community is installed on your Host laptop.
                    </li>
                    <li>
                      Start the service by opening a terminal and running <span className="font-mono bg-slate-200 px-1 py-0.5 rounded text-black font-bold">mongod</span> (or via Windows Services / <span className="font-mono bg-slate-200 px-1 py-0.5 rounded text-black font-bold">brew services start mongodb-community</span>).
                    </li>
                    <li>
                      Once running, click <strong>TEST & RECONNECT</strong> below.
                    </li>
                    <li className="text-slate-500 font-normal">
                      Note: Even without local MongoDB running, the application functions seamlessly using built-in persistent storage.
                    </li>
                  </ol>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t-2 border-black">
              <button
                type="button"
                onClick={() => setIsDbModalOpen(false)}
                className="neo-btn-sm bg-slate-100 hover:bg-slate-200 text-black px-4 py-2 text-xs font-heading"
              >
                CLOSE
              </button>

              <button
                type="button"
                disabled={isTestingDb}
                onClick={handleReconnectDb}
                className="neo-btn bg-[#7dd3fc] hover:bg-[#38bdf8] text-black px-4 py-2 text-xs font-heading flex items-center gap-2 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${isTestingDb ? 'animate-spin' : ''}`} />
                {isTestingDb ? 'TESTING CONNECTION...' : 'TEST & RECONNECT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
