import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ChevronLeft, Sparkles } from 'lucide-react';
import { addChild, FamilyApiError } from '@/lib/familyApi';
import { useFamilyAuth } from '@/context/FamilyAuthContext';

// date_of_birth now checked client-side for a plausible age (1-18)
// matching the backend's own validation, so the error surfaces under
// the date field itself instead of as a generic server error banner.
const schema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    date_of_birth: z.string().min(1, 'Please choose a date of birth'),
    skin_tone: z.string().min(1, 'Please choose a skin tone'),
    hair_colour: z.string().min(1, 'Please choose a hair colour'),
    hair_type: z.string().min(1, 'Please choose a hair type'),
    gender_expression: z.string().min(1, 'Please choose an option'),
    glasses: z.boolean(),
  })
  .refine(
    (data) => {
      const dob = new Date(data.date_of_birth);
      if (isNaN(dob.getTime())) return false;
      const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return age >= 1 && age <= 18;
    },
    { message: 'Please enter a date of birth for a child between 1 and 18 years old', path: ['date_of_birth'] }
  );

type FormData = z.infer<typeof schema>;

const inputClass =
  'w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-4 text-white text-base placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors';

const selectClass =
  'w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-4 text-white text-base focus:outline-none focus:border-white/30 transition-colors appearance-none';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1.5">{children}</p>;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-red-400 text-xs mt-1">{msg}</p>;
}

export default function AddChild() {
  const [, navigate] = useLocation();
  const { isParentLoggedIn } = useFamilyAuth();

  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const [serverError, setServerError] = useState('');

  if (!isParentLoggedIn) {
    navigate('/family/login');
    return null;
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { glasses: false },
  });

  const handlePinInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...pinDigits];
    next[idx] = digit;
    setPinDigits(next);
    if (digit && idx < 3) pinRefs[idx + 1].current?.focus();
  };

  const handlePinKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[idx] && idx > 0) {
      pinRefs[idx - 1].current?.focus();
    }
  };

  const onSubmit = async (data: FormData) => {
    const pin = pinDigits.join('');
    if (pin.length !== 4) {
      setServerError('Please enter a 4-digit PIN for your child.');
      return;
    }
    setServerError('');
    // Normalise the name to Title Case before saving, so it always
    // displays consistently regardless of how the parent typed it
    // (e.g. "emma", "EMMA", "emma rose" all become "Emma Rose").
    // Applied here rather than fighting the user mid-typing in the
    // input itself.
    const titleCasedName = data.name
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    try {
      await addChild({
        name: titleCasedName,
        date_of_birth: data.date_of_birth,
        pin,
        appearance_profile: {
          skin_tone: data.skin_tone,
          hair_colour: data.hair_colour,
          hair_type: data.hair_type,
          gender_expression: data.gender_expression,
          glasses: data.glasses,
        },
      });
      navigate('/family/dashboard');
    } catch (err) {
      if (err instanceof FamilyApiError) {
        setServerError(err.message || 'Something went wrong. Please check the details and try again.');
      } else {
        setServerError('Something went wrong. Please try again in a moment.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/8 via-transparent to-orange-900/4" />
      </div>

      <div className="relative z-10 flex items-center px-4 h-12 border-b border-white/5">
        <button
          onClick={() => navigate('/family/dashboard')}
          className="flex items-center gap-1 text-white/40 hover:text-white/70 text-sm transition-colors min-h-[44px] px-1 -ml-1"
        >
          <ChevronLeft size={18} />
          Back
        </button>
        <div className="flex-1 flex justify-center">
          <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Add a child</span>
        </div>
        <div className="w-16" />
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto pb-32">
        <div className="max-w-sm mx-auto px-4 pt-6">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Who's joining the story?</h1>
              <p className="text-white/35 text-sm mt-1.5 leading-relaxed">
                Fill in a few details so we can personalise every story especially for them.
              </p>
            </div>

            <div>
              <FieldLabel>Child's name</FieldLabel>
              <input
                {...register('name')}
                type="text"
                autoCapitalize="words"
                placeholder="e.g. Amara"
                className={`${inputClass} ${errors.name ? 'border-red-500/50' : ''}`}
              />
              <FieldError msg={errors.name?.message} />
            </div>

            <div>
              <FieldLabel>Date of birth</FieldLabel>
              <input
                {...register('date_of_birth')}
                type="date"
                className={`${inputClass} ${errors.date_of_birth ? 'border-red-500/50' : ''}`}
              />
              <FieldError msg={errors.date_of_birth?.message} />
            </div>

            <div>
              <FieldLabel>Reading PIN</FieldLabel>
              <p className="text-white/35 text-xs mb-3 leading-relaxed">
                Choose a 4-digit number your child will use to start reading. Make it easy for them to remember —
                their age, a lucky number, anything they'll know.
              </p>
              <div className="flex gap-3 justify-center">
                {pinDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={pinRefs[idx]}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinInput(idx, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(idx, e)}
                    className="w-14 h-14 text-center text-xl font-black bg-white/6 border border-white/12 rounded-2xl text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                ))}
              </div>
              {pinDigits.join('').length > 0 && pinDigits.join('').length < 4 && (
                <p className="text-white/25 text-xs text-center mt-2">Enter all 4 digits</p>
              )}
            </div>

            <div className="space-y-4">
              <div
                className="rounded-2xl px-4 py-3 flex items-start gap-3"
                style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}
              >
                <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-white/55 text-xs leading-relaxed">
                  The details below help our illustrators personalise the story artwork so your child sees themselves
                  as the hero. You can update these any time.
                </p>
              </div>

              <div>
                <FieldLabel>Skin tone</FieldLabel>
                <select {...register('skin_tone')} className={`${selectClass} ${errors.skin_tone ? 'border-red-500/50' : ''}`}>
                  <option value="">Choose one…</option>
                  <option value="light">Light</option>
                  <option value="medium-light">Medium light</option>
                  <option value="medium">Medium</option>
                  <option value="medium-dark">Medium dark</option>
                  <option value="dark">Dark</option>
                </select>
                <FieldError msg={errors.skin_tone?.message} />
              </div>

              <div>
                <FieldLabel>Hair colour</FieldLabel>
                <select {...register('hair_colour')} className={`${selectClass} ${errors.hair_colour ? 'border-red-500/50' : ''}`}>
                  <option value="">Choose one…</option>
                  <option value="black">Black</option>
                  <option value="dark-brown">Dark brown</option>
                  <option value="brown">Brown</option>
                  <option value="light-brown">Light brown</option>
                  <option value="blonde">Blonde</option>
                  <option value="red">Red / Auburn</option>
                  <option value="grey">Grey / Silver</option>
                  <option value="white">White / Platinum</option>
                  <option value="other">Other</option>
                </select>
                <FieldError msg={errors.hair_colour?.message} />
              </div>

              <div>
                <FieldLabel>Hair type</FieldLabel>
                <select {...register('hair_type')} className={`${selectClass} ${errors.hair_type ? 'border-red-500/50' : ''}`}>
                  <option value="">Choose one…</option>
                  <option value="straight">Straight</option>
                  <option value="wavy">Wavy</option>
                  <option value="curly">Curly</option>
                  <option value="coily">Coily / Afro</option>
                  <option value="locs">Locs</option>
                  <option value="shaved">Very short / Shaved</option>
                </select>
                <FieldError msg={errors.hair_type?.message} />
              </div>

              <div>
                <FieldLabel>Gender expression</FieldLabel>
                <select
                  {...register('gender_expression')}
                  className={`${selectClass} ${errors.gender_expression ? 'border-red-500/50' : ''}`}
                >
                  <option value="">Choose one…</option>
                  <option value="feminine">Feminine</option>
                  <option value="masculine">Masculine</option>
                  <option value="neutral">Neutral</option>
                  <option value="other">Prefer not to say</option>
                </select>
                <FieldError msg={errors.gender_expression?.message} />
              </div>

              <div className="flex items-center gap-3">
                <input
                  {...register('glasses')}
                  type="checkbox"
                  id="glasses"
                  className="w-5 h-5 rounded-md border border-white/20 bg-white/6 accent-amber-500 cursor-pointer"
                />
                <label htmlFor="glasses" className="text-white/60 text-sm cursor-pointer select-none">
                  Wears glasses
                </label>
              </div>
            </div>

            {serverError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{serverError}</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-20 px-4 pt-3"
        style={{ background: 'linear-gradient(to top, #0a0a0a 70%, transparent)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-sm mx-auto">
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="w-full py-4 rounded-2xl font-black text-base uppercase tracking-widest bg-amber-500 text-black disabled:opacity-50 transition-opacity"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Saving…
              </span>
            ) : 'Add to my family →'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
