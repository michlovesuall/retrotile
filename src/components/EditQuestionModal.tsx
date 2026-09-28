import React, { useState } from 'react';
import { X, Save, Sparkles, Check, Edit3 } from 'lucide-react';
import { Question, DifficultyLevel } from '../types/game';
import { CATEGORIES } from '../data/defaultQuestions';
import { soundEffects } from '../utils/soundEffects';

interface EditQuestionModalProps {
  question: Question;
  onUpdateQuestion: (id: string, updatedData: Partial<Question>) => Promise<boolean>;
  onClose: () => void;
}

export const EditQuestionModal: React.FC<EditQuestionModalProps> = ({
  question: initialQuestion,
  onUpdateQuestion,
  onClose,
}) => {
  const [category, setCategory] = useState<DifficultyLevel>(initialQuestion.category || 'moderate');
  const [points, setPoints] = useState<number>(initialQuestion.points || CATEGORIES[initialQuestion.category || 'moderate']?.points || 6);
  const [questionText, setQuestionText] = useState(initialQuestion.question || '');
  const [answer, setAnswer] = useState(initialQuestion.answer || '');
  const [hint, setHint] = useState(initialQuestion.hint || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCategoryChange = (newCat: DifficultyLevel) => {
    soundEffects.playTileClick();
    setCategory(newCat);
    setPoints(CATEGORIES[newCat]?.points || 6);
  };

  const handleSave = async () => {
    setErrorMsg(null);
    if (!questionText.trim()) {
      setErrorMsg('Question prompt cannot be empty.');
      return;
    }
    if (!answer.trim()) {
      setErrorMsg('Answer cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    soundEffects.playCoin();
    try {
      const ok = await onUpdateQuestion(initialQuestion.id, {
        category,
        points: Number(points),
        question: questionText.trim(),
        answer: answer.trim(),
        hint: hint.trim() ? hint.trim() : undefined,
      });

      if (ok) {
        onClose();
      } else {
        setErrorMsg('Failed to update question in database.');
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
            <div className="w-9 h-9 neo-card bg-[#7dd3fc] text-black flex items-center justify-center">
              <Edit3 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-heading text-lg sm:text-xl text-black leading-tight">
                EDIT TRIVIA QUESTION
              </h3>
              <p className="text-[11px] font-mono font-bold text-slate-600">
                Update Question in MongoDB Database (ID: {initialQuestion.id})
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
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Question prompt..."
              className="w-full neo-input p-3 text-sm font-sans font-bold text-black"
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
              placeholder="Correct answer..."
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
              placeholder="Optional hint..."
              className="w-full neo-input p-2 text-xs font-mono font-semibold text-slate-800"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t-2 border-black">
            <button
              type="button"
              onClick={onClose}
              className="neo-btn-sm bg-slate-100 hover:bg-slate-200 text-black px-3.5 py-2 text-xs font-heading"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSubmitting || !questionText.trim() || !answer.trim()}
              onClick={handleSave}
              className="neo-btn bg-[#86efac] hover:bg-[#6ee7b7] text-black px-5 py-2.5 text-xs font-heading flex items-center gap-1.5 disabled:opacity-40"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              {isSubmitting ? 'Saving to Database...' : 'Save Changes to DB'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
