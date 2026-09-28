export type DifficultyLevel = 'beginner' | 'easy' | 'moderate' | 'hard' | 'insane';

export interface CategoryInfo {
  id: DifficultyLevel;
  name: string;
  points: number;
  color: string;
  textColor: string;
  badgeBg: string;
  borderColor: string;
  glowColor: string;
  description: string;
}

export interface Question {
  id: string;
  category: DifficultyLevel;
  points: number;
  question: string;
  answer: string;
  hint?: string;
  explanation?: string;
}

export type TeamStatus = 'active' | 'waiting' | 'current_turn' | 'completed';

export interface TeamMember {
  id: string;
  name: string;
  score: number;
  pointsEarned?: number;
  avatarSeed?: number;
}

export interface Team {
  id: string;
  name: string;
  accessCode: string;
  color: string;
  colorBg: string;
  members: TeamMember[];
  score: number;
  targetPoints?: number; // Required total points to complete
  maxScore: number; // 20 points per member or target
  wrongAnswersCount: number;
  correctAnswersCount: number;
  stealsWonCount: number;
  passesCount?: number;
  isCompleted?: boolean;
  status?: TeamStatus;
  isJoined: boolean;
  joinedAt?: number;
}

export type GamePhase = 
  | 'landing'      // Game intro & rules
  | 'setup'        // Admin team count & question setup
  | 'lobby'        // Waiting for teams to enter members on phones
  | 'shuffle'      // Shuffling turn order
  | 'tile_board'   // Main board: 75% tiles, 25% leaderboard
  | 'question'     // Question active: 30s timer
  | 'steal'        // Steal phase active: buzzers enabled
  | 'game_over';   // All tiles cleared or max scores reached

export interface StealLock {
  teamId: string;
  teamName: string;
  buzzedAt: number;
  awarded?: boolean;
}

export interface GameState {
  id: string;
  title: string;
  phase: GamePhase;
  teams: Team[];
  turnOrder: string[]; // array of teamIds in turn order
  currentTurnIndex: number;
  selectedTileId: string | null;
  answeredTileIds: string[]; // ids of cleared tiles
  timerSecondsRemaining: number;
  timerDurationSeconds?: number; // Configurable countdown duration in seconds
  totalQuestionsTarget?: number; // Total questions for the board (10 to 80)
  isTimerRunning: boolean;
  questionStartedAt: number | null;
  stealState: {
    isOpen: boolean;
    openedAt: number | null;
    lockedBy: StealLock | null;
    excludedTeamIds?: string[];
  } | null;
  lastAnswerResult?: {
    isCorrect: boolean;
    pointsDelta: number;
    teamId: string;
    memberId?: string;
    message: string;
  } | null;
  currentQuestion?: Question | null;
  hostToken?: string;
  updatedAt: number;
}

export interface ServerMessage {
  type: 
    | 'STATE_UPDATE'
    | 'BUZZ_ACK'
    | 'BUZZ_FAIL'
    | 'TIMER_TICK'
    | 'STEAL_ALERT'
    | 'SOUND_EVENT'
    | 'game_reset'
    | 'ERROR';
  state?: GameState;
  payload?: any;
}
