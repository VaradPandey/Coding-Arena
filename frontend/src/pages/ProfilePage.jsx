import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userApi } from '@/api/users';
import { PageWrapper, Container } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { 
  User, 
  Trophy, 
  Swords, 
  Target, 
  Calendar, 
  Mail, 
  Zap, 
  Award, 
  Edit3, 
  X, 
  Check, 
  Loader2, 
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeSlideUp } from '@/lib/motion';
import { TierBadge, TIERS, getTier } from '@/components/common/TierBadge';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Shadow',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Viper',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Nova',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka',
];

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: profileResp } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => userApi.getMe(),
  });

  const { data: solvedResp } = useQuery({
    queryKey: ['user', 'solved'],
    queryFn: () => userApi.getMySolvedProblems(),
  });

  const currentUser = profileResp?.data || user;
  const currentRating = currentUser?.rating ?? 0;
  const tierInfo = getTier(currentRating);
  const problemsSolved = solvedResp?.data?.length ?? currentUser?.problemsSolved ?? 0;

  // Edit Profile Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isEditModalOpen && currentUser) {
      setDisplayName(currentUser.displayName || currentUser.username || '');
      setAvatar(currentUser.avatar || '');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isEditModalOpen, currentUser]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isEditModalOpen) {
        setIsEditModalOpen(false);
      }
    };
    if (isEditModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isEditModalOpen]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = displayName.trim();
    if (trimmedName.length > 0 && (trimmedName.length < 2 || trimmedName.length > 50)) {
      setErrorMessage('Display name must be between 2 and 50 characters.');
      return;
    }

    setIsSaving(true);
    try {
      await userApi.updateProfile({
        displayName: trimmedName || null,
        avatar: avatar.trim() || null,
      });

      // Refetch user profile queries
      await queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      setSuccessMessage('Profile updated successfully!');

      setTimeout(() => {
        setIsEditModalOpen(false);
      }, 1000);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to update profile.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageWrapper>
      <Container className="py-8 max-w-4xl space-y-8">
        
        <motion.div {...fadeSlideUp} className="flex flex-col md:flex-row gap-8 items-start">
          
          {/* Left Column: Avatar & Basic Info */}
          <Card className="w-full md:w-1/3 border-primary/20 shadow-[0_0_40px_-10px_rgba(var(--primary-rgb),0.1)]">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/50 shadow-inner overflow-hidden">
                  {currentUser?.avatar ? (
                    <img 
                      src={currentUser.avatar} 
                      alt={currentUser.displayName || currentUser.username} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <User className="w-14 h-14 text-primary" />
                  )}
                </div>
              </div>

              <h2 className="text-2xl font-bold tracking-tight">{currentUser?.displayName || currentUser?.username}</h2>
              <p className="text-muted-foreground text-sm mb-4">@{currentUser?.username}</p>
              
              {/* Prominent Tier Badge */}
              <div className="mb-6 flex flex-col items-center gap-1.5">
                <TierBadge rating={currentRating} size="lg" showTitle={true} animated={true} />
                <span className="text-[11px] font-mono text-muted-foreground">
                  Current Elo: <strong className="text-foreground">{currentRating}</strong>
                </span>
              </div>

              <div className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground mb-6 bg-white/5 py-2 px-3 rounded-lg border border-white/5 truncate">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{currentUser?.email}</span>
              </div>

              <Button 
                variant="outline" 
                className="w-full mb-2 gap-2"
                onClick={() => setIsEditModalOpen(true)}
              >
                <Edit3 className="w-4 h-4" />
                Edit Profile
              </Button>
              <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={logout}>
                Sign Out
              </Button>
            </CardContent>
          </Card>

          {/* Right Column: Stats & Meta */}
          <div className="w-full md:w-2/3 space-y-6">
            
            {/* Tier Progression Card */}
            <motion.div {...fadeSlideUp}>
              <Card className="border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden relative">
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${tierInfo.gradient}`} />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Award className="w-4 h-4 text-primary" />
                      Rank Tier Progression
                    </CardTitle>
                    <TierBadge rating={currentRating} size="sm" showLabel={true} />
                  </div>
                  <CardDescription>
                    {tierInfo.nextTier ? (
                      <span>
                        <strong className="text-foreground font-semibold">{tierInfo.pointsToNext} pts</strong> needed to reach{' '}
                        <span className="font-semibold" style={{ color: tierInfo.nextTier.color }}>
                          {tierInfo.nextTier.name} ({tierInfo.nextTier.title})
                        </span>
                      </span>
                    ) : (
                      <span>You have reached the maximum competitive tier. Master of the Arena!</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono text-muted-foreground">
                      <span>{tierInfo.min} pts</span>
                      <span className="font-bold text-foreground">{tierInfo.progressPercent}% Completed</span>
                      <span>{tierInfo.max === 3000 ? '2100+' : `${tierInfo.max} pts`}</span>
                    </div>
                    <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${tierInfo.progressPercent}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className={`h-full rounded-full bg-gradient-to-r ${tierInfo.gradient}`}
                      />
                    </div>
                  </div>

                  {/* All Competitive Tiers Preview */}
                  <div className="pt-2 border-t border-border/40">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                      All Arena Tiers
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {TIERS.map((t) => {
                        const isCurrent = t.id === tierInfo.id;
                        return (
                          <div 
                            key={t.id}
                            className={`p-2 rounded-xl border text-center transition-all ${
                              isCurrent 
                                ? `${t.bg} ${t.border} shadow-sm ring-1 ring-white/20` 
                                : 'bg-white/[0.02] border-white/5 opacity-60'
                            }`}
                          >
                            <span className="text-[10px] uppercase font-bold block" style={{ color: t.color }}>
                              {t.name}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-mono block mt-0.5">
                              {t.min} - {t.max === 3000 ? '2100+' : t.max}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Competitive Overview */}
            <motion.div {...fadeSlideUp}>
              <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Competitive Overview</CardTitle>
                  <CardDescription>Your performance statistics in the Arena</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-500">
                      <Trophy className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Global Rating</p>
                      <h4 className="text-2xl font-bold">{currentRating}</h4>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                      <Target className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Problems Solved</p>
                      <h4 className="text-2xl font-bold">{problemsSolved}</h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                      <Swords className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Matches</p>
                      <h4 className="text-2xl font-bold">{(currentUser?.wins || 0) + (currentUser?.losses || 0) + (currentUser?.draws || 0)}</h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
                      <Calendar className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Member Since</p>
                      <h4 className="text-lg font-bold">
                        {currentUser?.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'Recently'}
                      </h4>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Match History & Achievements (Battle Now button removed as requested) */}
            <motion.div {...fadeSlideUp} className="space-y-4 pt-2">
              <h3 className="text-lg font-semibold text-muted-foreground">Activity & History</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="border-border/50 bg-card/20 hover:border-primary/40 transition-colors">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>Recent 1v1 Battles</span>
                      <Swords className="w-4 h-4 text-primary" />
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Wins: <strong className="text-emerald-400">{currentUser?.wins || 0}</strong> • Losses: <strong className="text-rose-400">{currentUser?.losses || 0}</strong> • Draws: <strong className="text-yellow-400">{currentUser?.draws || 0}</strong>
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="border-border/50 bg-card/20 hover:border-primary/40 transition-colors">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>Highest Elo Achieved</span>
                      <Zap className="w-4 h-4 text-amber-400" />
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Peak Rating: <strong className="text-foreground font-mono">{currentUser?.maxRating ?? currentRating} pts</strong>
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </motion.div>

          </div>

        </motion.div>
      </Container>

      {/* Edit Profile Modal Dialog */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isEditModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
              {/* Dimmed Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !isSaving && setIsEditModalOpen(false)}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm"
                aria-hidden="true"
              />

              {/* Modal Box */}
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Edit Profile"
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-md bg-[#0d0e17] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10 text-foreground"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/30">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-primary" />
                    <h3 className="font-bold text-base text-foreground">Edit Profile</h3>
                  </div>
                  <button
                    onClick={() => !isSaving && setIsEditModalOpen(false)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                    aria-label="Close dialog"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  {/* Avatar Preview & Selection */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Profile Avatar
                    </label>

                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/40 overflow-hidden shrink-0 shadow-inner">
                        {avatar ? (
                          <img src={avatar} alt="Avatar preview" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-8 h-8 text-primary" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1">
                        <Input
                          placeholder="Paste image URL (optional)"
                          value={avatar}
                          onChange={(e) => setAvatar(e.target.value)}
                          className="text-xs bg-background/50 h-9"
                        />
                        <span className="text-[10px] text-muted-foreground block">
                          Paste a custom image URL or choose a preset below:
                        </span>
                      </div>
                    </div>

                    {/* Preset Avatars Row */}
                    <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1">
                      {PRESET_AVATARS.map((presetUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setAvatar(presetUrl)}
                          className={`w-9 h-9 rounded-full border-2 overflow-hidden transition-all shrink-0 hover:scale-110 ${
                            avatar === presetUrl ? 'border-primary ring-2 ring-primary/40' : 'border-white/10 opacity-70'
                          }`}
                          title={`Preset Avatar #${idx + 1}`}
                        >
                          <img src={presetUrl} alt="Preset avatar" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Display Name Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Display Name
                    </label>
                    <Input
                      placeholder="Enter display name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={50}
                      className="bg-background/50"
                    />
                    <span className="text-[11px] text-muted-foreground block">
                      2 to 50 characters. Shown on leaderboards and in 1v1 battle rooms.
                    </span>
                  </div>

                  {/* Modal Actions */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditModalOpen(false)}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSaving}
                      className="gap-2 bg-gradient-to-r from-primary to-indigo-600 text-white font-semibold shadow-md"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </PageWrapper>
  );
}
