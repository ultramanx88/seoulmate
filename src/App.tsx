import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Landing from './components/Landing';
import ProfileSetup from './components/ProfileSetup';
import Feed from './components/Feed';
import Explore from './components/Explore';
import ChatList from './components/ChatList';
import { Button } from './components/ui/button';
import { Heart, MessageCircle, Users, Globe, Settings as SettingsIcon } from 'lucide-react';
import { Toaster } from './components/ui/sonner';

function Navigation({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
  const tabs = [
    { id: 'feed', icon: Globe, label: 'Community' },
    { id: 'explore', icon: Heart, label: 'Matches' },
    { id: 'chats', icon: MessageCircle, label: 'Chats' },
    { id: 'profile', icon: SettingsIcon, label: 'Profile' },
  ];

  return (
    <nav className="bottom-bar fixed bottom-0 left-0 right-0 border-t px-6 py-4 flex justify-between items-center z-50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === tab.id ? 'text-primary border-b-2 border-primary pb-1' : 'text-muted-foreground hover:text-primary'
          }`}
        >
          <tab.icon className="w-6 h-6" />
          <span className="text-[10px] uppercase font-bold tracking-tight">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

function MainApp() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('feed');

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-primary">SEOULMATE...</div>;

  if (!user) return <Landing />;

  if (!profile || !profile.nationality) return <ProfileSetup />;

  return (
    <div className="app-shell">
      <header className="top-bar sticky top-0 z-40 border-b px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="brand-mark w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold">S</div>
          <h1 className="brand-wordmark text-xl tracking-tighter italic">SEOUL<span className="brand-wordmark-accent">MATE</span></h1>
        </div>
        <div className="flex items-center gap-2">
            <span className="locale-chip">
                {profile.nationality === 'TH' ? 'TH ⇄ KR' : 'KR ⇄ TH'}
            </span>
        </div>
      </header>

      <main className="mobile-frame h-full">
        {activeTab === 'feed' && <Feed />}
        {activeTab === 'explore' && <Explore />}
        {activeTab === 'chats' && <ChatList />}
        {activeTab === 'profile' && <ProfileSetup existingProfile={profile} />}
      </main>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
