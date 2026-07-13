import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { Loader2, BookOpen } from 'lucide-react';
import { parentLogin, verifyParent2FA, FamilyApiError } from '@/lib/familyApi';
import { useFamilyAuth } from '@/context/FamilyAuthContext';

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
  if (status === 401) return "We couldn't find an account with those details. Please check your email and password.";
  if (status === 403) return "This account has been suspended. Please get in touch with us for help.";
  if (status === 400) return "Please fill in all fields and try again.";
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again in a moment.";
}

export default function ParentLogin() {
  const [, navigate] = useLocation();
  const { setParentSession } = useFamilyAuth();

  const [step, setStep] = useState<'credentials' | 'code'>('credentials');
  const [parentId, setParentId] = useState<number | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email address and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await parentLogin(email.trim(), password);
      setParentId(res.parent_id);
      setStep('code');
    } catch (err) {
      const status = err instanceof FamilyApiError ? err.status : undefined;
      setError(friendlyError(err, status));
    } finally {
      setLoading(false);
    }
  };

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !parentId) return;
    setLoading(true);
    setError('');
    try {
      const res = await verifyParent2FA(parentId, code.trim());
      setParentSession(res.token, res.parent);
      navigate('/family/dashboard');
    } catch (err) {
      const status = err instanceof FamilyApiError ? err.status : undefined;
      if (status === 401) {
        setError("That code doesn't match, or it may have expired (codes last 10 minutes). Request a new one below.");
      } else {
        setError(friendlyError(err, status));
      }
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!email || !password) {
      setStep('credentials');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await parentLogin(email.trim(), password);
      setParentId(res.parent_id);
      setCode('');
      setError('');
    } catch {
      setError("Could not send a new code - please check your connection and try again.");
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
            <p className="text-white/40 text-sm mt-1">Welcome back</p>
          </div>

          <div
            className="rounded-3xl p-6 space-y-5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <AnimatePresence mode="wait">
              {step === 'credentials' ? (
                <motion.form
                  key="credentials"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleCredentials}
                  className="space-y-4"
                >
                  <div>
                    <h2 className="text-lg font-bold text-white mb-1">Sign in</h2>
                    <p className="text-white/40 text-sm">Enter your email and password to continue.</p>
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
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                        Signing in...
                      </span>
                    ) : 'Continue'}
                  </motion.button>

                  <div className="flex items-center gap-3 my-2"><div className="flex-1 h-px bg-white/10" /><span className="text-xs text-white/25">OR</span><div className="flex-1 h-px bg-white/10" /></div>
                    <GoogleSignInButton endpoint="/api/auth/parent/google" redirectTo="/family/dashboard" tokenKey="family_parent_token" userKey="parent" onError={setError} />
                    <p className="text-center text-xs text-white/25">
                      Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/family/register')}
                      className="text-amber-400/70 hover:text-amber-400 transition-colors"
                    >
                      Register here
                    </button>
                  </p>
                </motion.form>
              ) : (
                <motion.form
                  key="code"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleCode}
                  className="space-y-4"
                >
                  <div>
                    <h2 className="text-lg font-bold text-white mb-1">Check your email</h2>
                    <p className="text-white/40 text-sm">
                      We've sent a verification code to <span className="text-white/60">{email}</span>. Codes expire after 10 minutes.
                    </p>
                  </div>

                  <div>
                    <FieldLabel>Verification code</FieldLabel>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className={`${inputClass} text-center text-xl tracking-[0.3em]`}
                      maxLength={6}
                    />
                  </div>

                  <ErrorBox msg={error} />

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={loading || !code.trim()}
                    className="w-full py-4 rounded-2xl font-black text-base uppercase tracking-widest bg-amber-500 text-black disabled:opacity-50 transition-opacity"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        Verifying...
                      </span>
                    ) : 'Sign in'}
                  </motion.button>

                  <div className="flex items-center justify-between text-xs text-white/30">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('credentials');
                        setError('');
                        setCode('');
                      }}
                      className="hover:text-white/50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={resendCode}
                      disabled={loading}
                      className="text-amber-400/60 hover:text-amber-400 transition-colors disabled:opacity-40"
                    >
                      Resend code
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}





