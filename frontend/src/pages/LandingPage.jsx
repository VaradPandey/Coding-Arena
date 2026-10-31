import React from 'react';
import { PageWrapper } from '@/components/layout';
import { Navbar } from '@/components/common/Navbar';
import {
  HeroSection,
  MatchTimeline,
  HowItWorks,
  GameModes,
  WhyCodingArena,
  RoadmapTeaser,
  FinalCTA,
  Footer
} from './Landing';

const LandingPage = () => {
  return (
    <PageWrapper withBackground={true}>
      <Navbar />
      <HeroSection />
      <MatchTimeline />
      <HowItWorks />
      <GameModes />
      <WhyCodingArena />
      <RoadmapTeaser />
      <FinalCTA />
      <Footer />
    </PageWrapper>
  );
};

export default LandingPage;
