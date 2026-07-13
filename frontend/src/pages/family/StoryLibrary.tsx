import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { Loader2, Clock, LogOut } from 'lucide-react';
import { getStoryValues, getStories, type StoryValue, type Story } from '@/lib/familyApi';
import { useFamilyAuth } from '@/context/FamilyAuthContext';
import { formatName } from '@/lib/formatName';

// Replace {{placeholder}} tokens in a story title using
// only what we already know about the child client-side â€”
// no DPF engine call, no backend round-trip. The full
// personalisation (all fields, age variants, image prompts)
// still happens properly when the child actually opens the
// story via /api/story-generation. This is display-only.
function previewTitle(title: string, childName: string): string {
  return title.replace(/\{\{child_name\}\}/gi, childName);
}

export default function StoryLibrary() {
  const [, navigate] = useLocation();
  const { child, isChildLoggedIn, clearChildAuth } = useFamilyAuth();

  const [values, setValues] = useState<StoryValue[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isChildLoggedIn) return;
    Promise.all([getStoryValues(), getStories()])
      .then(([vRes, sRes]) => {
        setValues(vRes.values);
        setStories(sRes.stories);
      })
      .catch(() => setError("We couldn't load the story library right now. Please try again."))
      .finally(() => setLoading(false));
  }, [isChildLoggedIn]);

  // Synchronous render-time guard â€” runs during the render itself,
  // not after it, so navigation fires before anything else mounts.
  if (!isChildLoggedIn) {
    navigate('/family/child-login');
    return null;
  }

  const ageAppropriate = stories.filter(
    (s) => child && child.age >= s.age_min && child.age <= s.age_max
  );
  const displayed = activeValue
    ? ageAppropriate.filter((s) => s.value_label.toLowerCase() === activeValue.toLowerCase())
    : ageAppropriate;

  const handleLogout = () => {
    clearChildAuth();
    navigate('/family/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #110900 0%, #0d0700 100%)' }}>
      <div className="flex items-center justify-between px-4 h-14 border-b border-white/5">
        <div>
          <p className="text-amber-300/60 text-xs">Welcome back,</p>
          <p className="text-amber-100 font-black text-base leading-tight">{formatName(child?.name)}</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-white/25 hover:text-white/50 text-xs transition-colors">
          <LogOut size={13} />
          Switch reader
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={32} className="animate-spin text-amber-500/40" />
          </div>
        ) : error ? (
          <div className="max-w-sm mx-auto px-4 pt-8">
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4 text-center">
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={() => window.location.reload()} className="text-red-300/60 text-xs mt-3 hover:text-red-300 transition-colors">
                Try again
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 pt-6 pb-2">
              <h1 className="text-2xl font-black text-amber-100 tracking-tight">Choose a story</h1>
              <p className="text-amber-300/40 text-sm mt-1">Every story is written just for you, {formatName(child?.name)}</p>
            </div>

            {values.length > 0 && (
              <div className="px-4 pb-4">
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
                  <button
                    onClick={() => setActiveValue(null)}
                    className="shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all"
                    style={{
                      background: activeValue === null ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.06)',
                      border: `1.5px solid ${activeValue === null ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.10)'}`,
                      color: activeValue === null ? '#fde68a' : 'rgba(255,255,255,0.40)',
                    }}
                  >
                    All stories
                  </button>
                  {values.map((v) => {
                    const active = activeValue === v.label;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setActiveValue(active ? null : v.label)}
                        className="shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all"
                        style={{
                          background: active ? `${v.colour_hex}30` : 'rgba(255,255,255,0.06)',
                          border: `1.5px solid ${active ? `${v.colour_hex}80` : 'rgba(255,255,255,0.10)'}`,
                          color: active ? v.colour_hex : 'rgba(255,255,255,0.40)',
                        }}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="px-4 space-y-3">
              {displayed.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/25 text-sm">No stories found for this theme yet.</p>
                </div>
              ) : (
                displayed.map((story, i) => (
                  <motion.button
                    key={story.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/family/story/${story.id}`)}
                    className="w-full text-left rounded-2xl overflow-hidden transition-opacity"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="flex gap-4 p-4">
                      <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden" style={{ background: `${story.value_colour}20` }}>
                        {story.thumbnail_url ? (
                          <img src={story.thumbnail_url} alt={story.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">ðŸ“–</div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-white font-bold text-base leading-snug">
                            {previewTitle(story.title, formatName(child?.name ?? ''))}
                          </h3>
                        </div>
                        <p className="text-white/40 text-xs leading-relaxed line-clamp-2 mb-2">{story.synopsis}</p>
                        <div className="flex items-center gap-3">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${story.value_colour}25`, color: story.value_colour }}
                          >
                            {story.value_label}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-white/30">
                            <Clock size={10} />
                            {story.reading_time_mins} min
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

