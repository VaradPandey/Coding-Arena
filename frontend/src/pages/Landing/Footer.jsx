import React from 'react';
import { Link } from 'react-router-dom';
import { Container, GridLayout, Stack } from '@/components/layout';

export const Footer = () => {
  return (
    <footer className="relative z-10 border-t border-border/20 bg-background/50 pt-16 pb-8">
      <Container>
        <GridLayout cols={4} gap={8} className="mb-12">
          <div className="col-span-1 md:col-span-2">
            <div className="font-bold text-xl tracking-tightest text-foreground mb-4">
              CODING<span className="text-primary">ARENA</span>
            </div>
            <p className="text-muted-foreground text-sm max-w-sm">
              The ultimate multiplayer competitive programming platform. Ranked algorithmic battles for developers.
            </p>
          </div>
          
          <Stack gap={4}>
            <h4 className="font-semibold text-foreground">Platform</h4>
            <Link to="/register" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Play Now
            </Link>
            <Link to="/leaderboard" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Leaderboard
            </Link>
            <a 
              href="#roadmap" 
              onClick={(e) => {
                const el = document.getElementById('roadmap');
                if (el) {
                  e.preventDefault();
                  el.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              Roadmap
            </a>
          </Stack>
          
          <Stack gap={4}>
            <h4 className="font-semibold text-foreground">Community & Code</h4>
            <a 
              href="https://github.com/VaradPandey" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              GitHub
            </a>
          </Stack>
        </GridLayout>
        
        <div className="border-t border-border/20 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Coding Arena. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
};
