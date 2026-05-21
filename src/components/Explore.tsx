import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp, and, or } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Heart, X, MessageCircle, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function Explore() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!profile) return;
      
      const targetNationality = profile.nationality === 'TH' ? 'KR' : 'TH';
      const q = query(
        collection(db, 'users'), 
        where('nationality', '==', targetNationality),
        limit(20)
      );
      
      const snapshot = await getDocs(q);
      const docs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(u => u.uid !== auth.currentUser?.uid);
      setUsers(docs);
    };
    
    fetchUsers();
  }, [profile]);

  const startChat = async (targetUser: any) => {
    try {
      const chatRef = collection(db, 'chats');
      const participants = [auth.currentUser?.uid, targetUser.uid].sort();
      
      // Check if chat already exists (simplified for now)
      const newChat = await addDoc(chatRef, {
        participants,
        lastMessage: "Connected! Say hello.",
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      
      toast.success(`Connected with ${targetUser.displayName}!`);
    } catch (e) {
      toast.error("Error starting chat");
    }
  };

  if (users.length === 0) {
    return <div className="p-12 text-center text-gray-400 font-bold uppercase tracking-widest">No souls found yet...</div>;
  }

  const currentUser = users[currentIndex];

  if (!currentUser) {
    return <div className="p-12 text-center text-gray-400 font-bold uppercase tracking-widest">You've reached the end of explorations!</div>;
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
          <Card className="h-full rounded-[3rem] border-none shadow-2xl overflow-hidden relative group border-4 border-white">
            <img 
                src={currentUser.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.displayName}`} 
                alt={currentUser.displayName}
                className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
            />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-8 text-white">
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-[10px] font-black uppercase py-1.5 px-3 bg-indigo-600 rounded-full tracking-widest shadow-lg shadow-indigo-900/40">
                        {currentUser.nationality === 'TH' ? '🇹🇭 THAILAND' : '🇰🇷 KOREA'}
                    </span>
                    <span className="text-[10px] font-black uppercase py-1.5 px-3 bg-rose-500 rounded-full tracking-widest shadow-lg shadow-rose-900/40">
                        {currentUser.intent === 'dating' ? 'DATING' : currentUser.intent === 'friendship' ? 'FRIENDS' : 'EXCHANGE'}
                    </span>
                </div>
                <h3 className="text-4xl font-black italic tracking-tighter mb-2 drop-shadow-lg">{currentUser.displayName}</h3>
                <p className="text-sm text-gray-200 line-clamp-3 mb-8 font-bold leading-relaxed italic opacity-90">
                   "{currentUser.bio || "No bio yet. Let's start our vibrant connection tonight!"}"
                </p>

                <div className="flex gap-4 mb-2">
                    <Button 
                        onClick={() => setCurrentIndex(prev => prev + 1)}
                        className="w-16 h-16 bg-white/20 hover:bg-white/30 backdrop-blur-xl text-white rounded-3xl border border-white/20 font-bold transition-all active:scale-90"
                    >
                        <X className="w-8 h-8" />
                    </Button>
                    <Button 
                        onClick={() => {
                            startChat(currentUser);
                            setCurrentIndex(prev => prev + 1);
                        }}
                        className="flex-1 h-16 bg-rose-500 hover:bg-rose-600 text-white rounded-3xl shadow-2xl shadow-rose-900/50 font-black italic text-xl tracking-tighter transition-all active:scale-95"
                    >
                        CONNECT ♥
                    </Button>
                </div>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
