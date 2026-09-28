import { CategoryInfo, DifficultyLevel, Question } from '../types/game';

export const CATEGORIES: Record<DifficultyLevel, CategoryInfo> = {
  beginner: {
    id: 'beginner',
    name: 'BEGINNER',
    points: 2,
    color: '#86efac', // Neobrutalist Mint
    textColor: '#000000',
    badgeBg: 'bg-[#86efac] text-black border-2 border-black shadow-[2px_2px_0px_#000]',
    borderColor: 'border-black',
    glowColor: 'shadow-[3px_3px_0px_#000]',
    description: 'Level 1: 2 Points per tile. Warmup fundamentals.'
  },
  easy: {
    id: 'easy',
    name: 'EASY',
    points: 4,
    color: '#7dd3fc', // Neobrutalist Sky Blue
    textColor: '#000000',
    badgeBg: 'bg-[#7dd3fc] text-black border-2 border-black shadow-[2px_2px_0px_#000]',
    borderColor: 'border-black',
    glowColor: 'shadow-[3px_3px_0px_#000]',
    description: 'Level 2: 4 Points per tile. General trivia & light topics.'
  },
  moderate: {
    id: 'moderate',
    name: 'MODERATE',
    points: 6,
    color: '#fde047', // Neobrutalist Sunshine Yellow
    textColor: '#000000',
    badgeBg: 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]',
    borderColor: 'border-black',
    glowColor: 'shadow-[3px_3px_0px_#000]',
    description: 'Level 3: 6 Points per tile. Science, tech & culture.'
  },
  hard: {
    id: 'hard',
    name: 'HARD',
    points: 8,
    color: '#fb923c', // Neobrutalist Tangerine Orange
    textColor: '#000000',
    badgeBg: 'bg-[#fb923c] text-black border-2 border-black shadow-[2px_2px_0px_#000]',
    borderColor: 'border-black',
    glowColor: 'shadow-[3px_3px_0px_#000]',
    description: 'Level 4: 8 Points per tile. Deep knowledge & challenges.'
  },
  insane: {
    id: 'insane',
    name: 'INSANE',
    points: 10,
    color: '#f472b6', // Neobrutalist Pastel Magenta Pink
    textColor: '#000000',
    badgeBg: 'bg-[#f472b6] text-black border-2 border-black shadow-[2px_2px_0px_#000]',
    borderColor: 'border-black',
    glowColor: 'shadow-[3px_3px_0px_#000]',
    description: 'Level 5: 10 Points per tile. Mastermind-grade trivia.'
  }
};

// Initial questions are empty per user request - user pastes their own questions!
export const DEFAULT_QUESTIONS: Question[] = [];
