import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { Loader2, BookOpen, Plus, ChevronRight, LogOut } from 'lucide-react';
import { getChildren, type Child } from '@/lib/familyApi';
import { useFamilyAuth } from '@/context/FamilyAuthContext';
import { formatName } from '@/lib/formatName';

const AGE_BAND_LABEL: Record<string, string> = {
  little: 'Little reader',
  young: 'Young reader',
  middle: 'Growing reader',
  older: 'Confident reader',
};

const AGE_BAND_COLOUR: Record<string, string> = {
  little: 'bg-pink-500/15 text-pink-300',
  young: 'bg-purple-500/15 text-purple-300',
  middle: 'bg-blue-500/15 text-blue-300',
  older: 'bg-green-500/15 text-green-300',
};

export default function ParentDashboard() {
  const [, navigate] = useLocation();
  const { parent, isParentLoggedIn, clearParentAuth } = useFamilyAuth();

  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isParentLoggedIn) return;
    getChildren()
      .then((res) => setChildren(res.children))
      .catch(() => setError("We couldn't load your children's profiles right now. Please try again."))
      .finally(() => setLoading(false));
  }, [isParentLoggedIn]);

  if (!isParentLoggedIn) {
    navigate('/family/login');
    return null;
  }

  const handleLogout = () => {
    clearParentAuth();
    navigate('/family/login');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/8 via-transparent to-orange-900/4" />
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 h-14 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <BookOpen size={14} className="text-amber-400" />
          </div>
          <span className="text-white/70 text-sm font-bold">MeTime Stories</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-white/30 hover:text-white/60 text-xs transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto pb-8">
        <div className="max-w-lg mx-auto px-4 pt-7 space-y-7">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-white/40 text-sm mb-1">Good to see you,</p>
            <h1 className="text-3xl font-black text-white tracking-tight">{formatName(parent?.first_name ?? '')}</h1>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/family/add-child')}
            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-colors"
            style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.20)' }}
          >
            <span className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Plus size={16} className="text-amber-400" />
              </span>
              <span className="text-amber-300 font-bold text-sm">Add a child</span>
            </span>
            <ChevronRight size={16} className="text-amber-400/50" />
          </motion.button>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4">
              {children.length === 0 && !loading ? 'No children yet' : `Your children (${children.length})`}
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={28} className="animate-spin text-white/20" />
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            ) : children.length === 0 ? (
              <div
                className="rounded-2xl px-5 py-8 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <p className="text-white/30 text-sm leading-relaxed">
                  Add your first child to get started with personalised bedtime stories.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {children.map((child, i) => (
                  <motion.div
                    key={child.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + i * 0.06 }}
                    className="rounded-2xl px-5 py-4 flex items-center justify-between"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center shrink-0">
                        <span className="text-lg">{formatName(child.name)[0]?.toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-bold text-base truncate">{formatName(child.name)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-white/40 text-xs">Age {child.age}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              AGE_BAND_COLOUR[child.age_band] ?? 'bg-white/10 text-white/50'
                            }`}
                          >
                            {AGE_BAND_LABEL[child.age_band] ?? child.age_band}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <button
                        onClick={() => navigate(`/family/child/${child.id}/profile`)}
                        className="text-white/30 hover:text-white/55 text-xs font-bold transition-colors"
                      >
                        Edit profile
                      </button>
                      <button
                        onClick={() =>
                          navigate(
                            `/family/child-login?parentId=${parent?.id}&childId=${child.id}&childName=${encodeURIComponent(
                              formatName(child.name)
                            )}`
                          )
                        }
                        className="flex items-center gap-1.5 text-amber-400 text-xs font-bold hover:text-amber-300 transition-colors"
                      >
                        Read together
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
