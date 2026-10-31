import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Trophy, Swords } from 'lucide-react';
import { useMatchmakingStore } from '../store/useMatchmakingStore';
import { MATCHMAKING_STATES } from '../constants/matchmaking.constants';
import { useAuth } from '@/contexts/AuthContext';
import { TierBadge } from '@/components/common/TierBadge';

export const MatchFoundOverlay = () => {
  const { status, roomId, opponent } = useMatchmakingStore();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isVisible = status === MATCHMAKING_STATES.MATCH_FOUND;

  // Prevent background scrolling while match found overlay is active
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  useEffect(() => {
    if (isVisible && roomId) {
      // Transition to Contest Room after a dramatic pause
      const timeout = setTimeout(() => {
        document.body.style.overflow = '';
        navigate(`/contest/${roomId}`);
      }, 3500);

      return () => {
        clearTimeout(timeout);
        document.body.style.overflow = '';
      };
    }
  }, [isVisible, roomId, navigate]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-2xl overflow-hidden w-screen h-screen m-0 p-4"
          style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {/* Animated Background Glow */}
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 0.2 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent pointer-events-none"
          />

          <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-4xl m-auto">
            <motion.div
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="mb-8 md:mb-12 text-center"
            >
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary via-white to-emerald-400 uppercase text-center drop-shadow-lg">
                Match Found
              </h1>
            </motion.div>

            <div className="flex items-center justify-center gap-6 sm:gap-12 md:gap-24 w-full">
              {/* Current User */}
              <motion.div
                initial={{ x: -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 20 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full border-4 border-primary/50 bg-card/60 flex items-center justify-center shadow-[0_0_35px_rgba(var(--primary-rgb),0.35)]">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-black uppercase text-white">{user?.username?.[0] || 'Y'}</span>
                </div>
                <div className="text-center">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white">{user?.username || 'You'}</h3>
                  <div className="flex items-center gap-1.5 justify-center text-yellow-400 mt-1 mb-2">
                    <Trophy className="w-4 h-4" />
                    <span className="font-semibold text-sm sm:text-base">{user?.rating ?? 0}</span>
                  </div>
                  <TierBadge rating={user?.rating ?? 0} size="sm" showTitle={true} animated={true} />
                </div>
              </motion.div>

              {/* VS Divider */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.5, type: "spring", bounce: 0.5 }}
                className="flex flex-col items-center"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30">
                  <Swords className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <span className="text-base sm:text-lg font-black mt-2 text-muted-foreground uppercase tracking-widest">VS</span>
              </motion.div>

              {/* Opponent */}
              <motion.div
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 20 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full border-4 border-rose-500/50 bg-card/60 flex items-center justify-center shadow-[0_0_35px_rgba(239,68,68,0.35)]">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-black uppercase text-white">{opponent?.username?.[0] || 'O'}</span>
                </div>
                <div className="text-center flex flex-col items-center">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white">{opponent?.username || 'Opponent'}</h3>
                  <div className="flex items-center gap-1.5 justify-center text-yellow-400 mt-1 mb-2">
                    <Trophy className="w-4 h-4" />
                    <span className="font-semibold text-sm sm:text-base">{opponent?.rating ?? 0}</span>
                  </div>
                  <TierBadge rating={opponent?.rating ?? 0} size="sm" showTitle={true} animated={true} />
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-12 md:mt-16 text-neutral-400 text-sm font-medium flex items-center gap-2"
            >
              <div className="w-2.5 h-2.5 bg-primary rounded-full animate-ping" />
              <span>Preparing Contest Arena...</span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default MatchFoundOverlay;
