import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../lib/api';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Flag, ShieldOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function Explore() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!profile) return;

      try {
        const result = await apiRequest<{ users: any[] }>('/v1/users/discover');
        setUsers(result.users);
      } catch (error) {
        console.error(error);
        toast.error("No profiles found yet");
      }
    };
    
    fetchUsers();
  }, [profile]);

  const startChat = async (targetUser: any) => {
    try {
      await apiRequest('/v1/chats', {
        method: 'POST',
        body: JSON.stringify({ userId: targetUser.uid ?? targetUser.id }),
      });
      
      toast.success(`Connected with ${targetUser.displayName}!`);
    } catch (e) {
      toast.error("Error starting chat");
    }
  };

  const reportUser = async (targetUser: any) => {
    const reason = window.prompt('What should safety review?');
    if (!reason?.trim()) return;
    try {
      await apiRequest('/v1/reports', {
        method: 'POST',
        body: JSON.stringify({ targetType: 'user', targetId: targetUser.uid ?? targetUser.id, reason }),
      });
      toast.success('Report sent to safety review');
    } catch {
      toast.error('Could not submit report');
    }
  };

  const blockUser = async (targetUser: any) => {
    if (!window.confirm(`Block ${targetUser.displayName}? You will not see or chat with this profile.`)) return;
    try {
      await apiRequest(`/v1/users/${targetUser.uid ?? targetUser.id}/block`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Blocked from discover' }),
      });
      toast.success('Profile blocked');
      setCurrentIndex(prev => prev + 1);
    } catch {
      toast.error('Could not block profile');
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
                        onClick={() => setCurrentIndex(prev => prev + 1)}
                        className="h-16 w-16 rounded-2xl border border-white/22 bg-white/18 font-bold text-white backdrop-blur-xl transition-all hover:bg-white/28 active:scale-95"
                    >
                        <X className="w-8 h-8" />
                    </Button>
                    <Button 
                        onClick={() => {
                            startChat(currentUser);
                            setCurrentIndex(prev => prev + 1);
                        }}
                        className="h-16 flex-1 rounded-2xl bg-brand-coral text-base font-extrabold text-white shadow-xl shadow-black/20 transition-all hover:bg-brand-coral/90 active:scale-95"
                    >
                        Connect
                    </Button>
                </div>
                <div className="flex justify-center gap-2 text-white/80">
                    <button
                        type="button"
                        onClick={() => reportUser(currentUser)}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-white/14"
                    >
                        <Flag className="size-3.5" /> Report
                    </button>
                    <button
                        type="button"
                        onClick={() => blockUser(currentUser)}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-white/14"
                    >
                        <ShieldOff className="size-3.5" /> Block
                    </button>
                </div>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
