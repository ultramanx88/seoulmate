import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { toast } from 'sonner';

export default function ProfileSetup({ existingProfile }: { existingProfile?: any }) {
  const { user, refreshProfile } = useAuth();
  const [nationality, setNationality] = useState<'TH' | 'KR' | ''>(existingProfile?.nationality || '');
  const [intent, setIntent] = useState<'dating' | 'friendship' | 'exchange' | ''>(existingProfile?.intent || '');
  const [bio, setBio] = useState(existingProfile?.bio || '');
  const [displayName, setDisplayName] = useState(existingProfile?.displayName || user?.displayName || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nationality || !intent) {
      toast.error("Please select your nationality and intent");
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user!.uid), {
        uid: user!.uid,
        displayName,
        photoURL: user!.photoURL,
        nationality,
        intent,
        bio,
        isProfileComplete: true,
        lastActiveAt: serverTimestamp(),
        createdAt: existingProfile ? existingProfile.createdAt : serverTimestamp(),
      }, { merge: true });
      
      await refreshProfile();
      toast.success("Profile saved!");
    } catch (error) {
      console.error(error);
      toast.error("Error saving profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 pb-24">
      <h2 className="text-4xl font-black tracking-tight mb-2 text-gray-800 italic">
        {existingProfile ? 'Edit Profile' : 'Soul Setup'}
      </h2>
      <p className="text-gray-500 mb-8 font-bold uppercase text-xs tracking-widest">Connect your vibrant personality.</p>

      <div className="space-y-8">
        <div className="space-y-4">
            <Label className="text-[10px] uppercase font-black text-rose-500 tracking-[0.2em] text-center block">Where are you from?</Label>
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={() => setNationality('TH')}
                    className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 shadow-xl ${
                        nationality === 'TH' ? 'border-rose-500 bg-white shadow-rose-200/50' : 'border-white bg-white/50 shadow-gray-100 hover:border-rose-100'
                    }`}
                >
                    <span className="text-4xl transform transition-transform group-hover:scale-110">🇹🇭</span>
                    <span className="font-black uppercase text-[10px] tracking-widest text-rose-600">Thailand</span>
                </button>
                <button 
                    onClick={() => setNationality('KR')}
                    className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 shadow-xl ${
                        nationality === 'KR' ? 'border-indigo-600 bg-white shadow-indigo-100/50' : 'border-white bg-white/50 shadow-gray-100 hover:border-indigo-100'
                    }`}
                >
                    <span className="text-4xl transform transition-transform group-hover:scale-110">🇰🇷</span>
                    <span className="font-black uppercase text-[10px] tracking-widest text-indigo-600">Korea</span>
                </button>
            </div>
        </div>

        <div className="space-y-4">
            <Label className="text-[10px] uppercase font-black text-rose-500 tracking-[0.2em] text-center block">What's your intent?</Label>
            <div className="flex flex-col gap-3">
                {[
                    { id: 'dating', label: 'Dating & Romance', desc: 'Find your Seoulmate', color: 'bg-rose-500' },
                    { id: 'friendship', label: 'New Friends', desc: 'Socialize & Vibe', color: 'bg-indigo-600' },
                    { id: 'exchange', label: 'Culture & Language', desc: 'Swap Knowledge', color: 'bg-amber-500' }
                ].map((option) => (
                    <button
                        key={option.id}
                        onClick={() => setIntent(option.id as any)}
                        className={`p-5 rounded-2xl border-2 transition-all text-left flex justify-between items-center shadow-lg ${
                            intent === option.id ? 'border-gray-800 bg-gray-800 text-white' : 'border-white bg-white hover:border-rose-100'
                        }`}
                    >
                        <div>
                            <div className="font-black italic text-lg leading-tight">{option.label}</div>
                            <div className={`text-[10px] font-bold uppercase tracking-tight ${intent === option.id ? 'text-gray-400' : 'text-gray-500'}`}>{option.desc}</div>
                        </div>
                        <div className={`w-3 h-3 rounded-full transition-all ${intent === option.id ? 'bg-rose-500' : 'bg-gray-100'}`} />
                    </button>
                ))}
            </div>
        </div>

        <div className="space-y-4">
          <Label className="text-[10px] uppercase font-black text-rose-500 tracking-[0.2em]">Display Name</Label>
          <Input 
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded-2xl border-white bg-white h-14 font-bold shadow-xl shadow-rose-100/20 px-6 focus-visible:ring-rose-500"
            placeholder="Min-Jun K"
          />
        </div>

        <div className="space-y-4">
          <Label className="text-[10px] uppercase font-black text-rose-500 tracking-[0.2em]">Bio</Label>
          <Textarea 
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="rounded-2xl border-white bg-white min-h-[120px] font-bold shadow-xl shadow-rose-100/20 p-6 focus-visible:ring-rose-500"
            placeholder="Tell us something soul-stirring!"
          />
        </div>

        <Button 
            onClick={handleSave}
            disabled={saving}
            className="w-full h-16 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-2xl shadow-2xl shadow-rose-200 transition-all text-lg"
        >
            {saving ? 'Synchronizing...' : 'Launch soul'}
        </Button>
      </div>
    </div>
  );
}
