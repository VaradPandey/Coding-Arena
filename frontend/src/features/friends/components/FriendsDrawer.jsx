import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  Search, 
  Swords, 
  Check, 
  X, 
  Clock, 
  Trash2, 
  Loader2, 
  Zap,
  Sparkles,
  Wifi,
  ShieldCheck
} from 'lucide-react';
import { friendsApi } from '@/api/friends';
import { useSocket } from '@/contexts/SocketContext';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@/socket/events';
import { TierBadge } from '@/components/common/TierBadge';
import { OutgoingChallengeModal } from '@/features/challenge/components/OutgoingChallengeModal';

export const FriendsDrawer = ({ isOpen, onClose }) => {
  const { socket } = useSocket();

  const [activeTab, setActiveTab] = useState('online'); // 'online' | 'all' | 'requests' | 'search'
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [isLoading, setIsLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Outgoing challenge
  const [outgoingChallenge, setOutgoingChallenge] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchFriends = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await friendsApi.getFriends();
      const list = Array.isArray(res) ? res : (res?.friends || res?.data || []);
      setFriends(list);
    } catch (err) {
      console.error('Failed to load friends:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await friendsApi.getRequests();
      setRequests({
        incoming: res?.incoming || [],
        outgoing: res?.outgoing || []
      });
    } catch (err) {
      console.error('Failed to load friend requests:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        // ignore if window not available
      }
      fetchFriends();
      fetchRequests();

      // Poll every 6 seconds while the drawer is open to guarantee fresh presence
      const pollTimer = setInterval(() => {
        fetchFriends();
        fetchRequests();
      }, 6000);

      return () => clearInterval(pollTimer);
    }
  }, [isOpen, fetchFriends, fetchRequests]);

  // Listen for real-time presence updates from friends
  useEffect(() => {
    if (!socket) return;

    const handlePresenceUpdated = ({ userId, presence }) => {
      setFriends(prev => prev.map(f => (f.id === userId ? { ...f, presence } : f)));
    };

    socket.on(SERVER_EVENTS.FRIEND_PRESENCE_UPDATED, handlePresenceUpdated);

    return () => {
      socket.off(SERVER_EVENTS.FRIEND_PRESENCE_UPDATED, handlePresenceUpdated);
    };
  }, [socket]);

  // Debounced user search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await friendsApi.searchUsers(searchQuery.trim());
        const users = Array.isArray(res) ? res : (res?.users || res?.data || []);
        setSearchResults(users);
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Listen for socket confirmation of sent challenge
  useEffect(() => {
    if (!socket) return;

    const handleChallengeSent = (data) => {
      const targetFriend = friends.find(f => f.id === data.targetUserId);
      setOutgoingChallenge({
        challengeId: data.challengeId,
        targetName: targetFriend?.username || 'Player',
        expiresAt: data.expiresAt
      });
    };

    socket.on(SERVER_EVENTS.CHALLENGE_INVITE_SENT, handleChallengeSent);

    return () => {
      socket.off(SERVER_EVENTS.CHALLENGE_INVITE_SENT, handleChallengeSent);
    };
  }, [socket, friends]);

  const showToast = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleChallenge = (friend) => {
    if (!socket) {
      showToast('Socket not connected');
      return;
    }
    socket.emit(CLIENT_EVENTS.SEND_CHALLENGE, {
      targetUserId: friend.id
    });
  };

  const handleSendFriendRequest = async (targetUsername) => {
    try {
      const res = await friendsApi.sendRequest(targetUsername);
      showToast(res.message || 'Friend request sent!');
      fetchRequests();
      // Update search result status locally
      setSearchResults(prev => prev.map(u => 
        u.username === targetUsername ? { ...u, relationship: 'REQUEST_SENT' } : u
      ));
    } catch (err) {
      showToast(err.message || 'Failed to send request');
    }
  };

  const handleRespondRequest = async (requestId, action) => {
    try {
      await friendsApi.respondToRequest(requestId, action);
      showToast(action === 'ACCEPT' ? 'Friend request accepted!' : 'Request declined');
      fetchRequests();
      fetchFriends();
    } catch (err) {
      showToast(err.message || 'Failed to respond');
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    try {
      await friendsApi.removeFriend(friendId);
      showToast('Friend removed');
      fetchFriends();
    } catch (err) {
      showToast(err.message || 'Failed to remove friend');
    }
  };

  const onlineFriends = friends.filter(f => f.presence?.isOnline);
  const pendingCount = requests.incoming.length;

  return (
    <>
      {outgoingChallenge && (
        <OutgoingChallengeModal
          challenge={outgoingChallenge}
          onClose={() => setOutgoingChallenge(null)}
        />
      )}

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[90] overflow-hidden">
              {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Slide-in Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute top-0 right-0 bottom-0 w-full max-w-md bg-[#0a0a0f] border-l border-white/10 shadow-2xl flex flex-col z-50 text-foreground"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-neutral-950/60 backdrop-blur shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                    <Users size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white leading-tight">Friends & 1v1</h2>
                    <p className="text-[11px] text-neutral-400">
                      {onlineFriends.length} online now
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Toast message notification */}
              {actionMessage && (
                <div className="bg-primary/20 border-b border-primary/30 px-6 py-2 text-xs font-semibold text-primary flex items-center justify-between">
                  <span>{actionMessage}</span>
                  <button onClick={() => setActionMessage(null)}>
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Tab Navigation */}
              <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5 bg-neutral-950/40 shrink-0 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('online')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'online'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  <span>Online ({onlineFriends.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('all')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'all'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span>All ({friends.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('search')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'search'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <UserPlus size={13} />
                  <span>Find</span>
                </button>

                <button
                  onClick={() => setActiveTab('requests')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all relative ${
                    activeTab === 'requests'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span>Requests</span>
                  {pendingCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary text-white font-bold animate-pulse">
                      {pendingCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                {/* 1. ONLINE TAB */}
                {activeTab === 'online' && (
                  <div>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-20 text-neutral-400 gap-2">
                        <Loader2 size={20} className="animate-spin text-primary" />
                        <span className="text-xs">Loading friends...</span>
                      </div>
                    ) : onlineFriends.length === 0 ? (
                      <div className="text-center py-16 px-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-neutral-500 mb-3">
                          <Users size={24} />
                        </div>
                        <h4 className="text-sm font-semibold text-white">No Friends Online</h4>
                        <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
                          None of your friends are currently active. You can add more friends or challenge by username!
                        </p>
                        <button
                          onClick={() => setActiveTab('search')}
                          className="mt-4 px-4 py-2 rounded-xl bg-primary/20 text-primary border border-primary/30 text-xs font-semibold hover:bg-primary/30 transition-all"
                        >
                          Find Players
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {onlineFriends.map(friend => {
                          const isBusy = friend.presence?.status === 'in_match' || friend.presence?.status === 'in_lobby';
                          const statusLabel = friend.presence?.status === 'in_match' ? 'In Match' : friend.presence?.status === 'in_lobby' ? 'In Lobby' : 'Ready';

                          return (
                            <div
                              key={friend.id}
                              className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative">
                                  {friend.avatar ? (
                                    <img src={friend.avatar} alt={friend.username} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-sm">
                                      {friend.username[0]?.toUpperCase()}
                                    </div>
                                  )}
                                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a0f] ${
                                    isBusy ? 'bg-amber-400' : 'bg-emerald-400'
                                  }`} />
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-white truncate">{friend.username}</span>
                                    <TierBadge rating={friend.rating ?? 0} size="sm" />
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                                    <span className={isBusy ? 'text-amber-400' : 'text-emerald-400 font-medium'}>
                                      {statusLabel}
                                    </span>
                                    <span>•</span>
                                    <span>{friend.rating ?? 0} ELO</span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => handleChallenge(friend)}
                                disabled={isBusy}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md ${
                                  isBusy
                                    ? 'bg-white/5 text-neutral-500 cursor-not-allowed border border-white/5'
                                    : 'bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 hover:border-primary/60 hover:scale-105 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                                }`}
                              >
                                <Swords size={13} />
                                <span>Challenge</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. ALL FRIENDS TAB */}
                {activeTab === 'all' && (
                  <div className="space-y-2.5">
                    {friends.length === 0 ? (
                      <div className="text-center py-16 text-neutral-400 text-xs">
                        You have not added any friends yet.
                      </div>
                    ) : (
                      friends.map(friend => (
                        <div
                          key={friend.id}
                          className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative">
                              {friend.avatar ? (
                                <img src={friend.avatar} alt={friend.username} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-white/5 text-white border border-white/10 flex items-center justify-center font-bold text-sm">
                                  {friend.username[0]?.toUpperCase()}
                                </div>
                              )}
                              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a0f] ${
                                friend.presence?.isOnline ? 'bg-emerald-400' : 'bg-neutral-600'
                              }`} />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white truncate">{friend.username}</span>
                                <TierBadge rating={friend.rating ?? 0} size="sm" />
                              </div>
                              <div className="text-[11px] text-neutral-400">
                                {friend.presence?.isOnline ? (
                                  <span className="text-emerald-400 font-medium">Online</span>
                                ) : (
                                  <span>Offline</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {friend.presence?.isOnline && (
                              <button
                                onClick={() => handleChallenge(friend)}
                                className="p-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 transition-all"
                                title="Challenge to 1v1"
                              >
                                <Swords size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveFriend(friend.id)}
                              className="p-2 rounded-lg hover:bg-rose-500/10 text-neutral-500 hover:text-rose-400 transition-colors"
                              title="Remove Friend"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 3. SEARCH & ADD TAB */}
                {activeTab === 'search' && (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Search player by username..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-primary/50 transition-all font-medium"
                      />
                    </div>

                    {isSearching ? (
                      <div className="flex items-center justify-center py-10 text-neutral-400 gap-2">
                        <Loader2 size={16} className="animate-spin text-primary" />
                        <span className="text-xs">Searching players...</span>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="space-y-2">
                        {searchResults.map(user => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs">
                                {user.username[0]?.toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-white">{user.username}</span>
                                  <TierBadge rating={user.rating ?? 0} size="sm" />
                                </div>
                                <span className="text-[10px] text-neutral-400">{user.rating ?? 0} ELO</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {user.relationship === 'FRIEND' ? (
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Friends
                                </span>
                              ) : user.relationship === 'REQUEST_SENT' ? (
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-white/5 text-neutral-400 border border-white/10 flex items-center gap-1">
                                  <Clock size={11} /> Sent
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSendFriendRequest(user.username)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 text-xs font-semibold transition-all"
                                >
                                  <UserPlus size={12} />
                                  <span>Add</span>
                                </button>
                              )}

                              {user.presence?.isOnline && (
                                <button
                                  onClick={() => handleChallenge(user)}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-primary/20 text-neutral-400 hover:text-primary transition-all border border-white/10"
                                  title="Challenge to 1v1"
                                >
                                  <Swords size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : searchQuery.trim() ? (
                      <div className="text-center py-8 text-neutral-500 text-xs">
                        No players found matching "{searchQuery}"
                      </div>
                    ) : (
                      <div className="text-center py-10 text-neutral-500 text-xs">
                        Type a username above to find other developers.
                      </div>
                    )}
                  </div>
                )}

                {/* 4. REQUESTS TAB */}
                {activeTab === 'requests' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                        Incoming Requests ({requests.incoming.length})
                      </h4>
                      {requests.incoming.length === 0 ? (
                        <p className="text-xs text-neutral-500 italic">No incoming requests.</p>
                      ) : (
                        <div className="space-y-2">
                          {requests.incoming.map(req => (
                            <div
                              key={req.requestId}
                              className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                                  {req.user.username[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-white">{req.user.username}</div>
                                  <div className="text-[10px] text-neutral-400">{req.user.rating ?? 0} ELO</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleRespondRequest(req.requestId, 'ACCEPT')}
                                  className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all"
                                  title="Accept"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => handleRespondRequest(req.requestId, 'REJECT')}
                                  className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition-all"
                                  title="Decline"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                        Sent Requests ({requests.outgoing.length})
                      </h4>
                      {requests.outgoing.length === 0 ? (
                        <p className="text-xs text-neutral-500 italic">No pending sent requests.</p>
                      ) : (
                        <div className="space-y-2">
                          {requests.outgoing.map(req => (
                            <div
                              key={req.requestId}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs"
                            >
                              <span className="font-medium text-neutral-300">{req.user.username}</span>
                              <span className="text-[10px] text-neutral-500">Pending</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}
  </>
);
};
