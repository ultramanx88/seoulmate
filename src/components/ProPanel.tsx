import { createElement, useEffect, useState } from 'react';
import { CheckCircle2, Crown, Filter, Images, Languages, LockKeyhole, Map, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Badge } from './ui/badge';

type FeatureState = {
  enabled: boolean;
  limit: number | null;
  period: 'day' | 'month' | null;
  used: number | null;
  remaining: number | null;
  resetAt: string | null;
};

type EntitlementPayload = {
  plan: 'free' | 'pro' | 'pro_unlimited';
  entitlements: Record<string, FeatureState>;
};

const proFeatures = [
  { icon: Filter, title: 'Advanced filters', detail: 'Filter by intent, language, active status, and city.' },
  { icon: Languages, title: 'More AI translation', detail: 'Higher allowance for Thai/Korean nuance and replies.' },
  { icon: Images, title: 'Custom AI sticker packs', detail: 'Save your own generated stickers and unlock them while Pro is active.' },
  { icon: LockKeyhole, title: 'Private mode', detail: 'Control who can discover you as the network grows.' },
  { icon: Map, title: 'Travel mode', detail: 'Prepare connections around Seoul, Bangkok, Chiang Mai, and Busan.' },
  { icon: Sparkles, title: 'Profile review', detail: 'Monthly AI profile polish focused on trust, not hype.' },
  { icon: ShieldCheck, title: 'Same safety layer', detail: 'Safety, reporting, and blocking stay available to everyone.' },
];

const stripePricingTableId = ((import.meta as any).env?.VITE_STRIPE_PRICING_TABLE_ID ?? 'prctbl_1TuakZKBsyjRnliaFmokLqrk') as string;
const stripePublishableKey = ((import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY ?? 'pk_test_51TuaMPKBsyjRnliaHDhiyCl56EFgCk4Fp5yk1YcQqk6fdi5OWnQozsVZGTn5iHN0kU6a7kbRQaL9CwasnXn6SJlf009hU4yAbc') as string;
const stripeCustomerPortalUrl = ((import.meta as any).env?.VITE_STRIPE_CUSTOMER_PORTAL_URL ?? 'https://billing.stripe.com/p/login/test_28E8wQ5KWc3m4jI6hG7AI00') as string;

export default function ProPanel() {
  const { profile } = useAuth();
  const [data, setData] = useState<EntitlementPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!document.querySelector('script[src="https://js.stripe.com/v3/pricing-table.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/pricing-table.js';
      script.async = true;
      document.body.appendChild(script);
    }

    apiRequest<EntitlementPayload>('/v1/me/entitlements')
      .then(setData)
      .catch(() => toast.error('Could not load plan details'))
      .finally(() => setLoading(false));
  }, []);

  const plan = data?.plan ?? 'free';
  const isUnlimited = plan === 'pro_unlimited';
  const translation = data?.entitlements.ai_translations_daily;
  const discover = data?.entitlements.discover_profiles_daily;
  const chats = data?.entitlements.new_chats_daily;

  return (
    <div className="px-5 pb-24 pt-6">
      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-coral/20 bg-brand-blush px-3 py-1.5 text-xs font-bold text-brand-coral">
              <Crown className="size-3.5" /> Seoulmate Pro
            </div>
            <h2 className="text-3xl font-extrabold leading-tight text-brand-ink">
              Better signal, more control.
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">
              Pro is designed for people who want richer filters, more cross-language help, and calmer privacy controls.
            </p>
          </div>
          <Badge variant="outline" className={plan !== 'free' ? 'border-brand-mint/40 bg-brand-mint/20 text-brand-ink' : 'border-border'}>
            {isUnlimited ? 'Superadmin unlimited' : plan === 'pro' ? 'Pro active' : 'Free plan'}
          </Badge>
        </div>

        <div className="mt-5 grid gap-2 rounded-2xl border border-border bg-muted/35 p-3">
          {loading ? (
            <p className="px-2 py-4 text-sm font-semibold text-muted-foreground">Loading usage...</p>
          ) : (
            [
              ['Discovery', discover],
              ['New chats', chats],
              ['AI translation', translation],
            ].map(([label, feature]) => (
              <div key={label as string} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                <span className="font-bold text-foreground">{label as string}</span>
                <span className="font-semibold text-muted-foreground">
                  {(feature as FeatureState | undefined)?.limit === null
                    ? isUnlimited ? 'Unlimited admin' : 'Unlimited'
                    : `${(feature as FeatureState | undefined)?.remaining ?? 0} left`}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-brand-coral/15 bg-brand-blush p-4 shadow-sm">
          <p className="text-sm font-extrabold text-brand-ink">Early access pricing draft</p>
          <div className="mt-2 grid gap-2 text-sm font-semibold text-muted-foreground">
            <p>Thailand: THB 199 / month</p>
            <p>Korea: KRW 7,900 / month</p>
            <p>International: USD 6.99 / month</p>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-sm">
          {createElement('stripe-pricing-table', {
            'pricing-table-id': stripePricingTableId,
            'publishable-key': stripePublishableKey,
            'client-reference-id': profile?.uid ?? profile?.id,
            'customer-email': profile?.email ?? undefined,
          })}
        </div>

        <a
          href={stripeCustomerPortalUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-white text-sm font-extrabold text-brand-ink transition hover:bg-muted"
        >
          Manage billing
        </a>
      </section>

      <section className="mt-5 space-y-3">
        {proFeatures.map((feature) => (
          <div key={feature.title} className="flex gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <feature.icon className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-foreground">{feature.title}</h3>
                {plan !== 'free' && <CheckCircle2 className="size-4 text-brand-mint" />}
              </div>
              <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">{feature.detail}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
