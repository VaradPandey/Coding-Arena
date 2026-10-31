import { createBrowserRouter } from 'react-router-dom';
import { LandingLayout } from '../layouts/LandingLayout';
import { AppLayout } from '../layouts/AppLayout';
import { ArenaLayout } from '../layouts/ArenaLayout';
import LandingPage from '../pages/LandingPage';
import DesignSystemShowcase from '../pages/DesignSystemShowcase';

import ProblemsPage from '../pages/ProblemsPage';
import ProblemPage from '../pages/ProblemPage';

import ArenaPage from '../pages/ArenaPage';
import ContestPage from '../features/contest/pages/ContestPage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import DashboardPage from '../pages/DashboardPage';
import ProfilePage from '../pages/ProfilePage';
import LeaderboardPage from '../pages/LeaderboardPage';
import SubmissionDetailPage from '../pages/SubmissionDetailPage';
import MatchmakingPage from '../features/matchmaking/pages/MatchmakingPage';
import { PrivateLobbyPage } from '../features/lobby/pages/PrivateLobbyPage';

import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { PublicOnlyRoute } from '../components/auth/PublicOnlyRoute';

// Placeholder Pages
const NotFoundPlaceholder = () => <div>404 Not Found</div>;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingLayout />,
    children: [
      { 
        index: true, 
        element: (
          <PublicOnlyRoute>
            <LandingPage />
          </PublicOnlyRoute>
        ) 
      },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: 'problems', element: <ProblemsPage /> },
      { path: 'problems/:id', element: <ProblemPage /> },
      
      // Public Leaderboard
      { path: 'leaderboard', element: <LeaderboardPage /> },

      // Auth Routes
      { 
        path: 'login', 
        element: (
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        ) 
      },
      { 
        path: 'register', 
        element: (
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        ) 
      },
      
      // Protected User Routes
      { 
        path: 'dashboard', 
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'profile', 
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'submissions/:id', 
        element: (
          <ProtectedRoute>
            <SubmissionDetailPage />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'matchmaking', 
        element: (
          <ProtectedRoute>
            <MatchmakingPage />
          </ProtectedRoute>
        ) 
      },
      {
        path: 'lobby/:lobbyId',
        element: (
          <ProtectedRoute>
            <PrivateLobbyPage />
          </ProtectedRoute>
        )
      },
    ],
  },
  {
    element: <ArenaLayout />,
    children: [
      { 
        path: 'problems/:id/solve', 
        element: (
          <ProtectedRoute>
            <ArenaPage />
          </ProtectedRoute>
        ) 
      },
      {
        path: 'contest/:roomId',
        element: (
          <ProtectedRoute>
            <ContestPage />
          </ProtectedRoute>
        )
      },
    ],
  },
  {
    path: '/design-system',
    element: <DesignSystemShowcase />,
  },
  {
    path: '*',
    element: <NotFoundPlaceholder />,
  },
]);
