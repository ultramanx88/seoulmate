import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../lib/api';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Flag, ShieldOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function Explore() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reportTarget, setReportTarget] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [blockTarget, setBlockTarget] = useState<any | null>(null);
  const [actionBusy, setActionBusy] = useState<'connect' | 'report' | 'block' | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!profile) return;

      try {
        const result = await apiRequest<{ users: any[] }>('/v1/users/discover');
        setUsers(result.users);
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error && error.message === 'USAGE_LIMIT_REACHED'
          ? 'Daily discovery limit reached. Pro will raise this limit.'
          : 'No profiles found yet');
      }
    };
    
    fetchUsers();
  }, [profile]);

  const startChat = async (targetUser: any) => {
    setActionBusy('connect');
    try {
      await apiRequest('/v1/chats', {
        method: 'POST',
        body: JSON.stringify({ userId: targetUser.uid ?? targetUser.id }),
      });
      
      toast.success(`Connected with ${targetUser.displayName}!`);
      setCurrentIndex(prev => prev + 1);
      return true;
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'USAGE_LIMIT_REACHED'
        ? 'Daily new chat limit reached. Pro will raise this limit.'
        : 'Error starting chat');
      return false;
    } finally {
      setActionBusy(null);
    }
  };

  const submitReport = async () => {
    if (!reportTarget || !reportReason.trim()) return;
    setActionBusy('report');
    try {
      await apiRequest('/v1/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'user',
          targetId: reportTarget.uid ?? reportTarget.id,
          reason: reportReason.trim(),
        }),
      });
      toast.success('Report sent to safety review');
      setReportTarget(null);
      setReportReason('');
    } catch {
      toast.error('Could not submit report');
    } finally {
      setActionBusy(null);
    }
  };

  const submitBlock = async () => {
    if (!blockTarget) return;
    setActionBusy('block');
    try {
      await apiRequest(`/v1/users/${blockTarget.uid ?? blockTarget.id}/block`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Blocked from discover' }),
      });
      toast.success('Profile blocked');
      setBlockTarget(null);
      setCurrentIndex(prev => prev + 1);
    } catch {
      toast.error('Could not block profile');
    } finally {
      setActionBusy(null);
    }
  };

  if (users.length === 0) {
    return <div className="px-6 py-16 text-center text-sm font-semibold text-muted-foreground">No profiles are ready yet.</div>;
  }

  const currentUser = users[currentIndex];

  if (!currentUser) {
    return <div className="px-6 py-16 text-center text-sm font-semibold text-muted-foreground">You have seen everyone for now.</div>;
  }

  return (
    <div className="p-4 h-[calc(100vh-140px)] flex flex-col items-center justify-center relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
           key={currentUser.uid}
           initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
           animate={{ opacity: 1, scale: 1, rotate: 0 }}
           exit={{ opacity: 0, scale: 1.1, rotate: 2 }}
           className="w-full max-w-sm h-full max-h-[600px]"
        >
          <Card className="relative h-full overflow-hidden rounded-3xl border border-white shadow-[0_22px_60px_oklch(0.25_0.07_282/14%)] group">
            <img 
                src={currentUser.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.displayName}`} 
                alt={currentUser.displayName}
                className="h-full w-full object-cover transition-all duration-700 group-hover:scale-[1.04]"
            />
            
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/86 via-black/24 to-transparent p-7 text-white">
                <div className="flex items-center gap-2 mb-4">
                    <span className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
                        {currentUser.nationality === 'TH' ? 'Thailand' : 'Korea'}
                    </span>
                    <span className="rounded-full bg-brand-coral px-3 py-1.5 text-xs font-semibold shadow-lg shadow-black/20">
                        {currentUser.intent === 'dating' ? 'Dating' : currentUser.intent === 'friendship' ? 'Friends' : 'Exchange'}
                    </span>
                </div>
                <h3 className="mb-2 text-4xl font-extrabold leading-tight drop-shadow-lg">{currentUser.displayName}</h3>
                <p className="mb-8 line-clamp-3 text-sm font-medium leading-6 text-white/84">
                   {currentUser.bio || "No bio yet. Start with a simple hello and shared context."}
                </p>

                <div className="flex gap-4 mb-2">
                    <Button 
                        aria-label={`Skip ${currentUser.displayName}`}
                        onClick={() => setCurrentIndex(prev => prev + 1)}
                        className="h-16 w-16 rounded-2xl border border-white/22 bg-white/18 font-bold text-white backdrop-blur-xl transition-all hover:bg-white/28 active:scale-95"
                    >
                        <X className="w-8 h-8" />
                    </Button>
                    <Button 
                        onClick={() => startChat(currentUser)}
                        disabled={actionBusy === 'connect'}
                        className="h-16 flex-1 rounded-2xl bg-brand-coral text-base font-extrabold text-white shadow-xl shadow-black/20 transition-all hover:bg-brand-coral/90 active:scale-95"
                    >
                        {actionBusy === 'connect' ? 'Connecting...' : 'Connect'}
                    </Button>
                </div>
                <div className="flex justify-center gap-2 text-white/80">
                    <button
                        type="button"
                        onClick={() => setReportTarget(currentUser)}
                        aria-label={`Report ${currentUser.displayName}`}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-white/14"
                    >
                        <Flag className="size-3.5" /> Report
                    </button>
                    <button
                        type="button"
                        onClick={() => setBlockTarget(currentUser)}
                        aria-label={`Block ${currentUser.displayName}`}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-white/14"
                    >
                        <ShieldOff className="size-3.5" /> Block
                    </button>
                </div>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>

      <Dialog open={!!reportTarget} onOpenChange={(open) => !open && setReportTarget(null)}>
        <DialogContent className="rounded-2xl border-border bg-white shadow-[0_24px_70px_oklch(0.25_0.07_282/16%)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-brand-ink">Report profile</DialogTitle>
            <DialogDescription className="leading-6">
              Tell safety what feels off about {reportTarget?.displayName}. Reports are private.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value)}
            placeholder="Suspicious behavior, fake profile, harassment, or another safety concern..."
            className="min-h-28 rounded-xl bg-muted/60"
          />
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setReportTarget(null)}>
              Cancel
            </Button>
            <Button className="action-primary h-11 rounded-xl font-extrabold" disabled={actionBusy === 'report' || !reportReason.trim()} onClick={submitReport}>
              {actionBusy === 'report' ? 'Sending...' : 'Send report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!blockTarget} onOpenChange={(open) => !open && setBlockTarget(null)}>
        <DialogContent className="rounded-2xl border-border bg-white shadow-[0_24px_70px_oklch(0.25_0.07_282/16%)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-brand-ink">Block {blockTarget?.displayName}?</DialogTitle>
            <DialogDescription className="leading-6">
              You will not see this profile in discovery or chat with them. You can review blocks later as the account controls grow.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setBlockTarget(null)}>
              Keep profile
            </Button>
            <Button variant="destructive" className="h-11 rounded-xl font-extrabold" disabled={actionBusy === 'block'} onClick={submitBlock}>
              {actionBusy === 'block' ? 'Blocking...' : 'Block profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
