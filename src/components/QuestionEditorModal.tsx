import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Search,
  Check,
  Edit2,
  ClipboardPaste,
  Sparkles,
} from 'lucide-react';
import { Question, DifficultyLevel } from '../types/game';
import { CATEGORIES } from '../data/defaultQuestions';
import { PasteQuestionsModal } from './PasteQuestionsModal';
import { AddQuestionModal } from './AddQuestionModal';
import { ConfirmationDialog } from './ConfirmationDialog';
import { soundEffects } from '../utils/soundEffects';

interface QuestionEditorModalProps {
  questions: Question[];
  onSaveQuestions: (updated: Question[], totalTilesTarget?: number) => Promise<{ success: boolean; count?: number; error?: string; questions?: Question[] } | boolean>;
  onClearAllQuestions: () => Promise<boolean>;
  onResetDefaultQuestions: () => Promise<boolean | void>;
  onClose: () => void;
  totalQuestions?: number;
  maxPerCategory?: number;
}

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  questions,
  onSaveQuestions,
  onClearAllQuestions,
  onResetDefaultQuestions,
  onClose,
  totalQuestions = 50,
  maxPerCategory,
}) => {
  const [targetTotalTiles, setTargetTotalTiles] = useState<number>(totalQuestions || 80);
  const calculatedMax = maxPerCategory || Math.max(1, Math.round(targetTotalTiles / 5));
  const [editingQuestions, setEditingQuestions] = useState<Question[]>([...questions]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    questions[0]?.id || null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  // Keep editing state in sync when parent questions update
  useEffect(() => {
    setEditingQuestions([...questions]);
    if (questions.length > 0 && (!selectedQuestionId || !questions.some((q) => q.id === selectedQuestionId))) {
      setSelectedQuestionId(questions[0].id);
    } else if (questions.length === 0) {
      setSelectedQuestionId(null);
    }
  }, [questions]);

  const currentEditingQ =
    editingQuestions.find((q) => q.id === selectedQuestionId) || editingQuestions[0];

  const handleUpdateQuestion = (field: keyof Question, value: any) => {
    if (!currentEditingQ) return;
    setEditingQuestions((prev) =>
      prev.map((q) => {
        if (q.id === currentEditingQ.id) {
          const updated = { ...q, [field]: value };
          if (field === 'category' && CATEGORIES[value as DifficultyLevel]) {
            updated.points = CATEGORIES[value as DifficultyLevel].points;
          }
          return updated;
        }
        return q;
      })
    );
  };

  const handleAddNewQuestionDirect = () => {
    soundEffects.playTileClick();
    const catKey = activeCategory !== 'all' ? (activeCategory as DifficultyLevel) : 'moderate';
    const currentInCat = editingQuestions.filter((q) => q.category === catKey).length;

    if (currentInCat >= calculatedMax) {
      soundEffects.playWrong();
      setConfirmDialog({
        isOpen: true,
        title: 'QUESTION LIMIT REACHED',
        message: `Category "${CATEGORIES[catKey]?.name || catKey}" already contains ${currentInCat} questions, which is the maximum allowed (${calculatedMax}) for this ${totalQuestions}-tile configuration.`,
        confirmLabel: 'UNDERSTOOD',
        confirmVariant: 'warning',
        onConfirm: () => setConfirmDialog(null),
      });
      return;
    }

    const newId = `custom-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const newQ: Question = {
      id: newId,
      category: catKey,
      points: CATEGORIES[catKey]?.points || 6,
      question: 'New trivia question prompt...',
      answer: 'Correct answer',
      hint: 'Optional hint for players',
    };
    const updated = [newQ, ...editingQuestions];
    setEditingQuestions(updated);
    setSelectedQuestionId(newId);
    // Auto save
    onSaveQuestions(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleAddQuestionFromModal = async (newQ: Question): Promise<boolean> => {
    const currentInCat = editingQuestions.filter((q) => q.category === newQ.category).length;
    if (currentInCat >= calculatedMax) {
      soundEffects.playWrong();
      setConfirmDialog({
        isOpen: true,
        title: 'QUESTION LIMIT REACHED',
        message: `Category "${CATEGORIES[newQ.category]?.name || newQ.category}" already contains ${currentInCat} questions, which is the maximum allowed (${calculatedMax}) for this ${totalQuestions}-tile configuration.`,
        confirmLabel: 'UNDERSTOOD',
        confirmVariant: 'warning',
        onConfirm: () => setConfirmDialog(null),
      });
      return false;
    }

    const updated = [newQ, ...editingQuestions];
    setEditingQuestions(updated);
    setSelectedQuestionId(newQ.id);
    const res = await onSaveQuestions(updated, targetTotalTiles);
    const isOk = typeof res === 'boolean' ? res : Boolean(res && res.success);
    if (isOk) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }
    return isOk;
  };

  const handleDeleteQuestion = async (id: string) => {
    soundEffects.playWrong();
    const remaining = editingQuestions.filter((q) => q.id !== id);
    setEditingQuestions(remaining);
    if (selectedQuestionId === id) {
      setSelectedQuestionId(remaining[0]?.id || null);
    }
    // Auto save
    await onSaveQuestions(remaining);
  };

  const handleImportPastedQuestions = async (
    newQuestions: Question[],
    mode: 'append' | 'replace_category' | 'replace_all',
    targetCategory: DifficultyLevel
  ) => {
    let updated: Question[] = [];
    if (mode === 'replace_all') {
      updated = newQuestions;
    } else if (mode === 'replace_category') {
      const distinctCats = Array.from(new Set(newQuestions.map((q) => q.category)));
      const remaining = editingQuestions.filter(
        (q) => !distinctCats.includes(q.category) && q.category !== targetCategory
      );
      updated = [...remaining, ...newQuestions];
    } else {
      // Append
      updated = [...editingQuestions, ...newQuestions];
    }

    // Strict validation before save: for each category, count <= calculatedMax
    const categories: DifficultyLevel[] = ['beginner', 'easy', 'moderate', 'hard', 'insane'];
    for (const catKey of categories) {
      const count = updated.filter((q) => q.category === catKey).length;
      if (count > calculatedMax) {
        soundEffects.playWrong();
        setConfirmDialog({
          isOpen: true,
          title: 'QUESTION LIMIT EXCEEDED',
          message: `Category "${CATEGORIES[catKey]?.name || catKey}" contains ${count} questions, but the maximum allowed for this game configuration is ${calculatedMax}.`,
          confirmLabel: 'OK',
          confirmVariant: 'danger',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }
    }

    // Auto-save to server & Local MongoDB
    const saveRes = await onSaveQuestions(updated, targetTotalTiles);
    const isSuccess = typeof saveRes === 'boolean' ? saveRes : Boolean(saveRes && saveRes.success);
    if (isSuccess) {
      setEditingQuestions(updated);
      if (newQuestions.length > 0) {
        setSelectedQuestionId(newQuestions[0].id);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      return { success: true, count: newQuestions.length };
    } else {
      soundEffects.playWrong();
      const errorMsg = (typeof saveRes === 'object' && saveRes?.error) ? saveRes.error : 'Database insertion failed.';
      setConfirmDialog({
        isOpen: true,
        title: 'DATABASE ERROR',
        message: errorMsg,
        confirmLabel: 'OK',
        confirmVariant: 'danger',
        onConfirm: () => setConfirmDialog(null),
      });
      return { success: false, error: errorMsg };
    }
  };

  const handleSave = async () => {
    // Validate each category before save
    const categories: DifficultyLevel[] = ['beginner', 'easy', 'moderate', 'hard', 'insane'];
    for (const catKey of categories) {
      const count = editingQuestions.filter((q) => q.category === catKey).length;
      if (count > calculatedMax) {
        soundEffects.playWrong();
        setConfirmDialog({
          isOpen: true,
          title: 'QUESTION LIMIT EXCEEDED',
          message: `Category "${CATEGORIES[catKey]?.name || catKey}" contains ${count} questions, but the maximum allowed for this game configuration is ${calculatedMax}.`,
          confirmLabel: 'OK',
          confirmVariant: 'danger',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }
    }

    setIsSaving(true);
    soundEffects.playCoin();
    try {
      const ok = await onSaveQuestions(editingQuestions, targetTotalTiles);
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAllQuestions = () => {
    if (editingQuestions.length === 0) return;
    soundEffects.playTileClick();
    setConfirmDialog({
      isOpen: true,
      title: 'DELETE ALL QUESTIONS?',
      message: `Are you sure you want to DELETE ALL ${editingQuestions.length} questions? This will completely empty the questions bank.`,
      confirmLabel: `Delete All (${editingQuestions.length})`,
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        soundEffects.playWrong();
        setEditingQuestions([]);
        setSelectedQuestionId(null);
        await onClearAllQuestions();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      },
    });
  };

  const handleRestoreDefaults = () => {
    soundEffects.playTileClick();
    setConfirmDialog({
      isOpen: true,
      title: 'RESTORE 50 DEFAULT QUESTIONS?',
      message: 'Reset all questions back to the original 50 defaults?',
      confirmLabel: 'Restore 50 Defaults',
      confirmVariant: 'warning',
      onConfirm: async () => {
        setConfirmDialog(null);
        soundEffects.playCoin();
        await onResetDefaultQuestions();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      },
    });
  };

  const filtered = editingQuestions.filter((q) => {
    const matchesCat = activeCategory === 'all' || q.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="neo-card-lg bg-white w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-[10px_10px_0px_#000]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b-3 border-black flex flex-wrap items-center justify-between gap-3 bg-[#fffdfa]">
          <div>
            <h2 className="font-heading text-lg sm:text-xl text-black flex items-center gap-2">
              <Edit2 className="w-5 h-5 stroke-[2.5]" />
              QUESTIONS BANK MANAGER
            </h2>
            <p className="text-xs font-mono font-bold text-slate-600 mt-0.5">
              Manage, create, and customize trivia questions and point values ({editingQuestions.length} Questions Total)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="neo-btn bg-[#86efac] hover:bg-[#6ee7b7] text-black px-4 py-2 text-xs font-heading flex items-center gap-1.5"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" /> SAVED!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 stroke-[2.5]" /> {isSaving ? 'SAVING...' : 'SAVE ALL'}
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="neo-btn-sm bg-white hover:bg-rose-100 text-black p-2"
              title="Close editor"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-3 bg-[#faf7ee] border-b-2 border-black flex flex-wrap items-center justify-between gap-3">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 text-xs font-heading rounded-lg border-2 border-black ${
                activeCategory === 'all'
                  ? 'bg-black text-white shadow-[2px_2px_0px_#000]'
                  : 'bg-white text-black hover:bg-slate-50'
              }`}
            >
              ALL ({editingQuestions.length})
            </button>
            {Object.values(CATEGORIES).map((cat) => {
              const count = editingQuestions.filter((q) => q.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1.5 text-xs font-heading rounded-lg border-2 border-black transition-all ${
                    activeCategory === cat.id
                      ? 'shadow-[2px_2px_0px_#000]'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: cat.color }}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Action Buttons: Add, Paste, Restore Defaults, Delete All */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="neo-input pl-8 pr-3 py-1.5 text-xs font-mono font-bold text-black w-36 sm:w-44"
              />
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="neo-btn-sm bg-[#86efac] hover:bg-[#6ee7b7] text-black px-3 py-1.5 text-xs font-heading flex items-center gap-1 shadow-[2px_2px_0px_#000]"
              title="Add a new question"
            >
              <Plus className="w-4 h-4 stroke-[3]" /> ADD QUESTION
            </button>

            <button
              onClick={() => setIsPasteModalOpen(true)}
              className="neo-btn-sm bg-[#faf7ee] hover:bg-[#ffdf00] text-black px-3 py-1.5 text-xs font-heading flex items-center gap-1.5"
              title="Paste questions in question;answer;hint format"
            >
              <ClipboardPaste className="w-4 h-4 stroke-[2.5]" /> PASTE
            </button>

            <button
              onClick={handleDeleteAllQuestions}
              disabled={editingQuestions.length === 0}
              className="neo-btn-sm bg-[#ff7675] hover:bg-[#ff5252] text-black px-3 py-1.5 text-xs font-heading flex items-center gap-1 disabled:opacity-40"
              title="Delete all questions from the bank"
            >
              <Trash2 className="w-4 h-4 stroke-[2.5]" /> DELETE ALL ({editingQuestions.length})
            </button>
          </div>
        </div>

        {/* Master-Detail Split */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden min-h-[380px]">
          {/* Question List (Left) */}
          <div className="md:col-span-5 border-r-3 border-black overflow-y-auto p-3 space-y-2.5 bg-[#faf7ee]">
            {filtered.length === 0 ? (
              <div className="text-center py-10 px-4 space-y-3">
                <div className="w-12 h-12 neo-card bg-[#ffdf00] text-black mx-auto flex items-center justify-center font-heading text-lg">
                  0
                </div>
                <p className="font-heading text-sm text-black">NO QUESTIONS FOUND</p>
                <p className="text-xs font-mono font-semibold text-slate-600">
                  {editingQuestions.length === 0
                    ? 'Questions bank is completely empty.'
                    : 'No questions match this category or search query.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="neo-btn bg-[#86efac] text-black px-3 py-1.5 text-xs font-heading flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" /> ADD QUESTION
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPasteModalOpen(true)}
                    className="neo-btn bg-[#ffdf00] text-black px-3 py-1.5 text-xs font-heading"
                  >
                    PASTE QUESTIONS
                  </button>
                </div>
              </div>
            ) : (
              filtered.map((q) => {
                const cat = CATEGORIES[q.category] || CATEGORIES.beginner;
                const isSelected = selectedQuestionId === q.id;

                return (
                  <div
                    key={q.id}
                    onClick={() => setSelectedQuestionId(q.id)}
                    className={`p-3 neo-card transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white shadow-[4px_4px_0px_#000] scale-[1.01]'
                        : 'bg-white/80 hover:bg-white'
                    }`}
                    style={{ borderLeft: `8px solid ${cat.color}` }}
                  >
                    <div className="flex items-center justify-between text-xs font-heading mb-1">
                      <span className="text-black">
                        {cat.name} (+{q.points} PTS)
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteQuestion(q.id);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-0.5"
                        title="Delete this question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="font-sans font-bold text-xs text-black line-clamp-2 leading-tight">
                      {q.question}
                    </p>
                    <p className="font-mono text-[11px] font-bold text-emerald-700 mt-1 truncate">
                      Ans: {q.answer}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Question Form (Right) */}
          <div className="md:col-span-7 p-5 sm:p-6 overflow-y-auto bg-white">
            {currentEditingQ ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <span className="font-heading text-xs text-black">
                    EDITING TILE #{currentEditingQ.id}
                  </span>
                  <span className="neo-badge bg-[#7dd3fc] text-black text-xs px-2 py-0.5 font-mono">
                    Category: {currentEditingQ.category.toUpperCase()}
                  </span>
                </div>

                {/* Category & Points */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-heading text-black mb-1">
                      CATEGORY
                    </label>
                    <select
                      value={currentEditingQ.category}
                      onChange={(e) =>
                        handleUpdateQuestion('category', e.target.value as DifficultyLevel)
                      }
                      className="w-full neo-input p-2 text-xs font-mono font-bold text-black"
                    >
                      {Object.values(CATEGORIES).map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({cat.points} PTS)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-heading text-black mb-1">
                      POINTS VALUE
                    </label>
                    <input
                      type="number"
                      value={currentEditingQ.points}
                      onChange={(e) => handleUpdateQuestion('points', Number(e.target.value))}
                      className="w-full neo-input p-2 text-xs font-mono font-bold text-black"
                    />
                  </div>
                </div>

                {/* Question Prompt */}
                <div>
                  <label className="block text-xs font-heading text-black mb-1">
                    QUESTION PROMPT
                  </label>
                  <textarea
                    rows={3}
                    value={currentEditingQ.question}
                    onChange={(e) => handleUpdateQuestion('question', e.target.value)}
                    className="w-full neo-input p-3 text-sm font-sans font-bold text-black leading-relaxed"
                  />
                </div>

                {/* Correct Answer */}
                <div>
                  <label className="block text-xs font-heading text-black mb-1">
                    CORRECT ANSWER
                  </label>
                  <input
                    type="text"
                    value={currentEditingQ.answer}
                    onChange={(e) => handleUpdateQuestion('answer', e.target.value)}
                    className="w-full neo-input p-2.5 text-sm font-sans font-extrabold text-black"
                  />
                </div>

                {/* Hint */}
                <div>
                  <label className="block text-xs font-heading text-black mb-1">
                    HINT (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={currentEditingQ.hint || ''}
                    onChange={(e) => handleUpdateQuestion('hint', e.target.value)}
                    placeholder="Clue to display if players need assistance..."
                    className="w-full neo-input p-2 text-xs font-mono font-semibold text-slate-800"
                  />
                </div>

                <div className="p-3 neo-card-sm bg-[#faf7ee] text-xs font-mono font-bold text-slate-700 flex items-center justify-between">
                  <span>ℹ️ Click "SAVE ALL" to apply changes to the active game board.</span>
                  <button
                    type="button"
                    onClick={handleAddNewQuestionDirect}
                    className="neo-btn-sm bg-[#86efac] text-black px-2.5 py-1 text-xs font-heading flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" /> + ADD ANOTHER
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 font-mono font-bold space-y-3">
                <p>No question selected.</p>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="neo-btn bg-[#86efac] text-black px-4 py-2 text-xs font-heading"
                >
                  + ADD A QUESTION
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Single Question Modal */}
      {isAddModalOpen && (
        <AddQuestionModal
          defaultCategory={activeCategory !== 'all' ? (activeCategory as DifficultyLevel) : 'moderate'}
          onAddQuestion={handleAddQuestionFromModal}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* Paste / Bulk Import Questions Modal */}
      {isPasteModalOpen && (
        <PasteQuestionsModal
          defaultCategory={activeCategory !== 'all' ? (activeCategory as DifficultyLevel) : 'moderate'}
          totalQuestions={targetTotalTiles}
          maxPerCategory={calculatedMax}
          existingQuestions={editingQuestions}
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
    </div>
  );
};
