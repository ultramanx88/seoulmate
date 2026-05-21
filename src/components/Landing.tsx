import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { motion } from 'motion/react';
import { Globe2 } from 'lucide-react';

export default function Landing() {
  const { login } = useAuth();

  return (
    <div className="h-screen bg-rose-50 flex flex-col items-center justify-center px-6 overflow-hidden relative">
        {/* Abstract background shapes */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-100 rounded-full blur-[120px] opacity-30" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-rose-200 rounded-full blur-[120px] opacity-40" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center z-10"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 vibrant-gradient rounded-[2rem] mb-8 shadow-2xl shadow-rose-200 ring-8 ring-white/50">
            <Globe2 className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-6xl font-black tracking-tighter mb-4 italic leading-none">
            SEOUL<span className="text-indigo-600">MATE</span>
        </h1>
        <p className="text-gray-500 font-bold mb-12 max-w-xs mx-auto text-lg leading-tight uppercase tracking-tight">
            The vibrant cross-cultural <span className="text-rose-500">connection</span> hub.
        </p>

        <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
            <Button 
                onClick={login}
                size="lg"
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black h-16 rounded-2xl shadow-xl shadow-rose-200 transition-all active:scale-95 text-lg"
            >
                Login with Google
            </Button>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">
                Start your vibrant journey today
            </p>
        </div>
      </motion.div>

      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-12 text-zinc-300 font-black italic opacity-20 select-none">
        <span className="text-2xl">🇹🇭 THAILAND</span>
        <span className="text-2xl">KOREA 🇰🇷</span>
      </div>
    </div>
  );
}
