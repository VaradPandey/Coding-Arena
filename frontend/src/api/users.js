import apiClient from './client';

export const userApi = {
  getMe: () => apiClient.get('/api/users/me'),
  updateProfile: (data) => apiClient.patch('/api/users/me', data),
  getMyRank: () => apiClient.get('/api/users/me/rank'),
  getLeaderboard: (limit = 50, offset = 0) => apiClient.get(`/api/users/leaderboard?limit=${limit}&offset=${offset}`),
  getMySubmissions: (limit = 10, offset = 0) => apiClient.get(`/api/users/me/submissions?limit=${limit}&offset=${offset}`),
  getMySolvedProblems: () => apiClient.get('/api/users/me/solved'),
  getMyMatches: (limit = 10) => apiClient.get(`/api/users/me/matches?limit=${limit}`),
};
