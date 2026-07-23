import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../lib/api';
import { geminiService } from '../services/gemini';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ChevronLeft, Send, Languages, SmilePlus, Sparkles } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';
import { basicStickers, getBasicSticker, getStickerLabel, type BasicSticker } from '../data/basic-stickers';

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
  const [stickerTrayOpen, setStickerTrayOpen] = useState(false);
  const [stickerLocale, setStickerLocale] = useState<'TH' | 'KR'>(translationTarget);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStickerLocale(translationTarget);
  }, [translationTarget]);

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

  const sendSticker = async (sticker: BasicSticker) => {
    setSending(true);
    try {
      const result = await apiRequest<{ message: any }>(`/v1/chats/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          stickerId: sticker.id,
          text: getStickerLabel(sticker, stickerLocale),
        }),
      });
      setMessages((previous) => [...previous, result.message]);
      setStickerTrayOpen(false);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (error) {
      toast.error(error instanceof Error && error.message === 'STICKER_NOT_FOUND'
        ? 'Sticker is not available'
        : 'Failed to send sticker');
    } finally {
      setSending(false);
    }
  };

  const stickerToneClass = (tone: BasicSticker['tone']) => {
    switch (tone) {
      case 'coral':
        return 'border-brand-coral/20 bg-brand-blush text-brand-coral';
      case 'mint':
        return 'border-brand-mint/30 bg-accent text-accent-foreground';
      case 'lilac':
        return 'border-brand-ink/10 bg-brand-lilac text-brand-ink';
      case 'honey':
        return 'border-brand-honey/30 bg-amber-50 text-amber-700';
      case 'ink':
      default:
        return 'border-brand-ink/10 bg-white text-brand-ink';
    }
  };

  const renderSticker = (stickerId: string | null | undefined, fallbackText: string, isMe: boolean) => {
    const sticker = getBasicSticker(stickerId);
    if (!sticker) {
      return <span>{fallbackText}</span>;
    }

    return (
      <div className={`min-w-32 rounded-2xl border p-4 text-center shadow-sm ${stickerToneClass(sticker.tone)} ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
        <div className="text-4xl leading-none">{sticker.emoji}</div>
        <div className="mt-3 text-sm font-black leading-5">{getStickerLabel(sticker, stickerLocale)}</div>
      </div>
    );
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
            const isSticker = msg.messageType === 'sticker';
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] space-y-2`}>
                  {!isMe && <div className="ml-3 text-xs font-semibold text-muted-foreground">{otherUser?.displayName}</div>}
                  {isSticker ? (
                    <div className="group relative">
                      {renderSticker(msg.stickerId, msg.text, isMe)}
                    </div>
                  ) : (
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
                  )}
                  {!isSticker && translations[msg.id] && (
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

      <div className="flex-shrink-0 border-t border-border bg-white p-4">
        {stickerTrayOpen && (
          <div className="mb-4 rounded-2xl border border-border bg-muted/35 p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-brand-ink">Basic stickers</p>
                <p className="text-xs font-semibold text-muted-foreground">16 ready-made Seoulmate reactions</p>
              </div>
              <div className="inline-flex rounded-xl border border-border bg-white p-1">
                {(['TH', 'KR'] as const).map((locale) => (
                  <button
                    key={locale}
                    type="button"
                    aria-pressed={stickerLocale === locale}
                    onClick={() => setStickerLocale(locale)}
                    className={`h-8 rounded-lg px-3 text-xs font-black transition ${
                      stickerLocale === locale ? 'bg-brand-ink text-white' : 'text-muted-foreground hover:bg-muted hover:text-brand-ink'
                    }`}
                  >
                    {locale}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {basicStickers.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => sendSticker(sticker)}
                  disabled={sending}
                  aria-label={`Send ${getStickerLabel(sticker, stickerLocale)} sticker`}
                  className={`min-h-20 rounded-2xl border p-2 text-center transition hover:-translate-y-0.5 hover:shadow-sm active:scale-95 disabled:pointer-events-none disabled:opacity-60 ${stickerToneClass(sticker.tone)}`}
                >
                  <div className="text-2xl leading-none">{sticker.emoji}</div>
                  <div className="mt-2 line-clamp-2 text-[11px] font-black leading-4">{getStickerLabel(sticker, stickerLocale)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            aria-label={stickerTrayOpen ? 'Close sticker tray' : 'Open sticker tray'}
            aria-pressed={stickerTrayOpen}
            onClick={() => setStickerTrayOpen((open) => !open)}
            variant="outline"
            className="h-12 w-12 flex-shrink-0 rounded-xl p-0 text-brand-coral"
          >
            <SmilePlus className="w-5 h-5" />
          </Button>
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
    </div>
  );
}
