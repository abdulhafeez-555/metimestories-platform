import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoute, useLocation } from 'wouter';
import { Loader2, ChevronLeft, ChevronRight, MessageCircle, BookOpen } from 'lucide-react';
import {
  generateStory,
  savePersonalisationAnswers,
  getPersonalisationFields,
  FamilyApiError,
  type GeneratedStory,
  type MissingField,
  type PersonalisationField,
} from '@/lib/familyApi';
import { useFamilyAuth } from '@/context/FamilyAuthContext';
import { formatName } from '@/lib/formatName';
import PersonalisationQuestions, { type QuestionFieldDef } from '@/components/PersonalisationQuestions';

function discussionText(raw: string | null | object): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    const vals = Object.values(raw as Record<string, unknown>);
    const strs = vals.filter((v): v is string => typeof v === 'string');
    return strs.length ? strs.join('\n\n') : null;
  }
  return null;
}

export default function FamilyStoryReader() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/family/story/:storyId');
  const storyId = Number(params?.storyId ?? 0);

  const { child, isChildLoggedIn, isParentLoggedIn } = useFamilyAuth();

  const [story, setStory] = useState<GeneratedStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Personalising your story…');
  const [error, setError] = useState('');
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [allFields, setAllFields] = useState<PersonalisationField[]>([]);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);

  // Pulled out so both the initial load AND the post-answer retry
  // can call exactly the same logic — one source of truth, not two
  // copies of "try to generate, handle 422, handle success" drifting
  // apart over time.
  const attemptGenerate = (childId: number, sId: number, isRetry = false) => {
    if (!isRetry) setLoading(true);
    setError('');

    return generateStory(childId, sId)
      .then((res) => {
        setStory(res);
        setMissingFields([]);
        return true;
      })
      .catch((err) => {
        if (err instanceof FamilyApiError) {
          if (err.status === 422 && err.missingFields?.length) {
            setMissingFields(err.missingFields);
            setError('profile_incomplete');
          } else {
            setError(err.message || 'Something went wrong loading this story.');
          }
        } else {
          setError('Something went wrong loading this story. Please go back and try again.');
        }
        return false;
      })
      .finally(() => {
        if (!isRetry) setLoading(false);
      });
  };

  useEffect(() => {
    if (!isChildLoggedIn || !isParentLoggedIn || !storyId || !child) return;

    const msgTimer = setTimeout(() => setLoadingMsg('Almost ready — adding the magic touches…'), 4000);

    // Fetch real field definitions alongside the story attempt so that
    // if a 422 fires, we have the actual field type, options, and
    // age-adaptive wording ready — not fabricated text-only placeholders.
    Promise.all([
      attemptGenerate(child.id, storyId),
      getPersonalisationFields().then((res) => setAllFields(res.fields)).catch(() => {}),
    ]).finally(() => clearTimeout(msgTimer));

    return () => clearTimeout(msgTimer);
  }, [storyId, isChildLoggedIn, isParentLoggedIn]);

  // Called by PersonalisationQuestions after EVERY individual answer is
  // saved (one-at-a-time mode). We re-check with the backend each time
  // rather than counting client-side, because the backend is the single
  // source of truth for what's actually missing — this avoids the form
  // and the database ever disagreeing about completion state.
  const handleAnswerSaved = async (answers: { field_key: string; value: string }[]) => {
    if (!child) return;
    setSavingAnswer(true);
    try {
      await savePersonalisationAnswers(child.id, answers);
      const succeeded = await attemptGenerate(child.id, storyId, true);
      if (!succeeded) {
        // Still missing more fields — PersonalisationQuestions will
        // already be showing the next one, since missingFields updates.
      }
    } finally {
      setSavingAnswer(false);
    }
  };

  // Synchronous render-time guards — run during render, not after,
  // so navigation fires before anything else mounts.
  if (!isChildLoggedIn) {
    navigate('/family/child-login');
    return null;
  }
  if (!isParentLoggedIn) {
    navigate('/family/login');
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(160deg, #110900 0%, #0d0700 100%)' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <motion.div
            animate={{ rotate: [0, 10, -8, 6, -4, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="text-6xl mb-6"
          >
            ✨
          </motion.div>
          <Loader2 size={28} className="animate-spin text-amber-500/60 mx-auto mb-4" />
          <p className="text-amber-200 font-bold text-lg">{loadingMsg}</p>
          <p className="text-amber-300/40 text-sm mt-2">Making it just for {formatName(child?.name)}</p>
        </motion.div>
      </div>
    );
  }

  // Missing fields — now an interactive question flow instead of a dead end.
  // The child answers one field at a time, in age-appropriate wording,
  // and story generation automatically retries after each answer.
  if (error === 'profile_incomplete' && child) {
    const EXCLUDED = new Set(['child_name', 'child_age', 'child_photo']);

    // Build real field definitions by matching the 422 missing_fields keys
    // against the full field list fetched on mount. This gives us the
    // actual field_type (color/select/text), options_json, and
    // age_prompts_json — so a missing favourite_colour renders as
    // colour swatches, not a plain text box, and age-appropriate wording
    // is used for the child's actual age band.
    const questionFields: QuestionFieldDef[] = missingFields
      .filter((f) => !EXCLUDED.has(f.key))
      .map((f) => {
        const realDef = allFields.find((af) => af.field_key === f.key);
        return realDef
          ? { ...realDef, existingValue: '' }
          : {
              field_key: f.key,
              label: f.label,
              field_type: 'text' as const,
              scope: 'profile' as const,
              age_adaptive: false,
              age_prompts_json: null,
              options_json: null,
              sort_order: 0,
              existingValue: '',
            };
      });

    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #110900 0%, #0d0700 100%)' }}>
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/5 shrink-0">
          <button
            onClick={() => navigate('/family/stories')}
            className="flex items-center gap-1 text-white/30 hover:text-white/60 text-sm transition-colors min-h-[44px] px-1 -ml-1"
          >
            <ChevronLeft size={17} />
            Library
          </button>
          <div className="w-16" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-10">
          <div className="max-w-sm mx-auto">
            <div className="flex flex-col items-center text-center mb-7">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mb-4">
                <BookOpen size={26} className="text-amber-400" />
              </div>
              <h1 className="text-xl font-black text-amber-100">A few quick questions first!</h1>
              <p className="text-amber-300/50 text-sm mt-1.5">
                This helps us make {formatName(child.name)}'s story just right.
              </p>
            </div>

            <AnimatePresence mode="wait">
              <PersonalisationQuestions
                key={missingFields.map((f) => f.key).join(',')}
                fields={questionFields}
                ageBand={child.age_band}
                context="child"
                mode="one-at-a-time"
                onSave={handleAnswerSaved}
                saving={savingAnswer}
                submitLabel="Let's read! →"
              />
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(160deg, #110900 0%, #0d0700 100%)' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm">
          <div className="text-5xl mb-5">😕</div>
          <h2 className="text-2xl font-black text-amber-100 mb-3">Oops!</h2>
          <p className="text-amber-300/60 text-sm leading-relaxed mb-6">
            {error || "We couldn't load this story. Please go back and try again."}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/family/stories')} className="px-5 py-3 rounded-2xl font-bold text-sm bg-white/8 text-white/70 border border-white/12">
              Back to library
            </button>
            <button onClick={() => window.location.reload()} className="px-5 py-3 rounded-2xl font-bold text-sm bg-amber-500 text-black">
              Try again
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const scenes = story.scenes ?? [];
  const useScenes = scenes.length > 0;
  const totalPages = useScenes ? scenes.length + 1 : 1;
  const discussion = discussionText(story.discussion_prompts);
  const totalWithDiscussion = discussion ? totalPages + 1 : totalPages;
  const isDiscussionPage = !!discussion && page === totalPages;

  const goNext = () => {
    if (page < totalWithDiscussion - 1) {
      setDir(1);
      setPage((p) => p + 1);
    }
  };
  const goPrev = () => {
    if (page > 0) {
      setDir(-1);
      setPage((p) => p - 1);
    }
  };

  const progress = totalWithDiscussion > 1 ? page / (totalWithDiscussion - 1) : 1;

  // The DPF engine stored the child's name as typed (e.g. "emma").
  // We correct it display-side so the reader always sees "Emma"
  // regardless of what casing ended up in the database.
  const displayName = formatName(child?.name ?? '');
  const fixName = (text: string) =>
    displayName && child?.name
      ? text.replace(new RegExp(child.name.trim(), 'gi'), displayName)
      : text;

  const renderContent = () => {
    if (isDiscussionPage) {
      return (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={18} className="text-amber-400" />
            <h2 className="text-amber-200 font-black text-lg">Questions to talk about together</h2>
          </div>
          <p className="text-amber-100/75 text-base leading-relaxed whitespace-pre-line">{discussion}</p>
        </div>
      );
    }

    if (page === 0) {
      return (
        <div className="space-y-4">
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: `${story.story.value_colour}25`, color: story.story.value_colour }}
          >
            {story.story.value}
          </div>
          <h1 className="text-2xl font-black text-amber-100 leading-snug">{fixName(story.story.personalised_title)}</h1>
          {useScenes ? (
            <p className="text-amber-300/50 text-sm">Tap the arrow to start reading · {scenes.length} pages</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="text-amber-100/80 text-base leading-relaxed whitespace-pre-line">{fixName(story.story_content)}</p>
            </div>
          )}
        </div>
      );
    }

    if (useScenes && page <= scenes.length) {
      const scene = scenes[page - 1];
      return (
        <div className="space-y-3">
          <p className="text-amber-300/30 text-xs font-bold uppercase tracking-widest">Page {page}</p>
          <p className="text-amber-100/85 text-lg leading-relaxed whitespace-pre-line font-medium">{fixName(scene.content)}</p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #110900 0%, #0d0700 100%)' }}>
      <div className="flex items-center justify-between px-4 h-12 border-b border-white/5 shrink-0">
        <button onClick={() => navigate('/family/stories')} className="flex items-center gap-1 text-white/30 hover:text-white/60 text-sm transition-colors min-h-[44px] px-1 -ml-1">
          <ChevronLeft size={17} />
          Library
        </button>
        <p className="text-amber-300/40 text-xs font-bold">
          {isDiscussionPage ? 'Questions' : `${page + 1} / ${totalWithDiscussion}`}
        </p>
        <div className="w-16" />
      </div>

      <div style={{ height: 2, background: 'rgba(245,158,11,0.08)' }}>
        <motion.div
          style={{ height: '100%', background: '#f59e0b', borderRadius: 1 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-8">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={page}
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d > 0 ? '5%' : '-5%', opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d > 0 ? '-4%' : '4%', opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="max-w-lg mx-auto"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="shrink-0 flex items-center justify-between px-5 py-5 border-t border-white/5">
        <button
          onClick={goPrev}
          disabled={page === 0}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all disabled:opacity-20"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <ChevronLeft size={20} className="text-amber-300/70" />
        </button>

        <div className="flex items-center gap-1.5">
          {Array.from({ length: Math.min(totalWithDiscussion, 8) }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all"
              style={{ width: page === i ? 18 : 6, height: 6, background: page === i ? '#f59e0b' : 'rgba(245,158,11,0.20)' }}
            />
          ))}
          {totalWithDiscussion > 8 && <span className="text-amber-300/30 text-xs ml-1">…{totalWithDiscussion}</span>}
        </div>

        {page < totalWithDiscussion - 1 ? (
          <button
            onClick={goNext}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.30)' }}
          >
            <ChevronRight size={20} className="text-amber-400" />
          </button>
        ) : (
          <button
            onClick={() => navigate('/family/stories')}
            className="h-12 px-4 rounded-full flex items-center justify-center text-xs font-bold text-amber-900 transition-all"
            style={{ background: '#f59e0b' }}
          >
            The end ✨
          </button>
        )}
      </div>
    </div>
  );
}
