import React, { useState } from 'react';
import { X, Plus, Sparkles, Check, HelpCircle } from 'lucide-react';
import { Question, DifficultyLevel } from '../types/game';
import { CATEGORIES } from '../data/defaultQuestions';
import { soundEffects } from '../utils/soundEffects';

interface AddQuestionModalProps {
  defaultCategory?: DifficultyLevel;
  onAddQuestion: (question: Question) => Promise<boolean>;
  onClose: () => void;
}

export const AddQuestionModal: React.FC<AddQuestionModalProps> = ({
  defaultCategory = 'moderate',
  onAddQuestion,
  onClose,
}) => {
  const [category, setCategory] = useState<DifficultyLevel>(defaultCategory);
  const [points, setPoints] = useState<number>(CATEGORIES[defaultCategory]?.points || 6);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number>(0);

  const handleCategoryChange = (newCat: DifficultyLevel) => {
    soundEffects.playTileClick();
    setCategory(newCat);
    setPoints(CATEGORIES[newCat]?.points || 6);
  };

  const handleSave = async (addAnother: boolean = false) => {
    setErrorMsg(null);
    if (!question.trim()) {
      setErrorMsg('Please enter a question prompt.');
      return;
    }
    if (!answer.trim()) {
      setErrorMsg('Please enter the correct answer.');
      return;
    }

    setIsSubmitting(true);
    soundEffects.playCoin();
    try {
      const newQuestion: Question = {
        id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
        category,
        points: Number(points) || CATEGORIES[category]?.points || 6,
        question: question.trim(),
        answer: answer.trim(),
        hint: hint.trim() ? hint.trim() : undefined,
      };

      const ok = await onAddQuestion(newQuestion);
      if (ok) {
        setSuccessCount((prev) => prev + 1);
        if (addAnother) {
          setQuestion('');
          setAnswer('');
          setHint('');
        } else {
          onClose();
        }
      } else {
        setErrorMsg('Failed to save question to server.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="neo-card-lg bg-white w-full max-w-lg p-5 sm:p-7 shadow-[10px_10px_0px_#000] relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b-3 border-black">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 neo-card bg-[#86efac] text-black flex items-center justify-center">
              <Plus className="w-5 h-5 stroke-[3]" />
            </div>
            <div>
              <h3 className="font-heading text-lg sm:text-xl text-black leading-tight">
                ADD NEW TRIVIA QUESTION
              </h3>
              <p className="text-[11px] font-mono font-bold text-slate-600">
                Single Question Creation & Category Assignment
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="neo-btn-sm bg-white hover:bg-rose-100 text-black p-1.5"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 bg-[#ff7675] text-black neo-card-sm text-xs font-mono font-bold border-2 border-black">
            ⚠️ {errorMsg}
          </div>
        )}

        {successCount > 0 && (
          <div className="mb-4 p-2.5 bg-[#86efac] text-black neo-card-sm text-xs font-mono font-bold border-2 border-black flex items-center gap-2">
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Successfully added {successCount} question{successCount > 1 ? 's' : ''}! Add another below or close.</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Category Badges Selector */}
          <div>
            <label className="block text-xs font-heading text-black mb-1.5 flex items-center justify-between">
              <span>CATEGORY & DIFFICULTY</span>
              <span className="font-mono text-[11px] text-slate-600 font-bold">
                Value: +{points} Points
              </span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(Object.keys(CATEGORIES) as DifficultyLevel[]).map((catKey) => {
                const cat = CATEGORIES[catKey];
                const isSelected = category === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => handleCategoryChange(catKey)}
                    className={`py-1.5 px-1 rounded-lg border-2 border-black text-center transition-all ${
                      isSelected
                        ? 'shadow-[2px_2px_0px_#000] scale-105 font-bold text-black ring-2 ring-black'
                        : 'opacity-70 hover:opacity-100 text-black'
                    }`}
                    style={{ backgroundColor: cat.color }}
                  >
                    <span className="block font-heading text-[10px] sm:text-xs truncate">
                      {cat.name}
                    </span>
                    <span className="block font-mono text-[9px] font-extrabold">
                      +{cat.points}p
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Textarea */}
          <div>
            <label className="block text-xs font-heading text-black mb-1">
              QUESTION PROMPT <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., What is the capital of the Philippines?"
              className="w-full neo-input p-3 text-sm font-sans font-bold text-black"
              autoFocus
            />
          </div>

          {/* Correct Answer */}
          <div>
            <label className="block text-xs font-heading text-black mb-1">
              CORRECT ANSWER <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="e.g., Manila"
              className="w-full neo-input p-2.5 text-sm font-mono font-bold text-black"
            />
          </div>

          {/* Optional Hint */}
          <div>
            <label className="block text-xs font-heading text-black mb-1">
              HINT (OPTIONAL)
            </label>
            <input
              type="text"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="e.g., Known as the Pearl of the Orient"
              className="w-full neo-input p-2 text-xs font-mono font-semibold text-slate-800"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t-2 border-black">
            <button
              type="button"
              onClick={onClose}
              className="neo-btn-sm bg-slate-100 hover:bg-slate-200 text-black px-3.5 py-2 text-xs font-heading"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting || !question.trim() || !answer.trim()}
                onClick={() => handleSave(true)}
                className="neo-btn bg-[#faf7ee] hover:bg-[#fff9e6] text-black px-3.5 py-2 text-xs font-heading disabled:opacity-40"
              >
                + Add & Next
              </button>

              <button
                type="button"
                disabled={isSubmitting || !question.trim() || !answer.trim()}
                onClick={() => handleSave(false)}
                className="neo-btn bg-[#86efac] hover:bg-[#6ee7b7] text-black px-4 py-2 text-xs font-heading flex items-center gap-1.5 disabled:opacity-40"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                {isSubmitting ? 'Saving...' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
