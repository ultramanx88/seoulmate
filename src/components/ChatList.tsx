import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest, parseApiDate } from '../lib/api';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import ChatRoom from './ChatRoom';

export default function ChatList() {
  const { profile } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    let cancelled = false;
    const fetchChats = async () => {
      const result = await apiRequest<{ chats: any[] }>('/v1/chats');
      if (!cancelled) setChats(result.chats);
    };

    fetchChats().catch(console.error);
    const timer = window.setInterval(() => fetchChats().catch(console.error), 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [profile]);

  if (selectedChatId) {
    const chat = chats.find(c => c.id === selectedChatId);
    return <ChatRoom chatId={selectedChatId} otherUser={chat?.otherUser} onBack={() => setSelectedChatId(null)} />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="px-2 pb-3">
        <h2 className="text-3xl font-extrabold leading-tight text-brand-ink">Connections</h2>
        <p className="mt-2 text-sm font-medium text-muted-foreground">Recent conversations and new starts.</p>
      </div>
      {chats.length === 0 && (
        <div className="rounded-2xl border border-border bg-white px-6 py-16 text-center text-sm font-semibold text-muted-foreground shadow-sm">
          No conversations yet. Start exploring when you are ready.
        </div>
      )}
      {chats.map((chat) => (
        <button 
          key={chat.id}
          onClick={() => setSelectedChatId(chat.id)}
          className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-coral/25 hover:shadow-md"
        >
          <div className="relative">
            <Avatar className="h-14 w-14 border-2 border-white shadow-sm transition-transform group-hover:scale-[1.03]">
                <AvatarImage src={chat.otherUser?.photoURL} />
                <AvatarFallback>{chat.otherUser?.displayName?.[0]}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-brand-mint shadow-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1">
              <span className="flex items-center gap-2 font-extrabold text-foreground">
                {chat.otherUser?.displayName}
                <span className="vibrant-tag-rose">
                    {chat.otherUser?.nationality}
                </span>
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {parseApiDate(chat.lastMessageAt) ? formatDistanceToNow(parseApiDate(chat.lastMessageAt)!, { addSuffix: false }) : ''}
              </span>
            </div>
            <p className="truncate text-sm font-medium text-muted-foreground">{chat.lastMessage}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
