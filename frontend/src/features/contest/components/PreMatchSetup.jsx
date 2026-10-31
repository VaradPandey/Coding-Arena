import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Clock, 
  HelpCircle, 
  CheckCircle2, 
  Flame, 
  Code2, 
  Timer, 
  Award,
  Layers,
  ArrowRight,
  ShieldAlert,
  Coins,
  Flag,
  AlertTriangle
} from 'lucide-react';
import { useMatchContext } from '../contexts/MatchContext';
import { useAuth } from '@/contexts/AuthContext';
import { MatchResultModal } from './MatchResultModal';
import { TierBadge } from '@/components/common/TierBadge';

// Animated Coin Component
const CoinDisplay = ({ outcome, isWinner, label }) => {
  const isHeads = outcome === 'HEADS';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div
        initial={{ rotateY: 0, scale: 0.8 }}
        animate={{ rotateY: [0, 1800, 3600], scale: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-black shadow-xl border-2 select-none ${
          isWinner 
            ? 'bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-600 text-amber-950 border-amber-200 shadow-amber-500/30' 
            : 'bg-gradient-to-tr from-neutral-700 via-neutral-500 to-neutral-800 text-neutral-200 border-neutral-400/50 shadow-black/40'
        }`}
      >
        {/* Coin Inner Rim */}
        <div className="absolute inset-1 rounded-full border border-dashed border-black/20 pointer-events-none" />
        
        <div className="text-center font-mono font-black text-xs leading-none">
          <div className="text-base sm:text-lg font-black tracking-tight">{isHeads ? 'H' : 'T'}</div>
          <div className="text-[8px] sm:text-[9px] uppercase tracking-wider">{outcome || 'FLIP'}</div>
        </div>

        {isWinner && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-black animate-pulse" />
        )}
      </motion.div>
      <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">{label}</span>
    </div>
  );
};

export const PreMatchSetup = () => {
  const { user } = useAuth();
  const { 
    room, 
    opponent, 
    setup, 
    chooseSetting, 
    bailOut, 
    status, 
    scores, 
    penalties,
    winnerId, 
    matchResult 
  } = useMatchContext();
  const [showBailModal, setShowBailModal] = useState(false);

  // Guarantee body allows scrolling on mount
  useEffect(() => {
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const flips = setup?.coinFlips || setup?.rolls || {};
  const choices = setup?.choices || {};
  const availableTopics = setup?.availableTopics || [
    { id: 'arrays', label: 'Arrays' },
    { id: 'strings', label: 'Strings' },
    { id: 'dynamic-programming', label: 'Dynamic Programming' },
    { id: 'graphs', label: 'Graphs' },
    { id: 'greedy', label: 'Greedy' },
    { id: 'binary-search', label: 'Binary Search' },
    { id: 'two-pointers', label: 'Two Pointers' },
    { id: 'stack-queue', label: 'Stack & Queue' },
    { id: 'linked-list', label: 'Linked List' },
    { id: 'trees', label: 'Trees' }
  ];
  const availableQuestionCounts = setup?.availableQuestionCounts || [1, 2, 3];
  const availableTimesPerQuestion = setup?.availableTimesPerQuestion || [10, 15, 20, 25, 30];

  const currentUserId = user?.id?.toString();
  const opponentName = opponent?.username || (room?.players && Object.entries(room.players).find(([id]) => id !== currentUserId)?.[1]?.username) || 'Opponent';
  const myName = user?.username || (currentUserId && room?.players?.[currentUserId]?.username) || 'You';

  const myRating = user?.rating ?? (currentUserId && room?.players?.[currentUserId]?.rating) ?? 0;
  const opponentRating = opponent?.rating ?? (room?.players && Object.entries(room.players).find(([id]) => id !== currentUserId)?.[1]?.rating) ?? 0;

  const isTopicDone = Boolean(choices.topic);
  const isCountDone = Boolean(choices.questionCount);
  const isTimeDone = Boolean(choices.timePerQuestion);
  const allDone = isTopicDone && isCountDone && isTimeDone;

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto overflow-x-hidden bg-[#050508] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.12),rgba(255,255,255,0))] text-white flex flex-col items-center select-none z-50">
      
      {/* Sticky Top Bar (Pinned to Viewport) */}
      <div className="sticky top-0 z-40 w-full bg-[#07070c]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Coins className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
            Toss Mode
          </div>
          <span className="text-xs text-neutral-400 hidden sm:inline font-mono">
            Room: {room?.roomId || '1v1'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Prominent Sticky Bail Out Button */}
          <button
            onClick={() => setShowBailModal(true)}
            className="flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 active:bg-red-500/30 text-red-400 border border-red-500/40 text-xs sm:text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/10"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Bail Out</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="w-full max-w-4xl px-4 sm:px-6 py-6 pb-36 flex flex-col items-center">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6 w-full"
        >
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-amber-200 via-white to-amber-500 bg-clip-text text-transparent">
            Coin Toss Match Setup
          </h1>
          <p className="text-neutral-400 text-xs sm:text-sm mt-1.5 max-w-xl mx-auto">
            Three coin flips decide who gets to pick the <span className="text-white font-medium">Topic</span>, <span className="text-white font-medium">Question Count</span>, and <span className="text-white font-medium">Time per Question</span>.
          </p>
        </motion.div>

        {/* Matchup Banner */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-5 flex items-center justify-between gap-2 sm:gap-4 mb-6 shadow-xl"
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-300 text-xs sm:text-base shrink-0">
              {myName[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="truncate">{myName}</span>
                <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold shrink-0">You</span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-neutral-400 font-mono flex items-center gap-1.5 flex-wrap">
                <span>Assigned: <strong className="text-amber-300">HEADS</strong></span>
                <span className="text-neutral-600">•</span>
                <TierBadge rating={myRating} size="sm" showLabel={false} />
                <span className="text-amber-400 font-semibold">{myRating}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center shrink-0">
            <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border border-amber-500/30 flex items-center gap-1 sm:gap-1.5 shadow-sm">
              <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> 3 Flips
            </span>
            <span className="text-[9px] sm:text-[10px] text-neutral-500 mt-0.5 sm:mt-1 font-mono">Ranked 1v1</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-right min-w-0">
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white truncate">{opponentName}</div>
              <div className="text-[10px] sm:text-[11px] text-neutral-400 font-mono flex items-center justify-end gap-1.5 flex-wrap">
                <span className="text-amber-400 font-semibold">{opponentRating}</span>
                <TierBadge rating={opponentRating} size="sm" showLabel={false} />
                <span className="text-neutral-600">•</span>
                <span>Assigned: <strong className="text-neutral-300">TAILS</strong></span>
              </div>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-neutral-600/20 border border-neutral-500/30 flex items-center justify-center font-bold text-neutral-300 text-xs sm:text-base shrink-0">
              {opponentName[0]?.toUpperCase()}
            </div>
          </div>
        </motion.div>

        {/* Three Setting Cards with Coin Flips */}
        <div className="w-full flex flex-col gap-5">
          
          {/* CARD 1: TOPIC */}
          <SettingCard
            title="Problem Topic"
            description="All problems in this contest will be sampled exclusively from the selected category."
            icon={<Code2 className="w-5 h-5 text-indigo-400" />}
            flip={flips.topic}
            currentUserId={currentUserId}
            opponentName={opponentName}
            isChosen={isTopicDone}
            chosenValue={availableTopics.find(t => t.id === choices.topic)?.label || choices.topic}
          >
            {flips.topic?.winnerId === currentUserId ? (
              <div className="mt-4">
                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Coin landed on {flips.topic?.outcome || 'HEADS'}! You won the toss. Select a topic:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {availableTopics.map((topic) => {
                    const isSelected = choices.topic === topic.id;
                    return (
                      <button
                        key={topic.id}
                        onClick={() => chooseSetting('topic', topic.id)}
                        className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all duration-200 flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 scale-105'
                            : 'bg-white/[0.04] text-neutral-300 border-white/5 hover:border-indigo-500/40 hover:bg-white/[0.08]'
                        }`}
                      >
                        <span className="font-semibold">{topic.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <WaitingPlaceholder 
                isChosen={isTopicDone} 
                winnerName={opponentName} 
                chosenText={availableTopics.find(t => t.id === choices.topic)?.label || choices.topic}
                settingLabel="topic"
                outcome={flips.topic?.outcome}
              />
            )}
          </SettingCard>

          {/* CARD 2: QUESTION COUNT */}
          <SettingCard
            title="Total Number of Questions"
            description="Decide how many questions both players must race to solve (1 to 3)."
            icon={<Layers className="w-5 h-5 text-amber-400" />}
            flip={flips.questionCount}
            currentUserId={currentUserId}
            opponentName={opponentName}
            isChosen={isCountDone}
            chosenValue={choices.questionCount ? `${choices.questionCount} ${choices.questionCount === 1 ? 'Problem' : 'Problems'}` : null}
          >
            {flips.questionCount?.winnerId === currentUserId ? (
              <div className="mt-4">
                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Coin landed on {flips.questionCount?.outcome || 'HEADS'}! You won the toss. Select question count:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {availableQuestionCounts.map((count) => {
                    const isSelected = choices.questionCount === count;
                    const labelMap = {
                      1: { name: '1 Question', sub: 'Fast Sprint Duel' },
                      2: { name: '2 Questions', sub: 'Balanced Match' },
                      3: { name: '3 Questions', sub: 'Full Gauntlet' }
                    };
                    return (
                      <button
                        key={count}
                        onClick={() => chooseSetting('questionCount', count)}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center text-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-black border-amber-300 shadow-lg shadow-amber-500/25 scale-[1.02]'
                            : 'bg-white/[0.04] text-neutral-300 border-white/5 hover:border-amber-500/40 hover:bg-white/[0.08]'
                        }`}
                      >
                        <span className={`text-base sm:text-lg font-black ${isSelected ? 'text-black' : 'text-white'}`}>
                          {labelMap[count]?.name || `${count} Questions`}
                        </span>
                        <span className={`text-xs ${isSelected ? 'text-black/80 font-medium' : 'text-neutral-400'}`}>
                          {labelMap[count]?.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <WaitingPlaceholder 
                isChosen={isCountDone} 
                winnerName={opponentName} 
                chosenText={choices.questionCount ? `${choices.questionCount} ${choices.questionCount === 1 ? 'Question' : 'Questions'}` : null}
                settingLabel="question count"
                outcome={flips.questionCount?.outcome}
              />
            )}
          </SettingCard>

          {/* CARD 3: TIME PER QUESTION */}
          <SettingCard
            title="Time Per Question"
            description="Total match time is calculated as (Questions × Time). Choose 10 to 30 minutes."
            icon={<Timer className="w-5 h-5 text-emerald-400" />}
            flip={flips.timePerQuestion}
            currentUserId={currentUserId}
            opponentName={opponentName}
            isChosen={isTimeDone}
            chosenValue={choices.timePerQuestion ? `${choices.timePerQuestion} min / problem` : null}
          >
            {flips.timePerQuestion?.winnerId === currentUserId ? (
              <div className="mt-4">
                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Coin landed on {flips.timePerQuestion?.outcome || 'HEADS'}! You won the toss. Select time per question:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {availableTimesPerQuestion.map((minutes) => {
                    const isSelected = choices.timePerQuestion === minutes;
                    return (
                      <button
                        key={minutes}
                        onClick={() => chooseSetting('timePerQuestion', minutes)}
                        className={`p-3 rounded-xl border text-center transition-all duration-200 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500 text-black border-emerald-300 shadow-lg shadow-emerald-500/25 scale-105'
                            : 'bg-white/[0.04] text-neutral-300 border-white/5 hover:border-emerald-500/40 hover:bg-white/[0.08]'
                        }`}
                      >
                        <span className={`text-sm sm:text-base font-black ${isSelected ? 'text-black' : 'text-white'}`}>
                          {minutes} min
                        </span>
                        <span className={`text-[10px] ${isSelected ? 'text-black/80' : 'text-neutral-400'}`}>
                          per question
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <WaitingPlaceholder 
                isChosen={isTimeDone} 
                winnerName={opponentName} 
                chosenText={choices.timePerQuestion ? `${choices.timePerQuestion} minutes per question` : null}
                settingLabel="time per question"
                outcome={flips.timePerQuestion?.outcome}
              />
            )}
          </SettingCard>

        </div>

        {/* Match Configuration Overview Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full mt-6 bg-[#0c0c14] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="text-neutral-500 text-[10px] sm:text-xs uppercase font-bold tracking-wider">Topic:</span>
              <span className="font-semibold text-white">
                {choices.topic ? availableTopics.find(t => t.id === choices.topic)?.label || choices.topic : <span className="text-neutral-500 italic">Pending...</span>}
              </span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-neutral-500 text-[10px] sm:text-xs uppercase font-bold tracking-wider">Questions:</span>
              <span className="font-semibold text-white">
                {choices.questionCount ? `${choices.questionCount}` : <span className="text-neutral-500 italic">Pending...</span>}
              </span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-neutral-500 text-[10px] sm:text-xs uppercase font-bold tracking-wider">Duration:</span>
              <span className="font-semibold text-white">
                {choices.questionCount && choices.timePerQuestion ? (
                  <span className="text-emerald-400 font-bold">{choices.questionCount * choices.timePerQuestion} mins total</span>
                ) : (
                  <span className="text-neutral-500 italic">Pending...</span>
                )}
              </span>
            </div>
          </div>

          <div>
            {allDone ? (
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm bg-emerald-500/10 px-3.5 py-1.5 rounded-xl border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Settings locked! Arena launching...
              </div>
            ) : (
              <div className="flex items-center gap-2 text-neutral-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Waiting for selections...
              </div>
            )}
          </div>
        </motion.div>

      </div>

      {/* Bail Out Confirmation Modal */}
      <AnimatePresence>
        {showBailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#12121c] border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4 text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Bail Out of Toss?</h3>
              <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
                Conceding during the toss will immediately forfeit the match. Your opponent will be awarded the victory and you will receive a defeat penalty on your rating.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowBailModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold text-neutral-300 transition-colors"
                >
                  Stay in Match
                </button>
                <button
                  onClick={() => {
                    setShowBailModal(false);
                    bailOut();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                >
                  Yes, Bail Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* If match was finished (e.g. either player bailed out), render MatchResultModal directly */}
      {status === 'finished' && (
        <MatchResultModal
          room={room}
          opponent={opponent}
          user={user}
          scores={scores}
          penalties={penalties}
          winnerId={winnerId}
          matchResult={matchResult}
        />
      )}

    </div>
  );
};

// Subcomponent for each Setting Card with Coin Flip
const SettingCard = ({
  title,
  description,
  icon,
  flip,
  currentUserId,
  opponentName,
  isChosen,
  chosenValue,
  children
}) => {
  const isMeWinner = flip?.winnerId === currentUserId;
  const winnerName = isMeWinner ? 'You' : opponentName;
  const outcome = flip?.outcome || (flip?.p1Roll > flip?.p2Roll ? 'HEADS' : 'TAILS');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl border p-4 sm:p-5 transition-all duration-300 backdrop-blur-xl ${
        isChosen 
          ? 'bg-white/[0.02] border-white/10 shadow-lg' 
          : isMeWinner 
            ? 'bg-gradient-to-br from-white/[0.04] to-amber-500/[0.03] border-amber-500/30 shadow-amber-500/5 shadow-xl' 
            : 'bg-white/[0.02] border-white/10'
      }`}
    >
      {/* Top Row: Setting Header & Coin Flip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/5">
        <div className="flex items-start gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-white/[0.05] border border-white/10 mt-0.5">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white">{title}</h3>
              {isChosen && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> Locked: {chosenValue}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">{description}</p>
          </div>
        </div>

        {/* Coin Flip Result Display */}
        {flip && (
          <div className="flex items-center gap-3 bg-black/50 px-3.5 py-2 rounded-2xl border border-white/10 self-start sm:self-center shadow-lg">
            <CoinDisplay outcome={outcome} isWinner={isMeWinner} label={outcome} />

            <div className="pl-2.5 border-l border-white/10">
              <div className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">Toss Winner</div>
              <div className={`text-xs font-black tracking-tight ${isMeWinner ? 'text-amber-400' : 'text-neutral-200'}`}>
                {winnerName} {isMeWinner && '(You)'}
              </div>
              <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                Landed: {outcome}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Content: Choices */}
      {children}
    </motion.div>
  );
};

// Subcomponent for opponent waiting placeholder
const WaitingPlaceholder = ({ isChosen, winnerName, chosenText, settingLabel, outcome }) => {
  if (isChosen) {
    return (
      <div className="mt-3.5 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
        <span className="text-xs text-neutral-300">
          <strong className="text-white">{winnerName}</strong> selected the {settingLabel}:
        </span>
        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
          {chosenText}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
      <div className="w-4 h-4 rounded-full border-2 border-neutral-500 border-t-amber-400 animate-spin" />
      <span className="text-xs text-neutral-400">
        Coin landed on <strong className="text-amber-300">{outcome || 'TAILS'}</strong>. Waiting for <strong className="text-neutral-200">{winnerName}</strong> to select the {settingLabel}...
      </span>
    </div>
  );
};

export default PreMatchSetup;
