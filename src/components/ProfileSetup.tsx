import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { CheckCircle2, HeartHandshake, Languages, Loader2, MapPin, ShieldCheck } from 'lucide-react';

export default function ProfileSetup({ existingProfile }: { existingProfile?: any }) {
  const { user, refreshProfile } = useAuth();
  const [nationality, setNationality] = useState<'TH' | 'KR' | ''>(existingProfile?.nationality || '');
  const [intent, setIntent] = useState<'dating' | 'friendship' | 'exchange' | ''>(existingProfile?.intent || '');
  const [bio, setBio] = useState(existingProfile?.bio || '');
  const [displayName, setDisplayName] = useState(existingProfile?.displayName || user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSave = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setErrorMessage('');

    if (!nationality || !intent) {
      setErrorMessage('Choose where you are from and what kind of connection you want first.');
      toast.error("Please complete the required choices");
      return;
    }

    setSaving(true);
    try {
      await apiRequest('/v1/me/profile', {
        method: 'PUT',
        body: JSON.stringify({
          displayName,
          nationality,
          intent,
          bio,
        }),
      });
      
      await refreshProfile();
      toast.success("Profile saved!");
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : 'Profile could not be saved. Please try again.');
      toast.error("Error saving profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-5 pb-24 pt-6">
      <div className="mb-7 rounded-3xl border border-border bg-white p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-brand-coral">Trust profile</p>
            <h2 className="text-2xl font-black leading-tight text-foreground">
              {existingProfile ? 'Update your connection style' : 'Set your first signal'}
            </h2>
          </div>
        </div>
        <p className="text-sm font-medium leading-6 text-muted-foreground">
          Tell people just enough to understand your intent before the first message. You can edit this later.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-brand-coral" />
            <Label className="text-sm font-extrabold text-foreground">Where are you from?</Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'TH', label: 'Thailand', detail: 'ไทย' },
              { id: 'KR', label: 'Korea', detail: '한국' },
            ].map((option) => {
              const selected = nationality === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setNationality(option.id as 'TH' | 'KR')}
                  className={`min-h-28 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected
                      ? 'border-primary bg-white shadow-[var(--shadow-soft)]'
                      : 'border-border bg-white/75 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-foreground">{option.label}</span>
                    {selected && <CheckCircle2 className="size-5 text-primary" />}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-muted-foreground">{option.detail}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <HeartHandshake className="size-4 text-brand-coral" />
            <Label className="text-sm font-extrabold text-foreground">What are you open to?</Label>
          </div>
          <div className="space-y-3">
            {[
              { id: 'dating', label: 'Dating', desc: 'Clear romantic intent with respectful pacing' },
              { id: 'friendship', label: 'Friendship', desc: 'Meet people socially before pressure' },
              { id: 'exchange', label: 'Language exchange', desc: 'Practice culture and conversation first' },
            ].map((option) => {
              const selected = intent === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setIntent(option.id as 'dating' | 'friendship' | 'exchange')}
                  className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected
                      ? 'border-brand-ink bg-brand-lilac text-brand-ink shadow-sm'
                      : 'border-border bg-white hover:border-brand-ink/30'
                  }`}
                >
                  <div className={`flex size-10 flex-shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-white' : 'bg-accent'}`}>
                    {option.id === 'exchange' ? <Languages className="size-5" /> : <HeartHandshake className="size-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold leading-tight">{option.label}</p>
                    <p className={`mt-1 text-sm leading-5 ${selected ? 'text-brand-ink/75' : 'text-muted-foreground'}`}>{option.desc}</p>
                  </div>
                  {selected && <CheckCircle2 className="size-5 flex-shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-border bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm font-extrabold text-foreground">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-12 rounded-xl border-border bg-background px-4 font-semibold focus-visible:ring-ring"
              placeholder="Min-Jun K"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio" className="text-sm font-extrabold text-foreground">Short intro</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="min-h-28 rounded-xl border-border bg-background p-4 font-medium leading-6 focus-visible:ring-ring"
              placeholder="A calm first hello, favorite neighborhood, or language goal."
            />
          </div>
        </section>

        {errorMessage && (
          <div role="alert" className="rounded-2xl border border-destructive/20 bg-white p-4 text-sm font-semibold leading-6 text-destructive">
            {errorMessage}
          </div>
        )}

        <Button
          type="submit"
          disabled={saving || !nationality || !intent}
          className="h-14 w-full rounded-2xl bg-primary text-base font-black text-primary-foreground shadow-[var(--shadow-soft)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" />
              Saving profile
            </>
          ) : (
            'Continue to Seoulmate'
          )}
        </Button>
      </form>
    </div>
  );
}
