import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { geminiService } from '../services/gemini';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ChevronLeft, Send, Languages, Sparkles } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';

export default function ChatRoom({ chatId, otherUser, onBack }: { chatId: string, otherUser: any, onBack: () => void }) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(docs);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return unsubscribe;
  }, [chatId]);

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || newMessage;
    if (!text.trim()) return;

    setSending(true);
    try {
      const msgData = {
        chatId,
        senderId: auth.currentUser?.uid,
        text,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
      });
      setNewMessage('');
    } catch (e) {
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleTranslate = async (messageId: string, text: string) => {
    if (translations[messageId]) return;
    
    const targetLang = profile?.nationality === 'TH' ? 'th' : 'ko';
    toast.info("AI Translating...");
    const translated = await geminiService.translateChat(text, targetLang);
    setTranslations(prev => ({ ...prev, [messageId]: translated }));
  };

  const getIcebreakers = async () => {
    if (icebreakers.length > 0) return;
    toast.info("Generating AI Icebreakers...");
    const suggestions = await geminiService.getIcebreakers(otherUser.interests || [], otherUser.nationality);
    setIcebreakers(suggestions);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-rose-50 absolute inset-0 z-50">
      <header className="flex items-center gap-3 p-6 bg-white border-b-2 border-rose-100 flex-shrink-0">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-rose-50 transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <Avatar className="w-12 h-12 border-2 border-rose-200">
          <AvatarImage src={otherUser?.photoURL} />
          <AvatarFallback>{otherUser?.displayName?.[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-black text-lg leading-none mb-1 text-gray-800 italic">{otherUser?.displayName}</h3>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] uppercase font-black text-rose-500 tracking-widest">
                {otherUser?.intent}
            </span>
          </div>
        </div>
        <Button onClick={getIcebreakers} variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50 rounded-full w-12 h-12">
            <Sparkles className="w-6 h-6" />
        </Button>
      </header>

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6">
          {icebreakers.length > 0 && (
              <div className="bg-amber-50 p-6 rounded-[2rem] border-2 border-amber-100 space-y-3 mb-8 shadow-xl shadow-amber-100/30">
                <div className="text-[10px] font-black tracking-[0.2em] text-amber-600 uppercase flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4" /> AI Chat Assistant
                </div>
                {icebreakers.map((ib, i) => (
                    <button 
                        key={i} 
                        onClick={() => handleSend(ib)}
                        className="w-full text-left p-4 bg-white rounded-2xl text-xs font-bold text-gray-700 hover:bg-amber-100 transition-all border-none shadow-sm flex justify-between items-center group"
                    >
                        <span>{ib}</span>
                        <Send className="w-3 h-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ))}
              </div>
          )}
          
          {messages.map((msg) => {
            const isMe = msg.senderId === auth.currentUser?.uid;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] space-y-2`}>
                  {!isMe && <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-4">{otherUser?.displayName}</div>}
                  <div className={`p-5 rounded-[2rem] text-sm font-bold shadow-xl relative group transition-all hover:scale-[1.01] ${
                    isMe ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-100' : 'bg-white text-gray-800 rounded-tl-none border border-rose-50 shadow-rose-100'
                  }`}>
                    {msg.text}
                    {!isMe && (
                      <button 
                        onClick={() => handleTranslate(msg.id, msg.text)}
                        className="absolute -right-10 bottom-2 w-8 h-8 flex items-center justify-center bg-white border-2 border-rose-100 rounded-full text-rose-500 hover:bg-rose-500 hover:text-white shadow-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Languages className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {translations[msg.id] && (
                    <div className="text-xs bg-rose-50 text-rose-600 p-4 rounded-[1.5rem] font-serif italic border border-rose-100 shadow-md animate-in fade-in slide-in-from-top-2">
                        <span className="text-[10px] uppercase font-black tracking-widest text-rose-300 block mb-1">AI Translation</span>
                        {translations[msg.id]}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-6 border-t-2 border-rose-100 flex gap-3 items-center bg-white flex-shrink-0">
        <Input 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type your soul's message..."
          className="rounded-2xl bg-gray-50 border-none h-14 font-bold px-6 focus-visible:ring-rose-400 text-lg"
        />
        <Button 
          onClick={() => handleSend()} 
          disabled={sending || !newMessage.trim()}
          className="rounded-2xl h-14 w-14 bg-rose-500 hover:bg-rose-600 transition-all p-0 flex-shrink-0 shadow-xl shadow-rose-200"
        >
          <Send className="w-6 h-6 text-white" />
        </Button>
      </div>
    </div>
  );
}
