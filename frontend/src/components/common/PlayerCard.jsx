import React from 'react';
import { User, Trophy, Crown, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { TierBadge, getTier } from '@/components/common/TierBadge';

export const PlayerCard = ({
  user,
  isOnline = true,
  country,
  rank,
  title,
  isCurrentUser = false,
  isLeader = false
}) => {
  if (!user) return null;
  const tier = getTier(user.rating ?? 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-xl border p-4 backdrop-blur-sm transition-colors ${
        isCurrentUser 
          ? 'bg-primary/5 border-primary/30' 
          : 'bg-card/40 border-border/50'
      }`}
    >
      <div className="flex items-center gap-4 relative z-10">
        <div className="relative">
          {user.avatar ? (
            <img src={user.avatar} alt={user.username} className="w-12 h-12 rounded-full object-cover border-2 border-white/10" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center">
              <User size={24} className="text-muted-foreground" />
            </div>
          )}
          <span 
            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background ${
              isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-muted-foreground'
            }`} 
          />
        </div>
        
        <div className="flex flex-col flex-1 truncate">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground truncate text-sm">
              {user.username || 'Player'}
            </span>
            <TierBadge rating={user.rating ?? 0} size="sm" showLabel={false} />
            {isLeader && <Crown size={14} className="text-yellow-500 shrink-0" />}
            {title && (
              <span className="text-[10px] uppercase tracking-widest bg-white/10 px-1.5 py-0.5 rounded text-white/70">
                {title}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <div className="flex items-center gap-1">
              <Trophy size={12} className="text-primary/70" />
              <span>{user.rating ?? 0}</span>
              <span className="text-[10px] font-semibold" style={{ color: tier.color }}>
                ({tier.name})
              </span>
            </div>
            {rank && (
              <div className="flex items-center gap-1">
                <span className="font-mono">#{rank}</span>
              </div>
            )}
            {country && (
              <div className="flex items-center gap-1 text-white/50">
                <Globe size={12} />
                <span>{country}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
