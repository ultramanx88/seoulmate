import { lazy, Suspense, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { UserButton } from '@clerk/clerk-react';
import { Crown, Heart, MessageCircle, Globe, Settings as SettingsIcon } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';

const Landing = lazy(() => import('./components/Landing'));
const ProfileSetup = lazy(() => import('./components/ProfileSetup'));
const Feed = lazy(() => import('./components/Feed'));
const Explore = lazy(() => import('./components/Explore'));
const ChatList = lazy(() => import('./components/ChatList'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const ProPanel = lazy(() => import('./components/ProPanel'));
type TranslationTarget = 'TH' | 'KR';

function AppLoading() {
  return (
    <div className="app-shell flex h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-brand-ink">
        <div className="brand-mark flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white">S</div>
        <span className="brand-wordmark text-lg">SEOUL<span className="brand-wordmark-accent">MATE</span></span>
      </div>
    </div>
  );
}

function Navigation({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
  const tabs = [
    { id: 'feed', icon: Globe, label: 'Community' },
    { id: 'explore', icon: Heart, label: 'Matches' },
    { id: 'chats', icon: MessageCircle, label: 'Chats' },
    { id: 'pro', icon: Crown, label: 'Pro' },
    { id: 'profile', icon: SettingsIcon, label: 'Profile' },
  ];

  return (
    <nav className="bottom-bar fixed bottom-0 left-0 right-0 border-t px-3 py-4 flex items-center z-50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActiveTab(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
          className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1.5 py-1.5 transition-all ${
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
  const [translationTarget, setTranslationTarget] = useState<TranslationTarget | null>(() => {
    const saved = window.localStorage.getItem('seoulmate.translationTarget');
    return saved === 'TH' || saved === 'KR' ? saved : null;
  });

  useEffect(() => {
    if (!profile?.nationality || translationTarget) return;
    setTranslationTarget(profile.nationality === 'TH' ? 'KR' : 'TH');
  }, [profile?.nationality, translationTarget]);

  if (loading) {
    return <AppLoading />;
  }

  if (!user) return <Landing />;

  if (!profile || !profile.nationality) return <ProfileSetup />;

  const activeTranslationTarget = translationTarget ?? (profile.nationality === 'TH' ? 'KR' : 'TH');
  const translationLabel = activeTranslationTarget === 'KR' ? 'TH → KR' : 'KR → TH';
  const toggleTranslationTarget = () => {
    const nextTarget = activeTranslationTarget === 'KR' ? 'TH' : 'KR';
    setTranslationTarget(nextTarget);
    window.localStorage.setItem('seoulmate.translationTarget', nextTarget);
    toast.success(`Translation target: ${nextTarget === 'KR' ? 'Korean' : 'Thai'}`);
  };

  return (
    <div className="app-shell">
      <header className="top-bar sticky top-0 z-40 border-b px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="brand-mark flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white">S</div>
          <h1 className="brand-wordmark text-xl">SEOUL<span className="brand-wordmark-accent">MATE</span></h1>
        </div>
        <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTranslationTarget}
              className="locale-chip transition hover:-translate-y-0.5 hover:border-brand-coral/30 hover:bg-brand-blush"
              aria-label={`Switch translation target. Current target is ${activeTranslationTarget === 'KR' ? 'Korean' : 'Thai'}.`}
              title="Switch translation target"
            >
                {translationLabel}
            </button>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'size-9 rounded-xl',
                  userButtonPopoverCard: 'border border-border shadow-[var(--shadow-raised)]',
                },
              }}
            />
        </div>
      </header>

      <main className="mobile-frame h-full">
        {activeTab === 'feed' && <Feed translationTarget={activeTranslationTarget} />}
        {activeTab === 'explore' && <Explore />}
        {activeTab === 'chats' && <ChatList translationTarget={activeTranslationTarget} />}
        {activeTab === 'pro' && <ProPanel />}
        {activeTab === 'profile' && <ProfileSetup existingProfile={profile} />}
      </main>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <Toaster />
    </div>
  );
}

export default function App() {
  if (window.location.pathname === '/admin') {
    return (
      <Suspense fallback={<AppLoading />}>
        <AdminPanel />
      </Suspense>
    );
  }

  return (
    <AuthProvider>
      <Suspense fallback={<AppLoading />}>
        <MainApp />
      </Suspense>
    </AuthProvider>
  );
}
