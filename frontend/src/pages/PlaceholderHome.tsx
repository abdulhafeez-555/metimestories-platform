import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';

// Temporary placeholder homepage. The real marketing homepage is
// integrated later, deliberately deferred until the family pages
// are fully proven end to end (see Phase 3 of the agreed plan).
export default function PlaceholderHome() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm"
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto mb-5">
          <BookOpen size={28} className="text-amber-400" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight mb-2">Me Time Stories</h1>
        <p className="text-white/40 text-sm mb-8">
          Every child deserves to be the hero of their own bedtime story.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => navigate('/family/register')}
            className="w-full py-4 rounded-2xl font-black text-base uppercase tracking-widest bg-amber-500 text-black"
          >
            Create account →
          </button>
          <button
            onClick={() => navigate('/family/login')}
            className="w-full py-4 rounded-2xl font-bold text-sm text-white/50 border border-white/12"
          >
            Sign in
          </button>
        </div>
        <p className="text-white/20 text-xs mt-8">
          Placeholder homepage — the real marketing site is integrated later.
        </p>
      </motion.div>
    </div>
  );
}
