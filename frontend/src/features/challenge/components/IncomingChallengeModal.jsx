import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Check, X, ShieldAlert, Zap } from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@/socket/events';
import { TierBadge } from '@/components/common/TierBadge';

// Gentle pleasant sound synthesizer for incoming challenge
const playChimeSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.15); // G5
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    // Audio might be blocked if user hasn't interacted with page yet
  }
};

export const IncomingChallengeModal = () => {
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  const timerRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleChallengeReceived = (data) => {
      setChallenge(data);
      playChimeSound();
    };

    const handleChallengeCancelled = (data) => {
      if (challenge?.challengeId === data.challengeId) {
        setChallenge(null);
      }
    };

    const handleChallengeAccepted = (data) => {
      setChallenge(null);
      if (data?.lobbyId) {
        navigate(`/lobby/${encodeURIComponent(data.lobbyId)}`);
      }
    };

    socket.on(SERVER_EVENTS.CHALLENGE_INVITE_RECEIVED, handleChallengeReceived);
    socket.on(SERVER_EVENTS.CHALLENGE_CANCELLED, handleChallengeCancelled);
    socket.on(SERVER_EVENTS.CHALLENGE_ACCEPTED, handleChallengeAccepted);

    return () => {
      socket.off(SERVER_EVENTS.CHALLENGE_INVITE_RECEIVED, handleChallengeReceived);
      socket.off(SERVER_EVENTS.CHALLENGE_CANCELLED, handleChallengeCancelled);
      socket.off(SERVER_EVENTS.CHALLENGE_ACCEPTED, handleChallengeAccepted);
    };
  }, [socket, challenge, navigate]);

  // Countdown timer for incoming challenge
  useEffect(() => {
    if (!challenge) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((challenge.expiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        setChallenge(null);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [challenge]);

  const handleRespond = (action) => {
    if (!socket || !challenge) return;
    socket.emit(CLIENT_EVENTS.RESPOND_CHALLENGE, {
      challengeId: challenge.challengeId,
      action
    });
    setChallenge(null);
  };

  if (!challenge || typeof document === 'undefined') return null;

  const { challenger } = challenge;
  const progressPercent = (secondsRemaining / 30) * 100;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/40 bg-neutral-950/95 shadow-[0_0_50px_rgba(59,130,246,0.3)] p-6 text-foreground"
        >
          {/* Glowing Top Ambient Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-indigo-500 to-primary animate-pulse" />

          {/* Radial Countdown Indicator */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              <Swords size={14} className="animate-bounce" />
              <span>Incoming 1v1 Challenge</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              <Zap size={12} />
              <span>{secondsRemaining}s</span>
            </div>
          </div>

          {/* Challenger Profile Card */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/10 mb-6">
            <div className="relative">
              {challenger?.avatar ? (
                <img
                  src={challenger.avatar}
                  alt={challenger.username}
                  className="w-14 h-14 rounded-full border-2 border-primary/40 object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-primary font-bold text-xl">
                  {challenger?.username?.[0]?.toUpperCase() || 'P'}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-neutral-950" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white truncate">
                  {challenger?.username}
                </h3>
                <TierBadge rating={challenger?.rating ?? 0} size="sm" />
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Rating: <span className="font-semibold text-neutral-200">{challenger?.rating ?? 0}</span>
              </p>
              <p className="text-[11px] text-primary/80 mt-1 font-medium">
                Wants to challenge you to a private match!
              </p>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-6">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-400 via-primary to-amber-400"
              style={{ width: `${progressPercent}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleRespond('DECLINE')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white font-semibold text-xs transition-all"
            >
              <X size={15} />
              <span>Decline</span>
            </button>

            <button
              onClick={() => handleRespond('ACCEPT')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/50 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-white font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02]"
            >
              <Check size={16} className="text-emerald-400" />
              <span>Accept Showdown</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
