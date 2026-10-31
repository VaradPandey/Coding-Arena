import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '@/api/users';
import { PageWrapper, Container } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { TierBadge, TIERS, getTier } from '@/components/common/TierBadge';
import { 
  Trophy, 
  Medal, 
  Crown, 
  Swords, 
  Search, 
  Target, 
  Award, 
  ChevronLeft, 
  ChevronRight, 
  Loader2,
  Users,
  ShieldAlert,
  Flame,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeSlideUp } from '@/lib/motion';

const PAGE_SIZE = 50;

export default function LeaderboardPage() {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: resp, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['leaderboard', page],
    queryFn: () => userApi.getLeaderboard(PAGE_SIZE, page * PAGE_SIZE),
    keepPreviousData: true,
  });

  const leaderboardData = resp?.data?.data || resp?.data || {};
  const players = Array.isArray(leaderboardData) 
    ? leaderboardData 
    : (leaderboardData.leaderboard || []);
  const totalUsers = leaderboardData.totalUsers ?? players.length;
  const totalPages = Math.ceil(totalUsers / PAGE_SIZE) || 1;

  const filteredPlayers = searchQuery.trim()
    ? players.filter(p => 
        p.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : players;

  return (
    <PageWrapper>
      <Container className="py-8 max-w-5xl space-y-8">
        
        {/* Header Hero */}
        <motion.div {...fadeSlideUp} className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
            <Trophy className="w-3.5 h-3.5" />
            Official Rankings
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Global <span className="text-primary">Leaderboard</span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto">
            Live Elo standings derived from 1v1 algorithmic matches. Climb the tiers from Novice to Grandmaster Guardian.
          </p>
        </motion.div>

        {/* Tier Classification Documentation Banner */}
        <motion.div {...fadeSlideUp}>
          <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  Arena Tier Classification System
                </CardTitle>
                <span className="text-xs text-muted-foreground font-mono">
                  {totalUsers} Registered Combatants
                </span>
              </div>
              <CardDescription className="text-xs">
                Ranks and titles are assigned deterministically according to your rating range:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {TIERS.map((tier) => (
                  <div
                    key={tier.id}
                    className={`p-2.5 rounded-xl border text-center transition-all ${tier.bg} ${tier.border}`}
                  >
                    <span className="text-xs uppercase font-extrabold block" style={{ color: tier.color }}>
                      {tier.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-medium block">
                      {tier.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono block mt-1">
                      {tier.min} - {tier.max === 3000 ? '2100+' : tier.max} Elo
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Search & Actions Bar */}
        <motion.div {...fadeSlideUp} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50 border-border/60"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Showing Page {page + 1} of {Math.max(1, totalPages)}</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isLoading}
                className="h-8 w-8 p-0"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isLoading}
                className="h-8 w-8 p-0"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Leaderboard Table / Rows */}
        <motion.div {...fadeSlideUp} className="space-y-3">
          {isLoading ? (
            <Card className="border-border/50 bg-card/40 p-12 text-center">
              <div className="flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Loading arena combatants...</p>
              </div>
            </Card>
          ) : isError ? (
            <Card className="border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
              <ShieldAlert className="w-8 h-8 text-destructive mx-auto" />
              <p className="text-sm font-semibold text-destructive">Failed to load leaderboard data</p>
              <p className="text-xs text-muted-foreground">{error?.message || 'Please check your connection and try again.'}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                Retry
              </Button>
            </Card>
          ) : filteredPlayers.length === 0 ? (
            <Card className="border-border/50 bg-card/40 p-12 text-center space-y-2">
              <Users className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-base font-semibold text-foreground">No players found</p>
              <p className="text-xs text-muted-foreground">
                {searchQuery ? `No players match "${searchQuery}"` : 'Be the first to queue up and claim rank #1!'}
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {filteredPlayers.map((player) => {
                const tier = getTier(player.rating);
                const isTop1 = player.rank === 1;
                const isTop2 = player.rank === 2;
                const isTop3 = player.rank === 3;
                const totalMatches = (player.wins || 0) + (player.losses || 0) + (player.draws || 0);
                const winRate = totalMatches > 0 ? Math.round(((player.wins || 0) / totalMatches) * 100) : 0;

                return (
                  <Card
                    key={player.id}
                    className={`border transition-all duration-200 overflow-hidden ${
                      isTop1
                        ? 'border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 via-card/50 to-card/30 shadow-[0_0_25px_rgba(234,179,8,0.15)]'
                        : isTop2
                        ? 'border-slate-400/30 bg-gradient-to-r from-slate-400/10 via-card/50 to-card/30'
                        : isTop3
                        ? 'border-amber-600/30 bg-gradient-to-r from-amber-600/10 via-card/50 to-card/30'
                        : 'border-border/40 bg-card/30 hover:border-border/80 hover:bg-card/50'
                    }`}
                  >
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      {/* Left: Rank & Player info */}
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Rank Badge */}
                        <div className="w-10 sm:w-12 flex items-center justify-center shrink-0">
                          {isTop1 ? (
                            <div className="w-9 h-9 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 flex items-center justify-center font-black text-sm shadow-sm">
                              <Crown className="w-4 h-4" />
                            </div>
                          ) : isTop2 ? (
                            <div className="w-9 h-9 rounded-xl bg-slate-400/20 text-slate-300 border border-slate-400/40 flex items-center justify-center font-black text-sm">
                              <Medal className="w-4 h-4" />
                            </div>
                          ) : isTop3 ? (
                            <div className="w-9 h-9 rounded-xl bg-amber-600/20 text-amber-500 border border-amber-600/40 flex items-center justify-center font-black text-sm">
                              <Award className="w-4 h-4" />
                            </div>
                          ) : (
                            <span className="font-mono text-sm font-bold text-muted-foreground">
                              #{player.rank}
                            </span>
                          )}
                        </div>

                        {/* Avatar */}
                        <div className="relative shrink-0">
                          {player.avatar ? (
                            <img
                              src={player.avatar}
                              alt={player.displayName || player.username}
                              className="w-10 h-10 rounded-full object-cover border border-white/10"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-sm">
                              {(player.displayName || player.username || '?')[0].toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* Name & Subtitle */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm sm:text-base text-foreground truncate">
                              {player.displayName || player.username}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              @{player.username}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                            <span className="inline-flex items-center gap-1 font-semibold" style={{ color: tier.color }}>
                              {tier.name} · {tier.title}
                            </span>
                            <span>•</span>
                            <span>{player.problemsSolved || 0} Solved</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Stats & Rating */}
                      <div className="flex items-center justify-between sm:justify-end gap-5 pl-14 sm:pl-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/30">
                        
                        {/* Win / Draw / Loss Record */}
                        <div className="text-right">
                          <div className="text-xs font-mono space-x-1.5">
                            <span className="text-emerald-400 font-bold">{player.wins}W</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-yellow-400 font-bold">{player.draws}D</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-rose-400 font-bold">{player.losses}L</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            {winRate}% Win Rate ({totalMatches} matches)
                          </span>
                        </div>

                        {/* Rating & Tier Badge */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-lg sm:text-xl font-extrabold font-mono text-foreground block leading-tight">
                              {player.rating}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider block">
                              Elo Rating
                            </span>
                          </div>

                          <TierBadge rating={player.rating} size="sm" showLabel={false} />
                        </div>

                      </div>

                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </motion.div>

      </Container>
    </PageWrapper>
  );
}

