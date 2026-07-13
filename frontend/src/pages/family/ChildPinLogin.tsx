import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useSearch } from 'wouter';
import { childLogin } from '@/lib/familyApi';
import { useFamilyAuth } from '@/context/FamilyAuthContext';
import { formatName } from '@/lib/formatName';

const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'] as const;

export default function ChildPinLogin() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { parent, setChildSession, isChildLoggedIn } = useFamilyAuth();

  // useSearch() from wouter reads query params reactively — unlike
  // window.location.search which can be stale after navigation events.
  const params = new URLSearchParams(search);
  const parentId = Number(params.get('parentId') ?? parent?.id ?? 0);
  const childId = Number(params.get('childId') ?? 0);
  const childName = formatName(params.get('childName')) || 'you';

  // If child is already logged in (e.g. session restored from localStorage),
  // skip the PIN screen entirely and go straight to stories.
  if (isChildLoggedIn) {
    navigate('/family/stories');
    return null;
  }

  const [digits, setDigits] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleKey = (key: (typeof KEYS)[number]) => {
    if (loading) return;
    if (key === 'del') {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (key === null) return;
    if (digits.length >= 4) return;
    const next = [...digits, String(key)];
    setDigits(next);
    if (next.length === 4) attemptLogin(next.join(''));
  };

  const attemptLogin = async (pin: string) => {
    if (!childId || !parentId) return;
    setLoading(true);
    try {
      const res = await childLogin(parentId, childId, pin);
      setChildSession(res.token, res.child);
      navigate('/family/stories');
    } catch {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setDigits([]);
        setLoading(false);
      }, 600);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: 'linear-gradient(135deg, #1a0e00 0%, #0d0800 50%, #1a1000 100%)' }}
    >
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {[...Array(18)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-amber-300"
            style={{
              width: Math.random() * 3 + 1,
              height: Math.random() * 3 + 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 80}%`,
              opacity: 0,
            }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: Math.random() * 3 + 2, repeat: Infinity, delay: Math.random() * 4 }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-8">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="text-5xl mb-4">📖</div>
          <h1 className="text-3xl font-black text-amber-100 tracking-tight">Hi, {childName}!</h1>
          <p className="text-amber-300/60 text-base mt-2">Enter your reading PIN to start</p>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={shake ? 'shake' : 'normal'}
            animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.45 }}
            className="flex items-center gap-4"
          >
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: digits[i] ? 1.15 : 1,
                  backgroundColor: shake ? 'rgb(239 68 68)' : digits[i] ? 'rgb(245 158 11)' : 'rgba(255,255,255,0.12)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="w-5 h-5 rounded-full"
              />
            ))}
          </motion.div>
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 w-full"
        >
          {KEYS.map((key, idx) => {
            if (key === null) return <div key={idx} />;
            const isDel = key === 'del';
            return (
              <motion.button
                key={idx}
                whileTap={{ scale: 0.88 }}
                onClick={() => handleKey(key)}
                disabled={loading}
                className="h-16 rounded-2xl flex items-center justify-center text-2xl font-black transition-colors active:opacity-70 disabled:opacity-40"
                style={{
                  background: isDel ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.10)',
                  border: `1.5px solid ${isDel ? 'rgba(255,255,255,0.08)' : 'rgba(245,158,11,0.20)'}`,
                  color: isDel ? 'rgba(255,255,255,0.40)' : '#fde68a',
                  fontSize: isDel ? 16 : 28,
                }}
              >
                {isDel ? '⌫' : key}
              </motion.button>
            );
          })}
        </motion.div>

        {loading && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-amber-300/60 text-sm">
            Opening your stories…
          </motion.p>
        )}

        <button
          onClick={() => navigate('/family/dashboard')}
          className="text-xs text-white/20 hover:text-white/40 transition-colors mt-2"
        >
          Wrong child? Go back
        </button>
      </div>
    </div>
  );
}
