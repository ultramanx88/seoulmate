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
      <h2 className="text-3xl font-black tracking-tighter mb-8 italic px-2 uppercase text-gray-800">Your Connections</h2>
      {chats.length === 0 && (
        <div className="py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
          No vibrant souls yet. Start exploring!
        </div>
      )}
      {chats.map((chat) => (
        <button 
          key={chat.id}
          onClick={() => setSelectedChatId(chat.id)}
          className="w-full flex items-center gap-4 p-5 rounded-[2rem] bg-white border border-rose-50 shadow-xl shadow-rose-100/50 hover:shadow-2xl hover:shadow-rose-100 transition-all text-left group"
        >
          <div className="relative">
            <Avatar className="w-16 h-16 border-2 border-white shadow-md transition-transform group-hover:scale-105">
                <AvatarImage src={chat.otherUser?.photoURL} />
                <AvatarFallback>{chat.otherUser?.displayName?.[0]}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-400 border-4 border-white shadow-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1">
              <span className="font-black text-gray-900 flex items-center gap-2 italic">
                {chat.otherUser?.displayName}
                <span className="vibrant-tag-rose">
                    {chat.otherUser?.nationality}
                </span>
              </span>
              <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">
                {parseApiDate(chat.lastMessageAt) ? formatDistanceToNow(parseApiDate(chat.lastMessageAt)!, { addSuffix: false }) : ''}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate font-bold opacity-80">{chat.lastMessage}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
