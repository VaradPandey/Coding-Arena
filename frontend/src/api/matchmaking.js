import apiClient from './client';

export const matchmakingApi = {
  getStatus: () => apiClient.get('/api/matchmaking/status'),
};

