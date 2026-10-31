import React, { useState } from 'react';
import { PageWrapper, Container, Section, GridLayout } from '@/components/layout';
import { GridOverlay } from '@/components/ui/Backgrounds';
import { useMatchmakingStore } from '../store/useMatchmakingStore';
import { useMatchmakingSocket } from '../hooks/useMatchmakingSocket';
import { GAME_MODES, MATCHMAKING_STATES } from '../constants/matchmaking.constants';

// Components
import { MatchmakingHero } from '../components/MatchmakingHero';
import { QueueCard } from '../components/QueueCard';
import { QueueTimeline } from '../components/QueueTimeline';
import { QueueStatistics } from '../components/QueueStatistics';
import { GameModeCard } from '../components/GameModeCard';
import { MatchmakingRules } from '../components/MatchmakingRules';
import { RecentMatchesCard } from '../components/RecentMatchesCard';
import { FutureFeaturesGrid } from '../components/FutureFeaturesGrid';
import { MatchFoundOverlay } from '../components/MatchFoundOverlay';

import { FriendsDrawer } from '@/features/friends/components/FriendsDrawer';

const MatchmakingPage = () => {
  const { status, elapsedTime, estimatedTime, error } = useMatchmakingStore();
  const { findMatch, cancelSearch } = useMatchmakingSocket();
  
  const [selectedMode, setSelectedMode] = useState('ranked');
  const [friendsDrawerOpen, setFriendsDrawerOpen] = useState(false);

  // Prevent modifying mode while queued/searching
  const isLocked = status !== MATCHMAKING_STATES.IDLE && status !== MATCHMAKING_STATES.CANCELLED;

  const handleStartQueueOrChallenge = () => {
    if (selectedMode === 'challenge') {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {}
      setFriendsDrawerOpen(true);
      return;
    }
    findMatch(selectedMode);
  };

  return (
    <PageWrapper>
      <MatchFoundOverlay />
      <FriendsDrawer isOpen={friendsDrawerOpen} onClose={() => setFriendsDrawerOpen(false)} />
      <div className="fixed inset-0 z-0 pointer-events-none">
        <GridOverlay />
      </div>
      <Container className="py-8 relative z-10">
        
        {/* Header & Hero */}
        <Section>
          <MatchmakingHero />
        </Section>

        {/* Core Queue Area */}
        <Section>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Col: Timeline, Live Statistics & Rules */}
            <div className="space-y-6">
              <QueueTimeline status={status} />
              <QueueStatistics />
              <MatchmakingRules />
            </div>

            {/* Center Col: Queue Card */}
            <div className="lg:col-span-2">
              <QueueCard 
                status={status} 
                elapsedTime={elapsedTime} 
                estimatedTime={estimatedTime}
                onFindMatch={handleStartQueueOrChallenge}
                onCancel={cancelSearch}
              />
              
              {/* Game Modes */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4 text-foreground/80">Select Game Mode</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {GAME_MODES.map((mode) => (
                    <GameModeCard 
                      key={mode.id} 
                      mode={mode} 
                      isSelected={selectedMode === mode.id}
                      onClick={() => {
                        if (!isLocked) {
                          setSelectedMode(mode.id);
                          if (mode.id === 'challenge') {
                            try {
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            } catch (e) {}
                            setFriendsDrawerOpen(true);
                          }
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Match History */}
        <Section className="mt-12">
          <RecentMatchesCard />
        </Section>

        {/* Future Features */}
        <Section className="mt-12 border-t border-border/50 pt-12">
          <FutureFeaturesGrid />
        </Section>

      </Container>
    </PageWrapper>
  );
};

export default MatchmakingPage;
