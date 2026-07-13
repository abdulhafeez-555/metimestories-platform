import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { Loader2, BookOpen } from 'lucide-react';
import { registerParent, FamilyApiError } from '@/lib/familyApi';

const inputClass =
  'w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-4 text-white text-base placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1.5">{children}</p>;
}

function ErrorBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
      <p className="text-red-400 text-sm">{msg}</p>
    </div>
  );
}

function friendlyError(err: unknown, status?: number): string {
  if (status === 409) return "An account with that email address already exists. Try signing in instead.";
  if (status === 422 || status === 400) return "Please fill in all fields correctly and try again.";
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again in a moment.";
}

export default function ParentRegister() {
  const [, navigate] = useLocation();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Your password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match - please check and try again.");
      return;
    }

    setLoading(true);
    try {
      await registerParent({
        first_name: firstName.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        last_name: lastName.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        email: email.trim().toLowerCase(),
        password,
      });
      setDone(true);
    } catch (err) {
      const status = err instanceof FamilyApiError ? err.status : undefined;
      setError(friendlyError(err, status));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/10 via-transparent to-orange-900/5" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mb-4">
              <BookOpen size={28} className="text-amber-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">MeTime Stories</h1>
            <p className="text-white/40 text-sm mt-1">Create your family account</p>
          </div>

          <div
            className="rounded-3xl p-6 space-y-5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {done ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-5 text-center py-4"
              >
                <div className="w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto">
                  <span className="text-2xl">âœ¨</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white mb-2">Account created</h2>
                  {/* Corrected copy - matches the real backend flow:
                      no confirmation link is sent, only a 2FA code on sign-in */}
                  <p className="text-white/45 text-sm leading-relaxed">
                    Your family account is ready, <span className="text-white/65">{email}</span>.
                    Sign in with your email and password to get your verification code.
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/family/login')}
                  className="w-full py-4 rounded-2xl font-black text-base uppercase tracking-widest bg-amber-500 text-black"
                >
                  Go to sign in
                </motion.button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Create account</h2>
                  <p className="text-white/40 text-sm">One account for your whole family.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>First name</FieldLabel>
                    <input
                      type="text"
                      autoComplete="given-name"
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel>Last name</FieldLabel>
                    <input
                      type="text"
                      autoComplete="family-name"
                      placeholder="Smith"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>Email address</FieldLabel>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <FieldLabel>Password</FieldLabel>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <FieldLabel>Confirm password</FieldLabel>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <ErrorBox msg={error} />

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl font-black text-base uppercase tracking-widest bg-amber-500 text-black disabled:opacity-50 transition-opacity"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      Creating account...
                    </span>
                  ) : 'Create account'}
                </motion.button>

                <p className="text-center text-xs text-white/25">
                  <div className="flex items-center gap-3 my-2"><div className="flex-1 h-px bg-white/10" /><span className="text-xs text-white/25">OR</span><div className="flex-1 h-px bg-white/10" /></div>
                    <GoogleSignInButton endpoint="/api/auth/parent/google" redirectTo="/family/dashboard" tokenKey="family_parent_token" userKey="parent" onError={setError} />
                      Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/family/login')}
                    className="text-amber-400/70 hover:text-amber-400 transition-colors"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}


