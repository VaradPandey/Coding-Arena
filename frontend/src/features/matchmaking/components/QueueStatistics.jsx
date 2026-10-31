import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { matchmakingApi } from '@/api/matchmaking';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { BarChart3, Users, Activity, CheckCircle2, Loader2 } from 'lucide-react';

export const QueueStatistics = () => {
  const { data: resp, isLoading } = useQuery({
    queryKey: ['matchmaking', 'status'],
    queryFn: () => matchmakingApi.getStatus(),
    refetchInterval: 5000, // Poll every 5s for live queue status
  });

  const statusData = resp?.data?.data || resp?.data || {};
  const queueLength = statusData.queueLength ?? 0;

  return (
    <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Live Queue Status
          </CardTitle>
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-background/50 border border-border/50 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span>In Queue</span>
            </div>
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary my-1" />
            ) : (
              <p className="text-2xl font-bold font-mono text-foreground">{queueLength}</p>
            )}
            <span className="text-[10px] text-muted-foreground block mt-0.5">Searching for match</span>
          </div>

          <div className="p-3.5 rounded-xl bg-background/50 border border-border/50 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1 uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Matching Mode</span>
            </div>
            <p className="text-sm font-bold text-foreground mt-1.5">FIFO Order</p>
            <span className="text-[10px] text-muted-foreground block mt-0.5">First-come pairing</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
