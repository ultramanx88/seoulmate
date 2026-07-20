import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {ClerkProvider} from '@clerk/clerk-react';
import App from './App.tsx';
import './index.css';

const clerkPublishableKey = (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

const clerkAppearance = {
  variables: {
    colorPrimary: '#e9524f',
    colorText: '#292237',
    colorBackground: '#fffaf2',
    colorInputBackground: '#ffffff',
    colorInputText: '#292237',
    colorDanger: '#d83f32',
    borderRadius: '12px',
    fontFamily: 'Noto Sans Thai, Noto Sans KR, system-ui, sans-serif',
  },
  elements: {
    cardBox: 'shadow-[0_24px_70px_oklch(0.25_0.07_282_/_16%)] border border-[#ecd9d5]',
    headerTitle: 'text-[#332b5f]',
    formButtonPrimary: 'bg-[#e9524f] hover:bg-[#d94643] text-white',
    footerActionLink: 'text-[#332b5f] font-bold',
  },
};

function MissingClerkConfig() {
  return (
    <main className="landing-shell flex min-h-dvh items-center justify-center px-5">
      <section className="w-full max-w-md rounded-3xl border border-border bg-white p-6 shadow-[var(--shadow-soft)]">
        <p className="brand-wordmark text-xl">SEOUL<span className="brand-wordmark-accent">MATE</span></p>
        <h1 className="mt-5 text-2xl font-black text-brand-ink">Clerk is not configured</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-muted-foreground">
          Add VITE_CLERK_PUBLISHABLE_KEY before building the app.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey} appearance={clerkAppearance}>
        <App />
      </ClerkProvider>
    ) : (
      <MissingClerkConfig />
    )}
  </StrictMode>,
);
