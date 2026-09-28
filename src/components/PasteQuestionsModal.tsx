import React, { useState, useMemo } from 'react';
import {
  X,
  ClipboardPaste,
  Check,
  AlertCircle,
  FileText,
  Scissors,
  Info,
} from 'lucide-react';
import { Question, DifficultyLevel } from '../types/game';
import { CATEGORIES } from '../data/defaultQuestions';
import { generateSampleQuestionText } from '../data/sampleQuestionsBank';
import { soundEffects } from '../utils/soundEffects';

interface PasteQuestionsModalProps {
  onImportQuestions: (
    newQuestions: Question[],
    mode: 'append' | 'replace_category' | 'replace_all',
    targetCategory: DifficultyLevel
  ) => Promise<{ success: boolean; count?: number; error?: string } | boolean | void> | void;
  onClose: () => void;
  defaultCategory?: DifficultyLevel;
  totalQuestions?: number;
  maxPerCategory?: number;
  existingQuestions?: Question[];
}

interface ParsedQuestionRow {
  lineNum: number;
  rawLine: string;
  question: string;
  answer: string;
  hint: string;
  category: DifficultyLevel;
  isValid: boolean;
  error?: string;
  categoryIndex: number; // 1-based index within its category
  isOverCapacity: boolean;
}

const CATEGORY_KEYS: DifficultyLevel[] = ['beginner', 'easy', 'moderate', 'hard', 'insane'];

export const PasteQuestionsModal: React.FC<PasteQuestionsModalProps> = ({
  onImportQuestions,
  onClose,
  defaultCategory = 'moderate',
  totalQuestions = 50,
  maxPerCategory,
  existingQuestions = [],
}) => {
  // Dynamically determine maximum questions allowed per category:
  // Rule: Maximum Questions Per Category = Total Tile Questions ÷ Number of Categories
  const categoryCount = CATEGORY_KEYS.length; // 5 categories
  const calculatedMaxPerCategory =
    maxPerCategory || Math.max(1, Math.round(totalQuestions / categoryCount));

  const [inputText, setInputText] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [distributionMode, setDistributionMode] = useState<
    'single_category' | 'distribute_evenly' | 'auto_detect'
  >('single_category');
  const [targetCategory, setTargetCategory] = useState<DifficultyLevel>(defaultCategory);
  const [importMode, setImportMode] = useState<'append' | 'replace_category' | 'replace_all'>('replace_category');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Compute existing count per category from currently loaded questions
  const existingCounts = useMemo<Record<DifficultyLevel, number>>(() => {
    const counts: Record<DifficultyLevel, number> = {
      beginner: 0,
      easy: 0,
      moderate: 0,
      hard: 0,
      insane: 0,
    };
    existingQuestions.forEach((q) => {
      if (q && counts[q.category] !== undefined) {
        counts[q.category]++;
      }
    });
    return counts;
  }, [existingQuestions]);

  // Determine starting count of existing questions that will be retained based on importMode
  const retainedExistingCounts = useMemo<Record<DifficultyLevel, number>>(() => {
    const counts: Record<DifficultyLevel, number> = {
      beginner: 0,
      easy: 0,
      moderate: 0,
      hard: 0,
      insane: 0,
    };

    CATEGORY_KEYS.forEach((cat) => {
      if (importMode === 'replace_all') {
        counts[cat] = 0;
      } else if (importMode === 'replace_category') {
        if (distributionMode === 'distribute_evenly') {
          // Replaces all 5 categories
          counts[cat] = 0;
        } else if (distributionMode === 'single_category') {
          // Only targetCategory is replaced; others remain unchanged
          counts[cat] = cat === targetCategory ? 0 : existingCounts[cat];
        } else {
          // auto_detect: categories present in import will be replaced
          counts[cat] = 0;
        }
      } else {
        // 'append' mode: retains all existing questions
        counts[cat] = existingCounts[cat];
      }
    });

    return counts;
  }, [importMode, distributionMode, targetCategory, existingCounts]);

  // Parse lines and tag each with category and capacity validity
  const parsedRows = useMemo<ParsedQuestionRow[]>(() => {
    const lines = inputText.split('\n');
    const rawLines: { lineNum: number; rawLine: string; parts: string[] }[] = [];

    lines.forEach((raw, idx) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const parts = trimmed.split(';').map((p) => p.trim());
      rawLines.push({ lineNum: idx + 1, rawLine: trimmed, parts });
    });

    const totalRawLines = rawLines.length;
    const catTracker: Record<DifficultyLevel, number> = {
      beginner: 0,
      easy: 0,
      moderate: 0,
      hard: 0,
      insane: 0,
    };

    return rawLines.map(({ lineNum, rawLine, parts }, lineIdx) => {
      if (parts.length < 2) {
        return {
          lineNum,
          rawLine,
          question: parts[0] || '',
          answer: '',
          hint: '',
          category: targetCategory,
          isValid: false,
          error: 'Missing semicolon (;) separator between question and answer',
          categoryIndex: 0,
          isOverCapacity: false,
        };
      }

      // Check if line explicitly starts with category name (e.g. beginner;What is 2+2?;4)
      const firstPartLower = parts[0].toLowerCase();
      const isFirstPartCategory = CATEGORY_KEYS.includes(firstPartLower as DifficultyLevel);

      let resolvedCategory: DifficultyLevel = targetCategory;
      let questionText = parts[0];
      let answerText = parts[1];
      let hintText = parts[2] || '';

      if (isFirstPartCategory && parts.length >= 3) {
        resolvedCategory = firstPartLower as DifficultyLevel;
        questionText = parts[1];
        answerText = parts[2];
        hintText = parts[3] || '';
      } else if (distributionMode === 'distribute_evenly') {
        const chunkIndex = Math.min(4, Math.floor((lineIdx / Math.max(1, totalRawLines)) * 5));
        resolvedCategory = CATEGORY_KEYS[chunkIndex];
      } else if (distributionMode === 'auto_detect') {
        if (isFirstPartCategory) {
          resolvedCategory = firstPartLower as DifficultyLevel;
        } else if (parts[0] === '1') resolvedCategory = 'beginner';
        else if (parts[0] === '2') resolvedCategory = 'easy';
        else if (parts[0] === '3') resolvedCategory = 'moderate';
        else if (parts[0] === '4') resolvedCategory = 'hard';
        else if (parts[0] === '5') resolvedCategory = 'insane';
        else resolvedCategory = targetCategory;
      } else {
        resolvedCategory = targetCategory;
      }

      const isFormatValid = Boolean(questionText && answerText);
      let catIndex = 0;
      let isOverCapacity = false;
      let error = !questionText ? 'Missing question' : !answerText ? 'Missing answer' : undefined;

      if (isFormatValid) {
        catTracker[resolvedCategory]++;
        catIndex = catTracker[resolvedCategory];
        const totalProjected = retainedExistingCounts[resolvedCategory] + catIndex;
        if (totalProjected > calculatedMaxPerCategory) {
          isOverCapacity = true;
          error = `Question Limit Reached: This category can contain a maximum of ${calculatedMaxPerCategory} questions based on the selected ${totalQuestions}-tile game configuration.`;
        }
      }

      // Question 1-16 accepted; Question 17 and beyond must not be accepted
      const isValid = isFormatValid && !isOverCapacity;

      return {
        lineNum,
        rawLine,
        category: resolvedCategory,
        question: questionText,
        answer: answerText,
        hint: hintText,
        isValid,
        error,
        categoryIndex: catIndex,
        isOverCapacity,
      };
    });
  }, [inputText, targetCategory, distributionMode, retainedExistingCounts, calculatedMaxPerCategory, totalQuestions]);

  const validRows = useMemo(() => parsedRows.filter((r) => r.isValid), [parsedRows]);
  const invalidRows = useMemo(() => parsedRows.filter((r) => !r.isValid), [parsedRows]);

  // Breakdown of newly parsed valid questions per category
  const newCategoryCounts = useMemo<Record<DifficultyLevel, number>>(() => {
    const counts: Record<DifficultyLevel, number> = {
      beginner: 0,
      easy: 0,
      moderate: 0,
      hard: 0,
      insane: 0,
    };
    validRows.forEach((r) => {
      counts[r.category]++;
    });
    return counts;
  }, [validRows]);

  // Identify any categories that exceed the calculated dynamic limit
  const overLimitCategories = useMemo(() => {
    const over: Array<{
      category: DifficultyLevel;
      categoryName: string;
      existing: number;
      pasted: number;
      total: number;
      maxAllowed: number;
      excess: number;
    }> = [];

    CATEGORY_KEYS.forEach((catKey) => {
      const existing = retainedExistingCounts[catKey];
      const pasted = newCategoryCounts[catKey];
      const total = existing + pasted;
      if (total > calculatedMaxPerCategory) {
        over.push({
          category: catKey,
          categoryName: CATEGORIES[catKey]?.name || catKey.toUpperCase(),
          existing,
          pasted,
          total,
          maxAllowed: calculatedMaxPerCategory,
          excess: total - calculatedMaxPerCategory,
        });
      }
    });

    return over;
  }, [retainedExistingCounts, newCategoryCounts, calculatedMaxPerCategory]);

  const hasLimitViolations = overLimitCategories.length > 0;

  // Insert Example button logic - Strictly respects current category limit (Requirement)
  const handleInsertSample = () => {
    soundEffects.playTileClick();
    setValidationError(null);

    if (distributionMode === 'distribute_evenly') {
      let canAdd = true;
      if (importMode === 'append') {
        const remainingEach = CATEGORY_KEYS.map((c) => Math.max(0, calculatedMaxPerCategory - retainedExistingCounts[c]));
        const totalRemaining = remainingEach.reduce((a, b) => a + b, 0);
        if (totalRemaining <= 0) {
          canAdd = false;
        }
      }

      if (!canAdd) {
        setValidationError(
          `Question Limit Reached: All categories already contain their maximum of ${calculatedMaxPerCategory} questions based on the selected ${totalQuestions}-tile game configuration.`
        );
        soundEffects.playWrong();
        return;
      }

      // Generate sample questions evenly for all categories up to calculatedMaxPerCategory each
      const sampleText = generateSampleQuestionText(
        targetCategory,
        calculatedMaxPerCategory * categoryCount,
        'distribute_evenly'
      );
      // Replaces current example content - repeated clicking will not append or exceed
      setInputText(sampleText);
      setActionNotice(
        `Generated ${calculatedMaxPerCategory * categoryCount} sample questions (${calculatedMaxPerCategory} for each of the ${categoryCount} categories).`
      );
    } else {
      // Single category mode: calculate allowable capacity accounting for existing questions
      const existingInCat = retainedExistingCounts[targetCategory];
      const allowableCount = Math.max(0, calculatedMaxPerCategory - existingInCat);

      if (allowableCount <= 0) {
        setValidationError(
          `Question Limit Reached: This category can contain a maximum of ${calculatedMaxPerCategory} questions based on the selected ${totalQuestions}-tile game configuration.`
        );
        soundEffects.playWrong();
        return;
      }

      const countToGenerate = Math.min(allowableCount, calculatedMaxPerCategory);
      const sampleText = generateSampleQuestionText(
        targetCategory,
        countToGenerate,
        'single_category'
      );
      // Replaces current example content - repeated clicking will not append or exceed
      setInputText(sampleText);
      setActionNotice(
        `Generated ${countToGenerate} sample questions for ${CATEGORIES[targetCategory]?.name} (Limit: ${calculatedMaxPerCategory}).`
      );
    }

    setTimeout(() => setActionNotice(null), 3500);
  };

  // Helper function to resolve category of a question line consistently
  const resolveLineCategory = (line: string, index: number, totalLinesCount: number): DifficultyLevel => {
    const parts = line.split(';').map((p) => p.trim());
    if (parts.length >= 2) {
      const firstLower = parts[0].toLowerCase();
      if (CATEGORY_KEYS.includes(firstLower as DifficultyLevel) && parts.length >= 3) {
        return firstLower as DifficultyLevel;
      }
    }
    if (distributionMode === 'distribute_evenly') {
      const chunkIndex = Math.min(4, Math.floor((index / Math.max(1, totalLinesCount)) * 5));
      return CATEGORY_KEYS[chunkIndex];
    }
    if (distributionMode === 'auto_detect') {
      const parts = line.split(';').map((p) => p.trim());
      if (parts[0] === '1') return 'beginner';
      if (parts[0] === '2') return 'easy';
      if (parts[0] === '3') return 'moderate';
      if (parts[0] === '4') return 'hard';
      if (parts[0] === '5') return 'insane';
    }
    return targetCategory;
  };

  // Intercept paste actions to strictly enforce category limit
  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedData = e.clipboardData.getData('text');
    if (!pastedData) return;

    const incomingLines = pastedData
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const questionLines = incomingLines.filter((l) => l.includes(';') && l.split(';').length >= 2);
    if (questionLines.length === 0) return;

    e.preventDefault();

    const currentLines = inputText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const catCountsInText: Record<DifficultyLevel, number> = {
      beginner: 0,
      easy: 0,
      moderate: 0,
      hard: 0,
      insane: 0,
    };

    currentLines.forEach((line, idx) => {
      const parts = line.split(';').map((p) => p.trim());
      if (parts.length >= 2 && Boolean(parts[0]) && Boolean(parts[1])) {
        const cat = resolveLineCategory(line, idx, currentLines.length);
        catCountsInText[cat]++;
      }
    });

    const acceptedLines: string[] = [];
    let excessCount = 0;
    let hitLimitCategory: DifficultyLevel | null = null;

    questionLines.forEach((line, idx) => {
      const cat = resolveLineCategory(line, idx, questionLines.length);
      const totalInCat = retainedExistingCounts[cat] + catCountsInText[cat];
      if (totalInCat < calculatedMaxPerCategory) {
        catCountsInText[cat]++;
        acceptedLines.push(line);
      } else {
        excessCount++;
        hitLimitCategory = cat;
      }
    });

    if (acceptedLines.length > 0) {
      const combined = inputText.trim()
        ? `${inputText.trim()}\n${acceptedLines.join('\n')}`
        : acceptedLines.join('\n');
      setInputText(combined);
    }

    if (excessCount > 0) {
      soundEffects.playWrong();
      const catName = hitLimitCategory ? (CATEGORIES[hitLimitCategory]?.name || hitLimitCategory) : 'This category';
      if (acceptedLines.length === 0) {
        setValidationError(
          `Question Limit Reached: Category "${catName}" can contain a maximum of ${calculatedMaxPerCategory} questions based on the selected ${totalQuestions}-tile game configuration.`
        );
      } else {
        setValidationError(
          `Question Limit Reached: Category "${catName}" can contain a maximum of ${calculatedMaxPerCategory} questions based on the selected ${totalQuestions}-tile game configuration. (Only ${acceptedLines.length} question(s) accepted, ${excessCount} excess question(s) rejected).`
        );
      }
    } else {
      soundEffects.playCoin();
      setValidationError(null);
      setActionNotice(`Pasted ${acceptedLines.length} question(s) successfully.`);
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  // Handle manual textarea input / typing to prevent accepting questions exceeding calculatedMaxPerCategory
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const lines = val.split('\n');

    const catCountsInText: Record<DifficultyLevel, number> = {
      beginner: 0,
      easy: 0,
      moderate: 0,
      hard: 0,
      insane: 0,
    };

    let hasExcess = false;
    let excessCat: DifficultyLevel | null = null;
    const filteredLines: string[] = [];

    const nonBlankCount = lines.filter((l) => l.trim().length > 0).length;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        filteredLines.push(line);
        return;
      }

      const parts = trimmed.split(';').map((p) => p.trim());
      if (parts.length >= 2 && Boolean(parts[0]) && Boolean(parts[1])) {
        const cat = resolveLineCategory(trimmed, idx, nonBlankCount);
        const totalInCat = retainedExistingCounts[cat] + catCountsInText[cat];
        if (totalInCat < calculatedMaxPerCategory) {
          catCountsInText[cat]++;
          filteredLines.push(line);
        } else {
          hasExcess = true;
          excessCat = cat;
        }
      } else {
        filteredLines.push(line);
      }
    });

    if (hasExcess) {
      soundEffects.playWrong();
      const catName = excessCat ? (CATEGORIES[excessCat]?.name || excessCat) : 'This category';
      setValidationError(
        `Question Limit Reached: Category "${catName}" can contain a maximum of ${calculatedMaxPerCategory} questions based on the selected ${totalQuestions}-tile game configuration.`
      );
      setInputText(filteredLines.join('\n'));
    } else {
      setInputText(val);
      setValidationError(null);
    }
  };

  // Helper action: Trim to Allowed Limit (Drops excess lines for categories exceeding capacity)
  const handleTrimToAllowedLimit = () => {
    soundEffects.playTileClick();
    const keptLines: string[] = [];
    const catAdded: Record<DifficultyLevel, number> = {
      beginner: 0,
      easy: 0,
      moderate: 0,
      hard: 0,
      insane: 0,
    };

    parsedRows.forEach((row) => {
      if (!row.isValid) {
        keptLines.push(row.rawLine);
        return;
      }

      const existing = retainedExistingCounts[row.category];
      const maxCanAdd = Math.max(0, calculatedMaxPerCategory - existing);

      if (catAdded[row.category] < maxCanAdd) {
        catAdded[row.category]++;
        keptLines.push(row.rawLine);
      }
    });

    setInputText(keptLines.join('\n'));
    setValidationError(null);
    setActionNotice(`Trimmed questions to fit the allowed capacity (${calculatedMaxPerCategory} max per category).`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Save / Import validation and execution
  const handleImport = async () => {
    setValidationError(null);

    if (validRows.length === 0) {
      setValidationError('No valid questions found to import. Please check your formatted input.');
      soundEffects.playWrong();
      return;
    }

    // Final validation before save: Enforce questionCount <= maximumQuestionsPerCategory for each category
    if (overLimitCategories.length > 0) {
      const first = overLimitCategories[0];
      setValidationError(
        `Category "${first.categoryName}" contains ${first.total} questions (${first.existing > 0 ? `${first.existing} existing + ${first.pasted} new` : `${first.total}`}), but the maximum allowed for this ${totalQuestions}-tile game configuration is ${first.maxAllowed}.`
      );
      soundEffects.playWrong();
      return;
    }

    // Map rows to Question objects, enforcing strict category limits
    const categoryCounts: Record<DifficultyLevel, number> = {
      beginner: 0,
      easy: 0,
      moderate: 0,
      hard: 0,
      insane: 0,
    };

    const newQuestions: Question[] = [];
    validRows.forEach((r, i) => {
      const currentTotal = retainedExistingCounts[r.category] + categoryCounts[r.category];
      if (currentTotal < calculatedMaxPerCategory) {
        categoryCounts[r.category]++;
        newQuestions.push({
          id: `custom-${r.category}-${Date.now().toString(36)}-${i}`,
          category: r.category,
          points: CATEGORIES[r.category]?.points || 6,
          question: r.question,
          answer: r.answer,
          hint: r.hint || undefined,
        });
      }
    });

    setIsImporting(true);
    try {
      const res = await onImportQuestions(newQuestions, importMode, targetCategory);
      setIsImporting(false);
      if (res && typeof res === 'object' && res.success === false) {
        setValidationError(res.error || 'Database insertion failed.');
        soundEffects.playWrong();
        return;
      }
      if (res === false) {
        setValidationError('Database insertion failed. Please try again.');
        soundEffects.playWrong();
        return;
      }
      soundEffects.playCoin();
      onClose();
    } catch (err: any) {
      setIsImporting(false);
      setValidationError(err?.message || 'Failed to insert questions into database.');
      soundEffects.playWrong();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="neo-card-lg bg-white w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-[10px_10px_0px_#000]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b-3 border-black flex items-center justify-between bg-[#ffdf00]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 neo-card bg-black text-white flex items-center justify-center">
              <ClipboardPaste className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-lg sm:text-xl text-black">
                  PASTE / BULK IMPORT QUESTIONS
                </h2>
                <span className="neo-badge bg-white text-black text-[10px] px-2 py-0.5 border border-black font-bold uppercase">
                  {calculatedMaxPerCategory} / Category Max
                </span>
              </div>
              <p className="text-xs font-mono font-bold text-black/80">
                Rule: <code className="bg-black/10 px-1 py-0.5 rounded font-extrabold">{totalQuestions} Tiles ÷ {categoryCount} Categories = {calculatedMaxPerCategory} Max / Category</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="neo-btn-sm bg-white text-black p-2 hover:bg-slate-50"
            title="Close"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 bg-[#faf7ee] flex-1">
          {/* Over-Limit Validation Error Banner (Required Fix) */}
          {hasLimitViolations && (
            <div className="p-4 bg-rose-50 border-3 border-rose-600 rounded-xl shadow-[4px_4px_0px_#e11d48] animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 stroke-[2.5]" />
                  <div>
                    <h4 className="font-heading text-sm text-rose-950 uppercase tracking-wide">
                      Question Limit Reached
                    </h4>
                    <p className="text-xs font-sans font-bold text-rose-900 mt-1 leading-relaxed">
                      Each category can contain a maximum of <strong>{calculatedMaxPerCategory} questions</strong> based on the selected <strong>{totalQuestions}-tile game configuration</strong> ({totalQuestions} ÷ {categoryCount} = {calculatedMaxPerCategory}).
                    </p>
                    <ul className="mt-2 space-y-1 text-xs font-mono font-bold text-rose-800 list-disc list-inside">
                      {overLimitCategories.map((ov) => (
                        <li key={ov.category}>
                          <strong>{ov.categoryName}</strong> contains <strong>{ov.total} questions</strong> ({ov.existing > 0 ? `${ov.existing} existing + ${ov.pasted} new` : `${ov.pasted} pasted`}), exceeding the limit by <strong>{ov.excess}</strong>.
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTrimToAllowedLimit}
                  className="neo-btn-sm bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-heading shrink-0 flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
                  title={`Trim excess questions to fit ${calculatedMaxPerCategory} limit`}
                >
                  <Scissors className="w-3.5 h-3.5 stroke-[2.5]" />
                  TRIM TO LIMIT ({calculatedMaxPerCategory})
                </button>
              </div>
            </div>
          )}

          {/* General Validation Error */}
          {validationError && !hasLimitViolations && (
            <div className="p-3 bg-rose-100 border-2 border-rose-500 rounded-lg text-rose-900 text-xs font-mono font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 stroke-[2.5]" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Action Notice */}
          {actionNotice && (
            <div className="p-3 bg-[#dcfce7] border-2 border-emerald-600 rounded-lg text-emerald-950 text-xs font-mono font-bold flex items-center gap-2 animate-in fade-in duration-150">
              <Check className="w-4 h-4 text-emerald-700 shrink-0 stroke-[3]" />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* Controls: Target Category & Distribution Options */}
          <div className="neo-card bg-white p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Category Assignment Mode */}
              <div>
                <label className="block text-xs font-heading text-black mb-1">
                  CATEGORY ASSIGNMENT:
                </label>
                <select
                  value={distributionMode}
                  onChange={(e) => setDistributionMode(e.target.value as any)}
                  className="w-full neo-input p-2 text-xs font-mono font-bold text-black"
                >
                  <option value="single_category">Assign all to 1 Category</option>
                  <option value="distribute_evenly">Distribute Across 5 Categories</option>
                  <option value="auto_detect">Auto-Detect from Prefix</option>
                </select>
              </div>

              {/* Target Category */}
              <div>
                <label className="block text-xs font-heading text-black mb-1">
                  TARGET CATEGORY:
                </label>
                <select
                  value={targetCategory}
                  disabled={distributionMode === 'distribute_evenly'}
                  onChange={(e) => setTargetCategory(e.target.value as DifficultyLevel)}
                  className="w-full neo-input p-2 text-xs font-mono font-bold text-black disabled:opacity-50"
                >
                  {Object.values(CATEGORIES).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.points} Points)
                    </option>
                  ))}
                </select>
              </div>

              {/* Import Action Mode */}
              <div>
                <label className="block text-xs font-heading text-black mb-1">
                  IMPORT ACTION:
                </label>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as any)}
                  className="w-full neo-input p-2 text-xs font-mono font-bold text-black"
                >
                  <option value="replace_category">Replace questions in this category</option>
                  <option value="append">Add to category without removing (Append)</option>
                  <option value="replace_all">Replace Entire Question Bank</option>
                </select>
              </div>
            </div>

            {/* Dynamic Category Quota & Capacity Breakdown */}
            <div className="pt-3 border-t border-black/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono font-bold text-slate-700 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  Category Capacity Monitor ({calculatedMaxPerCategory} max/category for {totalQuestions} tiles):
                </span>
                {importMode === 'append' && (
                  <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                    APPEND MODE: Considers existing questions
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {CATEGORY_KEYS.map((catKey) => {
                  const cat = CATEGORIES[catKey];
                  const existing = retainedExistingCounts[catKey];
                  const newCount = newCategoryCounts[catKey];
                  const total = existing + newCount;
                  const isOver = total > calculatedMaxPerCategory;
                  const remaining = Math.max(0, calculatedMaxPerCategory - total);

                  return (
                    <div
                      key={catKey}
                      className={`p-2 rounded-lg border-2 border-black flex flex-col justify-between transition-colors ${
                        isOver ? 'bg-rose-100 border-rose-600' : ''
                      }`}
                      style={{ backgroundColor: isOver ? undefined : cat.color }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-heading text-[10px] text-black">
                          {cat.name} ({cat.points}p)
                        </span>
                        {isOver && (
                          <span className="neo-badge bg-rose-600 text-white text-[9px] px-1 py-0.2">
                            +{total - calculatedMaxPerCategory} EXCEEDED
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-baseline justify-between text-[11px] font-mono font-bold">
                        <span className="text-slate-800">
                          Total: <strong className={isOver ? 'text-rose-700 font-extrabold' : 'text-black'}>{total}</strong> / {calculatedMaxPerCategory}
                        </span>
                        {!isOver && (
                          <span className="text-[10px] text-slate-600">
                            ({remaining} left)
                          </span>
                        )}
                      </div>

                      {existing > 0 && importMode === 'append' && (
                        <span className="text-[9px] font-mono text-slate-600 mt-0.5">
                          ({existing} existing + {newCount} new)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Paste Textarea */}
          <div className="neo-card bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="font-heading text-xs text-black flex items-center gap-1.5">
                <FileText className="w-4 h-4 stroke-[2.5]" />
                PASTE QUESTIONS (1 PER LINE • MAX {calculatedMaxPerCategory} FOR {CATEGORIES[targetCategory]?.name}):
              </label>

              <button
                type="button"
                onClick={handleInsertSample}
                className="neo-btn-sm bg-[#ffdf00] hover:bg-[#fde047] text-black px-2.5 py-1 text-[11px] font-mono font-bold border border-black flex items-center gap-1"
                title={`Insert sample questions up to ${calculatedMaxPerCategory} limit`}
              >
                <span>Insert Example</span>
                <span className="bg-black text-white px-1 py-0.2 rounded text-[10px]">
                  Max {calculatedMaxPerCategory}
                </span>
              </button>
            </div>

            <textarea
              rows={6}
              value={inputText}
              onChange={handleInputChange}
              onPaste={handleTextareaPaste}
              placeholder={`question;answer;hint\nWhat is the capital of Italy?;Rome;City of the Colosseum\nWhat is H2O?;Water;Essential for life`}
              className={`w-full neo-input p-3 text-xs sm:text-sm font-mono font-semibold text-black leading-relaxed ${
                hasLimitViolations ? 'border-rose-600 focus:ring-rose-500' : ''
              }`}
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span className="text-slate-600">
                Format: <code className="bg-slate-200 px-1 py-0.5 rounded text-black font-bold">question;answer;optional_hint</code>
              </span>
              <div className="flex items-center gap-2">
                <span className="neo-badge bg-[#86efac] text-black text-[10px] px-2 py-0.5 font-bold">
                  {validRows.length} Valid
                </span>
                {hasLimitViolations && (
                  <span className="neo-badge bg-rose-600 text-white text-[10px] px-2 py-0.5 font-bold">
                    Capacity Exceeded
                  </span>
                )}
                {invalidRows.length > 0 && (
                  <span className="neo-badge bg-[#ff7675] text-black text-[10px] px-2 py-0.5 font-bold">
                    {invalidRows.length} Invalid Format
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Live Parsing Preview */}
          {parsedRows.length > 0 && (
            <div className="neo-card bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-xs text-black">
                  PARSED QUESTIONS PREVIEW ({validRows.length} READY):
                </h3>
                {hasLimitViolations && (
                  <span className="text-xs font-mono font-bold text-rose-600">
                    ⚠️ Rows marked in red exceed category capacity and cannot be accepted
                  </span>
                )}
              </div>

              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {parsedRows.map((row, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 neo-card-sm text-xs font-mono ${
                      !row.isValid
                        ? 'bg-rose-50 border-rose-600'
                        : row.isOverCapacity
                        ? 'bg-rose-50/80 border-rose-500'
                        : 'bg-[#faf7ee]'
                    }`}
                  >
                    {row.isValid ? (
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-0.5 flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-bold">#{row.lineNum}</span>
                            <span
                              className="neo-badge text-black text-[9px] px-1.5 py-0.2 uppercase border border-black font-bold"
                              style={{ backgroundColor: CATEGORIES[row.category]?.color || '#7dd3fc' }}
                            >
                              {row.category} ({CATEGORIES[row.category]?.points}p)
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              Item #{row.categoryIndex} of {calculatedMaxPerCategory}
                            </span>
                            {row.isOverCapacity && (
                              <span className="neo-badge bg-rose-600 text-white text-[9px] px-1.5 py-0.2 font-bold animate-pulse">
                                ⚠️ EXCEEDS LIMIT (Max {calculatedMaxPerCategory})
                              </span>
                            )}
                            <strong className="text-black">{row.question}</strong>
                          </div>
                          <div className="text-emerald-700 pl-6 font-bold">
                            Answer: <strong>{row.answer}</strong>
                          </div>
                          {row.hint && (
                            <div className="text-slate-600 pl-6 text-[11px]">
                              Hint: <em>{row.hint}</em>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-rose-700 font-bold">
                        <AlertCircle className="w-4 h-4 shrink-0 stroke-[2.5]" />
                        <span>Line #{row.lineNum}: {row.error}</span>
                        <code className="bg-rose-100 px-1 py-0.5 text-[10px] text-slate-800 ml-auto">
                          {row.rawLine}
                        </code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t-3 border-black flex items-center justify-between gap-3">
          <div className="text-xs font-mono font-bold text-slate-600">
            {hasLimitViolations ? (
              <span className="text-rose-600">
                ⚠️ Reduce questions to at most {calculatedMaxPerCategory} per category to import
              </span>
            ) : validRows.length > 0 ? (
              <span>
                Ready to import <strong>{validRows.length}</strong> questions (within {calculatedMaxPerCategory} limit)
              </span>
            ) : (
              <span>Paste questions above to preview</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="neo-btn-sm bg-white text-black px-4 py-2 text-xs font-heading"
            >
              CANCEL
            </button>

            <button
              type="button"
              disabled={validRows.length === 0 || hasLimitViolations || isImporting}
              onClick={handleImport}
              className={`neo-btn text-black px-6 py-2.5 text-xs sm:text-sm font-heading flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                hasLimitViolations
                  ? 'bg-rose-300 text-rose-950'
                  : 'bg-[#86efac] hover:bg-[#6ee7b7]'
              }`}
              title={
                hasLimitViolations
                  ? `Limit exceeded: Maximum ${calculatedMaxPerCategory} questions per category`
                  : undefined
              }
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>SAVING TO DATABASE...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {hasLimitViolations
                      ? `LIMIT EXCEEDED (Max ${calculatedMaxPerCategory}/cat)`
                      : `IMPORT & APPLY (${validRows.length})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
