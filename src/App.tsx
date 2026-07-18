import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Landing from './components/Landing';
import ProfileSetup from './components/ProfileSetup';
import Feed from './components/Feed';
import Explore from './components/Explore';
import ChatList from './components/ChatList';
import { Heart, MessageCircle, Globe, Settings as SettingsIcon } from 'lucide-react';
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
          type="button"
          onClick={() => setActiveTab(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
          className={`flex min-w-16 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-all ${
            activeTab === tab.id ? 'bg-brand-blush text-primary' : 'text-muted-foreground hover:bg-muted/60 hover:text-brand-ink'
          }`}
        >
          <tab.icon className="w-5 h-5" />
          <span className="text-[11px] font-semibold">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

function MainApp() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('feed');

  if (loading) {
    return (
      <div className="app-shell flex h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-brand-ink">
          <div className="brand-mark flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white">S</div>
          <span className="brand-wordmark text-lg">SEOUL<span className="brand-wordmark-accent">MATE</span></span>
        </div>
      </div>
    );
  }

  if (!user) return <Landing />;

  if (!profile || !profile.nationality) return <ProfileSetup />;

  return (
    <div className="app-shell">
      <header className="top-bar sticky top-0 z-40 border-b px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="brand-mark flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white">S</div>
          <h1 className="brand-wordmark text-xl">SEOUL<span className="brand-wordmark-accent">MATE</span></h1>
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
