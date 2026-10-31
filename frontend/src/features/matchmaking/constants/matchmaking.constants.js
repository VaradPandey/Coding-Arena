export const MATCHMAKING_STATES = {
  IDLE: 'idle',
  JOINING: 'joining',
  QUEUED: 'queued',
  MATCHING: 'matching',
  MATCH_FOUND: 'match_found',
  ACCEPTED: 'accepted',
  CANCELLED: 'cancelled',
  ERROR: 'error',
};

export const GAME_MODES = [
  {
    id: 'ranked',
    title: 'Ranked Battle',
    description: 'Compete for rating points and climb the global leaderboard.',
    estimatedDuration: '5-15 mins',
    status: 'Available',
    icon: 'Trophy'
  },
  {
    id: 'toss',
    title: 'Toss Mode',
    description: 'Select your preferred algorithm categories before the match.',
    estimatedDuration: '5-20 mins',
    status: 'Available',
    icon: 'Swords'
  },
  {
    id: 'challenge',
    title: 'Challenge Friend',
    description: 'Invite a friend for a private 1v1 showdown.',
    estimatedDuration: 'Custom',
    status: 'Available',
    icon: 'Users'
  }
];

export const TIMELINE_STAGES = [
  { id: 'join', label: 'Join Queue', description: 'Enter matchmaking pool' },
  { id: 'search', label: 'Searching', description: 'Finding an opponent in queue' },
  { id: 'found', label: 'Opponent Found', description: 'Establishing connection' },
  { id: 'prepare', label: 'Preparing Room', description: 'Generating problem set' },
  { id: 'start', label: 'Contest Begins', description: 'Good luck!' }
];

export const MATCHMAKING_RULES = [
  { 
    title: 'Matchmaking Order (FIFO)', 
    description: 'Players are matched in first-in, first-out (FIFO) order with the first available opponent in the queue. Rating-based / Elo matchmaking brackets are planned for a future update.' 
  },
  { 
    title: 'Hidden Test Cases', 
    description: 'Code must pass all hidden edge cases to achieve an Accepted verdict.' 
  },
  { 
    title: 'Time Penalties', 
    description: 'Incorrect submissions will incur a time penalty on your final score.' 
  },
  { 
    title: 'Competitive Scoring', 
    description: 'The first to solve all problems, or the highest score when time expires, wins.' 
  }
];

export const FUTURE_FEATURES = [
  { title: 'Team Battles', description: '2v2 and 3v3 algorithmic showdowns.' },
  { title: 'Season Rewards', description: 'Exclusive profile badges and titles for top players.' },
  { title: 'Global Leaderboards', description: 'See how you rank worldwide.' },
  { title: 'Tournament Mode', description: 'Join weekly bracket-style tournaments.' },
  { title: 'Spectator Mode', description: 'Watch high-elo matches in real-time.' }
];
