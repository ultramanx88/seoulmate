import { useAuth } from '../hooks/useAuth';
import type { AuthProvider } from '../lib/api';
import { Button } from './ui/button';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Globe2,
  HeartHandshake,
  Languages,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const trustSignals = [
  { icon: ShieldCheck, label: 'Verified intent', detail: 'Dating, friendship, or exchange' },
  { icon: Languages, label: 'Thai + Korean ready', detail: 'Prompts that survive translation' },
  { icon: HeartHandshake, label: 'Respect-first pace', detail: 'Less swipe noise, more context' },
];

const intentRows = [
  { label: 'Dating', tone: 'Warm signal', className: 'landing-chip-coral' },
  { label: 'Friendship', tone: 'Social fit', className: 'landing-chip-ink' },
  { label: 'Exchange', tone: 'Language bridge', className: 'landing-chip-mint' },
];

const authProviders: { id: AuthProvider; label: string }[] = [
  { id: 'naver', label: 'Naver' },
  { id: 'google', label: 'Google' },
  { id: 'line', label: 'LINE' },
  { id: 'kakao', label: 'Kakao' },
];

export default function Landing() {
  const { login } = useAuth();
  const reduceMotion = useReducedMotion();
  const authStatus = new URLSearchParams(window.location.search).get('auth');
  const authReason = new URLSearchParams(window.location.search).get('reason');
  const authFailed = authStatus === 'failed';

  return (
    <main className="landing-shell relative min-h-dvh overflow-hidden px-5 py-5 sm:px-8">
      <div className="landing-grid" aria-hidden="true" />

      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-6xl flex-col"
      >
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="landing-mark" aria-hidden="true">
              <Globe2 className="size-5" />
            </div>
            <div>
              <p className="brand-wordmark text-lg leading-none">
                SEOUL<span className="brand-wordmark-accent">MATE</span>
              </p>
              <p className="text-xs font-semibold text-muted-foreground">TH / KR social signal</p>
            </div>
          </div>

          <div className="landing-status">
            <span className="landing-status-dot" aria-hidden="true" />
            safety-first beta
          </div>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.74fr)] lg:gap-14 lg:py-12">
          <div className="max-w-2xl">
            <div className="landing-kicker">
              <span>안전한 연결</span>
              <span>คุยอย่างมั่นใจ</span>
            </div>

            <h1 className="landing-headline mt-5">
              Meet across culture without losing the signal.
            </h1>

            <p className="mt-6 max-w-xl text-base font-medium leading-8 text-muted-foreground sm:text-lg">
              A Thai-Korean dating and social app built around intent, translation, and trust.
              Less shallow swiping. More context before the first message.
            </p>

            {authFailed && (
              <div className="mt-6 flex max-w-xl gap-3 rounded-2xl border border-destructive/20 bg-white p-4 text-sm font-semibold leading-6 text-foreground shadow-sm">
                <AlertCircle className="mt-0.5 size-5 flex-shrink-0 text-destructive" />
                <div>
                  <p className="font-extrabold">Login could not be completed.</p>
                  <p className="mt-1 text-muted-foreground">
                    {authReason === 'invalid_state'
                      ? 'The secure login check expired or the browser did not return it. Please try Naver again.'
                      : 'Please try again, or use another provider when it is available.'}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-[minmax(21rem,1fr)_auto]">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {authProviders.map((provider) => (
                  <Button
                    key={provider.id}
                    disabled={provider.id !== 'naver'}
                    onClick={() => login(provider.id)}
                    size="lg"
                    className={
                      provider.id === 'naver'
                        ? 'action-primary h-12 rounded-xl px-3 text-sm font-extrabold'
                        : 'h-12 rounded-xl border border-border bg-white px-3 text-sm font-extrabold text-muted-foreground shadow-sm'
                    }
                  >
                    {provider.label}
                    {provider.id === 'naver' && <ArrowRight className="ml-1 size-4" />}
                  </Button>
                ))}
              </div>

              <div className="landing-assurance">
                <CheckCircle2 className="size-4 text-brand-mint" />
                Intent-first profiles before matches
              </div>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {trustSignals.map((item) => (
                <div key={item.label} className="landing-signal">
                  <item.icon className="size-4 text-brand-ink" />
                  <div>
                    <p className="font-extrabold leading-snug text-foreground">{item.label}</p>
                    <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 28, rotate: -1.5 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="landing-preview"
          >
            <div className="landing-preview-top">
              <div>
                <p className="text-xs font-black text-brand-coral">SEOUL SIGNAL</p>
                <p className="mt-1 text-xl font-black leading-tight text-brand-ink">A better first hello</p>
              </div>
              <Sparkles className="size-5 text-brand-coral" />
            </div>

            <div className="landing-message landing-message-primary">
              <div className="flex items-center justify-between gap-3">
                <span className="landing-avatar">민</span>
                <span className="landing-match-score">intent 92%</span>
              </div>
              <p className="mt-4 text-lg font-black leading-snug text-foreground">
                “ตลาดกลางคืนที่เชียงใหม่ มีร้านไหนเหมาะกับเดตแรกไหม?”
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-muted-foreground">
                “치앙마이 야시장에서 첫 만남에 좋은 곳이 있을까요?”
              </p>
            </div>

            <div className="landing-intents">
              {intentRows.map((row) => (
                <div key={row.label} className="landing-intent-row">
                  <span className={`landing-intent-chip ${row.className}`}>{row.label}</span>
                  <span>{row.tone}</span>
                </div>
              ))}
            </div>

            <div className="landing-preview-footer">
              <div>
                <p className="text-xs font-bold text-muted-foreground">Tonight’s bridge</p>
                <p className="font-black text-brand-ink">Thai reply + Korean nuance</p>
              </div>
              <Languages className="size-5 text-brand-mint" />
            </div>
          </motion.div>
        </div>

        <div className="landing-rail">
          <span>TH</span>
          <span>dating with context</span>
          <span>KR</span>
          <span>language before pressure</span>
          <span>safety before spark</span>
        </div>
      </motion.section>
    </main>
  );
}
