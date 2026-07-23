import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../lib/api';
import { geminiService } from '../services/gemini';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ChevronLeft, Send, Languages, Sparkles } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';

export default function ChatRoom({
  chatId,
  otherUser,
  translationTarget,
  onBack,
}: {
  chatId: string;
  otherUser: any;
  translationTarget: 'TH' | 'KR';
  onBack: () => void;
}) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchMessages = async () => {
      const result = await apiRequest<{ messages: any[] }>(`/v1/chats/${chatId}/messages`);
      if (cancelled) return;
      setMessages(result.messages);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    fetchMessages().catch(console.error);
    const timer = window.setInterval(() => fetchMessages().catch(console.error), 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [chatId]);

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || newMessage;
    if (!text.trim()) return;

    setSending(true);
    try {
      const result = await apiRequest<{ message: any }>(`/v1/chats/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setMessages((previous) => [...previous, result.message]);
      setNewMessage('');
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleTranslate = async (messageId: string, text: string) => {
    if (translations[messageId]) return;
    
    const targetLang = translationTarget === 'TH' ? 'th' : 'ko';
    try {
      toast.info("Translating...");
      await apiRequest('/v1/me/usage/ai_translations_daily/consume', { method: 'POST' });
      const translated = await geminiService.translateChat(text, targetLang);
      setTranslations(prev => ({ ...prev, [messageId]: translated }));
    } catch (error) {
      toast.error(error instanceof Error && error.message === 'USAGE_LIMIT_REACHED'
        ? 'Translation limit reached. Pro will raise this limit.'
        : 'Translation failed');
    }
  };

  const getIcebreakers = async () => {
    if (icebreakers.length > 0) return;
    toast.info("Generating starters...");
    const suggestions = await geminiService.getIcebreakers(otherUser.interests || [], otherUser.nationality);
    setIcebreakers(suggestions);
  };

  return (
    <div className="absolute inset-0 z-50 flex h-[calc(100vh-64px)] flex-col bg-background">
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-border bg-white p-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted transition-colors hover:bg-brand-blush"
        >
            <ChevronLeft className="w-6 h-6 text-muted-foreground" />
        </button>
        <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
          <AvatarImage src={otherUser?.photoURL} />
          <AvatarFallback>{otherUser?.displayName?.[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="mb-1 text-lg font-extrabold leading-none text-brand-ink">{otherUser?.displayName}</h3>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-mint" />
            <span className="text-xs font-semibold text-brand-coral">
                {otherUser?.intent}
            </span>
          </div>
        </div>
        <Button
          aria-label="Generate conversation starters"
          onClick={getIcebreakers}
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-xl text-brand-coral hover:bg-brand-blush"
        >
            <Sparkles className="w-6 h-6" />
        </Button>
      </header>

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6">
          {icebreakers.length > 0 && (
              <div className="mb-8 space-y-3 rounded-2xl border border-brand-honey/25 bg-amber-50 p-5 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-amber-700">
                    <Sparkles className="w-4 h-4" /> Suggested starters
                </div>
                {icebreakers.map((ib, i) => (
                    <button 
                        type="button"
                        key={i} 
                        onClick={() => handleSend(ib)}
                        className="group flex w-full items-center justify-between rounded-xl bg-white p-4 text-left text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-amber-100"
                    >
                        <span>{ib}</span>
                        <Send className="w-3 h-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ))}
              </div>
          )}
          
          {messages.map((msg) => {
            const isMe = msg.senderId === profile?.uid;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] space-y-2`}>
                  {!isMe && <div className="ml-3 text-xs font-semibold text-muted-foreground">{otherUser?.displayName}</div>}
                  <div className={`group relative rounded-2xl p-4 text-sm font-medium leading-6 shadow-sm transition-all ${
                    isMe ? 'rounded-tr-sm bg-brand-ink text-white' : 'rounded-tl-sm border border-border bg-white text-foreground'
                  }`}>
                    {msg.text}
                    {!isMe && (
                      <button 
                        type="button"
                        onClick={() => handleTranslate(msg.id, msg.text)}
                        aria-label={`Translate message to ${translationTarget}`}
                        className="absolute -right-10 bottom-2 flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white text-brand-coral opacity-0 shadow-sm transition-all hover:bg-brand-coral hover:text-white group-hover:opacity-100"
                      >
                        <Languages className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {translations[msg.id] && (
                    <div className="animate-in fade-in slide-in-from-top-2 rounded-2xl border border-brand-coral/15 bg-brand-blush/60 p-4 text-xs font-medium leading-5 text-brand-ink shadow-sm">
                        <span className="mb-1 block text-xs font-bold text-brand-coral">Translation</span>
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

      <div className="flex flex-shrink-0 items-center gap-3 border-t border-border bg-white p-5">
        <Input 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="h-12 rounded-xl border-none bg-muted px-4 text-base font-medium focus-visible:ring-brand-coral/30"
        />
        <Button 
          aria-label="Send message"
          onClick={() => handleSend()} 
          disabled={sending || !newMessage.trim()}
          className="h-12 w-12 flex-shrink-0 rounded-xl bg-brand-coral p-0 shadow-sm transition-all hover:bg-brand-coral/90"
        >
          <Send className="w-6 h-6 text-white" />
        </Button>
      </div>
    </div>
  );
}
