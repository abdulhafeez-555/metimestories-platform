import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRoute, useLocation } from 'wouter';
import { Loader2, ChevronLeft } from 'lucide-react';
import {
  getPersonalisationFields,
  getChildProfile,
  savePersonalisationAnswers,
  type PersonalisationField,
} from '@/lib/familyApi';
import { useFamilyAuth } from '@/context/FamilyAuthContext';
import { formatName } from '@/lib/formatName';
import PersonalisationQuestions, { type QuestionFieldDef } from '@/components/PersonalisationQuestions';

// Parent-facing version of the same question flow used mid-story by
// the child. Shows every profile-scoped field at once, pre-filled
// with whatever's already saved, so a parent can review or update
// anything ahead of time rather than only being prompted for gaps.
export default function EditChildProfile() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/family/child/:childId/profile');
  const childId = Number(params?.childId ?? 0);

  const { isParentLoggedIn } = useFamilyAuth();

  const [fields, setFields] = useState<QuestionFieldDef[]>([]);
  const [childName, setChildName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (!isParentLoggedIn || !childId) return;

    Promise.all([getPersonalisationFields(), getChildProfile(childId)])
      .then(([fieldsRes, profileRes]) => {
        setChildName(formatName(profileRes.child_name));

        // Only genuine personalisation fields belong on this page.
        // Three field_keys are deliberately excluded even though they
        // share scope='profile' in the database:
        //   - child_name : captured on the Add Child form itself, and
        //     always the actual child record's name — never a separate
        //     "answer" a parent re-enters here.
        //   - child_age  : NEVER a stored answer at all — age is always
        //     derived dynamically from date_of_birth. Showing it as an
        //     editable field would be actively misleading.
        //   - child_photo: photo-based personalisation is out of scope
        //     for V1 (see DPF spec) — appearance profile on the Add
        //     Child form is the V1 mechanism instead.
        const EXCLUDED_IDENTITY_FIELDS = new Set(['child_name', 'child_age', 'child_photo']);

        const profileFields = fieldsRes.fields.filter(
          (f: PersonalisationField) => f.scope === 'profile' && !EXCLUDED_IDENTITY_FIELDS.has(f.field_key)
        );

        const existingByKey = new Map(profileRes.profile.map((p) => [p.field_key, p.value]));

        const merged: QuestionFieldDef[] = profileFields.map((f) => ({
          ...f,
          existingValue: existingByKey.get(f.field_key) ?? '',
        }));

        setFields(merged);
      })
      .catch(() => setError("We couldn't load this profile right now. Please try again."))
      .finally(() => setLoading(false));
  }, [childId, isParentLoggedIn]);

  const handleSave = async (answers: { field_key: string; value: string }[]) => {
    await savePersonalisationAnswers(childId, answers);
    setSavedMessage('Saved! Your changes will be used the next time a story is personalised.');
    setTimeout(() => setSavedMessage(''), 4000);
  };

  if (!isParentLoggedIn) {
    navigate('/family/login');
    return null;
  }

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
          <span className="text-white/40 text-xs font-bold uppercase tracking-widest">
            {childName ? `${childName}'s profile` : 'Profile'}
          </span>
        </div>
        <div className="w-16" />
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto pb-12">
        <div className="max-w-sm mx-auto px-4 pt-7">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-white/20" />
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  Tell us about {childName}
                </h1>
                <p className="text-white/35 text-sm mt-1.5 leading-relaxed">
                  These details help personalise every story. You can update them any time — nothing here is
                  permanent.
                </p>
              </div>

              {savedMessage && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-5">
                  <p className="text-amber-300 text-sm">{savedMessage}</p>
                </div>
              )}

              {fields.length === 0 ? (
                <p className="text-white/30 text-sm">No personalisation fields are set up yet.</p>
              ) : (
                <PersonalisationQuestions
                  fields={fields}
                  context="parent"
                  mode="all-at-once"
                  onSave={handleSave}
                  saving={saving}
                  submitLabel="Save changes →"
                />
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
