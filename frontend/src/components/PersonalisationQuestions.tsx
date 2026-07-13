import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type { PersonalisationField } from '@/lib/familyApi';

// ─────────────────────────────────────────────────────────────
//  PersonalisationQuestions
//
//  ONE reusable component, used in two places:
//    1. Story flow — child answers ONE field at a time, mid-story,
//       using age-appropriate wording, then the parent component
//       retries story generation automatically.
//    2. Parent dashboard — parent reviews/edits ALL profile fields
//       at once, ahead of time, using adult wording.
//
//  Field-type aware: text / number / color / select all render
//  differently. Falls back gracefully when a field has no
//  age_prompts_json entry for the child's age band (e.g. colour
//  pickers are age-neutral and never have age-specific wording).
// ─────────────────────────────────────────────────────────────

export interface QuestionFieldDef extends PersonalisationField {
  existingValue?: string;
}

interface PersonalisationQuestionsProps {
  fields: QuestionFieldDef[];
  ageBand?: string; // only needed when context === 'child', for wording lookup
  context: 'child' | 'parent';
  mode: 'one-at-a-time' | 'all-at-once';
  onSave: (answers: { field_key: string; value: string }[]) => Promise<void>;
  saving?: boolean;
  submitLabel?: string;
}

const COLOUR_PRESETS = [
  { name: 'Red', hex: '#E74C3C' },
  { name: 'Orange', hex: '#E67E22' },
  { name: 'Yellow', hex: '#F1C40F' },
  { name: 'Green', hex: '#2ECC71' },
  { name: 'Blue', hex: '#3498DB' },
  { name: 'Purple', hex: '#9B59B6' },
  { name: 'Pink', hex: '#E91E63' },
  { name: 'Black', hex: '#2C2C2C' },
];

function getQuestionText(field: QuestionFieldDef, ageBand?: string): string {
  // Age-adaptive wording when available and we're in the child context
  if (ageBand && field.age_adaptive && field.age_prompts_json) {
    try {
      const prompts =
        typeof field.age_prompts_json === 'string'
          ? JSON.parse(field.age_prompts_json)
          : field.age_prompts_json;
      if (prompts[ageBand]) return prompts[ageBand];
    } catch {
      // fall through to label
    }
  }
  // Graceful fallback — plain label (e.g. colour fields, which are
  // age-neutral by nature and never have age_prompts_json entries)
  return field.label;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: QuestionFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const baseInputClass =
    'w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-4 text-white text-base placeholder:text-white/25 focus:outline-none focus:border-amber-500/50 transition-colors';

  switch (field.field_type) {
    case 'color':
      return (
        <div className="grid grid-cols-4 gap-2.5">
          {COLOUR_PRESETS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => onChange(c.name.toLowerCase())}
              className="flex flex-col items-center gap-1.5 transition-all"
              aria-label={c.name}
            >
              <div
                className="w-full aspect-square rounded-2xl transition-all"
                style={{
                  background: c.hex,
                  border: value === c.name.toLowerCase() ? '3px solid white' : '3px solid transparent',
                  transform: value === c.name.toLowerCase() ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: value === c.name.toLowerCase() ? '0 0 0 1px rgba(255,255,255,0.3)' : 'none',
                }}
              />
              <span
                className="text-[10px] font-bold"
                style={{ color: value === c.name.toLowerCase() ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)' }}
              >
                {c.name}
              </span>
            </button>
          ))}
        </div>
      );

    case 'select': {
      let options: string[] = [];
      try {
        options = typeof field.options_json === 'string' ? JSON.parse(field.options_json) : field.options_json ?? [];
      } catch {
        options = [];
      }
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseInputClass} appearance-none`}
        >
          <option value="">Choose one…</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    case 'number':
      return (
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClass}
        />
      );

    case 'image':
      // Photo upload personalisation is deliberately out of scope for V1
      // (see DPF spec — appearance profile is the V1 mechanism instead).
      // Render nothing actionable rather than a broken/misleading control.
      return (
        <p className="text-white/30 text-sm italic">
          Photo upload isn't available yet — this will be added in a future update.
        </p>
      );

    case 'text':
    default:
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer…"
          className={baseInputClass}
          autoFocus
        />
      );
  }
}

export default function PersonalisationQuestions({
  fields,
  ageBand,
  context,
  mode,
  onSave,
  saving = false,
  submitLabel,
}: PersonalisationQuestionsProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.field_key, f.existingValue ?? '']))
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localSaving, setLocalSaving] = useState(false);
  const [error, setError] = useState('');

  const isChildOneAtATime = mode === 'one-at-a-time';
  const currentField = isChildOneAtATime ? fields[currentIndex] : null;

  const setAnswer = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleOneAtATimeNext = async () => {
    if (!currentField) return;
    const value = answers[currentField.field_key]?.trim();
    if (!value) {
      setError('Please fill this in before continuing.');
      return;
    }
    setError('');
    setLocalSaving(true);
    try {
      await onSave([{ field_key: currentField.field_key, value }]);
      if (currentIndex < fields.length - 1) {
        setCurrentIndex((i) => i + 1);
      }
      // When this was the last field, the parent component (the page)
      // is responsible for noticing all fields are answered and moving
      // the user forward (e.g. retrying story generation).
    } catch {
      setError('Something went wrong saving that. Please try again.');
    } finally {
      setLocalSaving(false);
    }
  };

  const handleAllAtOnceSubmit = async () => {
    const toSave = fields
      .map((f) => ({ field_key: f.field_key, value: answers[f.field_key]?.trim() ?? '' }))
      .filter((a) => a.value.length > 0);
    if (toSave.length === 0) {
      setError('Please fill in at least one field.');
      return;
    }
    setError('');
    setLocalSaving(true);
    try {
      await onSave(toSave);
    } catch {
      setError('Something went wrong saving your changes. Please try again.');
    } finally {
      setLocalSaving(false);
    }
  };

  const isSaving = saving || localSaving;

  // ── Mode: one question at a time (child, mid-story) ──────────
  if (isChildOneAtATime && currentField) {
    const questionText = getQuestionText(currentField, ageBand);
    const showCounter = fields.length > 1;
    return (
      <motion.div
        key={currentField.field_key}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-5"
      >
        <div>
          {showCounter && (
            <p className="text-amber-300/40 text-xs font-bold uppercase tracking-widest mb-2">
              Question {currentIndex + 1} of {fields.length}
            </p>
          )}
          <h2 className="text-xl font-black text-amber-100 leading-snug">{questionText}</h2>
        </div>

        <FieldInput
          field={currentField}
          value={answers[currentField.field_key] ?? ''}
          onChange={(v) => setAnswer(currentField.field_key, v)}
        />

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleOneAtATimeNext}
          disabled={isSaving}
          className="w-full py-4 rounded-2xl font-black text-base uppercase tracking-widest bg-amber-500 text-black disabled:opacity-50 transition-opacity"
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              Saving…
            </span>
          ) : currentIndex < fields.length - 1 ? (
            'Next →'
          ) : (
            submitLabel ?? "Let's read! →"
          )}
        </motion.button>

        {/* Back button — allows a child to fix a typo on a previous
            answer without abandoning the entire story flow */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={() => {
              setError('');
              setCurrentIndex((i) => i - 1);
            }}
            disabled={isSaving}
            className="w-full text-center text-xs text-amber-300/30 hover:text-amber-300/60 transition-colors disabled:opacity-40 py-1"
          >
            ← Go back
          </button>
        )}
      </motion.div>
    );
  }

  // ── Mode: all fields at once (parent dashboard) ──────────────
  return (
    <div className="space-y-6">
      {fields.map((field) => (
        <div key={field.field_key}>
          <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1.5">{field.label}</p>
          <FieldInput
            field={field}
            value={answers[field.field_key] ?? ''}
            onChange={(v) => setAnswer(field.field_key, v)}
          />
        </div>
      ))}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleAllAtOnceSubmit}
        disabled={isSaving}
        className="w-full py-4 rounded-2xl font-black text-base uppercase tracking-widest bg-amber-500 text-black disabled:opacity-50 transition-opacity"
      >
        {isSaving ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" />
            Saving…
          </span>
        ) : (
          submitLabel ?? 'Save changes →'
        )}
      </motion.button>
    </div>
  );
}
