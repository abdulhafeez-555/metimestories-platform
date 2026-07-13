import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const inputClass =
  "w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-base text-[#1c0a00] placeholder:text-gray-400 focus:outline-none focus:border-orange-400 transition-colors";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[#1c0a00]/60 text-xs font-bold uppercase tracking-widest mb-1.5">{children}</p>;
}

function ErrorBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
      <p className="text-red-500 text-sm">{msg}</p>
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

export default function AuthorLogin() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [authorId, setAuthorId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email address and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/author/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw Object.assign(new Error(data.error || "Login failed"), { status: res.status });
      setAuthorId(data.author_id);
      setStep("code");
    } catch (err: any) {
      setError(friendlyError(err, err?.status));
    } finally {
      setLoading(false);
    }
  };

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !authorId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/author/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author_id: authorId, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw Object.assign(new Error(data.error || "Verification failed"), { status: res.status });
      localStorage.setItem("author_token", data.token);
      localStorage.setItem("author", JSON.stringify(data.author));
      navigate("/author/dashboard");
    } catch (err: any) {
      if (err?.status === 401) {
        setError("That code doesn't match, or it may have expired. Request a new one below.");
      } else {
        setError(friendlyError(err, err?.status));
      }
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!email || !password) { setStep("credentials"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/author/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend");
      setAuthorId(data.author_id);
      setCode("");
      setError("");
    } catch {
      setError("Couldn't send a new code — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fff8f0] text-[#1c0a00] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <p className="text-2xl font-extrabold text-[#1c0a00]" style={{ fontFamily: "Georgia, serif" }}>Me Time Stories</p>
          <p className="text-xs font-medium text-orange-600 tracking-widest uppercase">Author Portal</p>
        </div>

        <div className="rounded-[28px] bg-white p-8 shadow-2xl">
          <AnimatePresence mode="wait">
            {step === "credentials" ? (
              <motion.form
                key="credentials"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleCredentials}
                className="space-y-4"
              >
                <div className="mb-4">
                  <h1 className="text-3xl font-black tracking-tight mb-2" style={{ fontFamily: "Georgia, serif" }}>Sign in</h1>
                  <p className="text-sm text-gray-600">Enter your email and password to continue.</p>
                </div>

                <div>
                  <FieldLabel>Email address</FieldLabel>
                  <input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
                </div>

                <div>
                  <FieldLabel>Password</FieldLabel>
                  <input type="password" autoComplete="current-password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required />
                </div>

                <ErrorBox msg={error} />

                <button type="submit" disabled={loading} className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 px-7 py-4 text-base font-extrabold text-[#1a0800] shadow-xl transition hover:scale-[1.02] disabled:opacity-50">
                  {loading ? <span className="flex items-center justify-center gap-2"><i className="ri-loader-4-line animate-spin text-lg" />Signing in...</span> : "Continue"}
                </button>

                <div className="flex items-center gap-3 my-2"><div className="flex-1 h-px bg-gray-200" /><span className="text-xs text-gray-400">OR</span><div className="flex-1 h-px bg-gray-200" /></div><GoogleSignInButton endpoint="/api/auth/author/google" redirectTo="/author/dashboard" tokenKey="author_token" userKey="author" onError={setError} /><p className="text-center text-xs text-gray-400 mt-2">
                  Don't have an account?{" "}
                  <button type="button" onClick={() => navigate("/author/register")} className="text-orange-500 hover:text-orange-600 font-semibold transition-colors">Register here</button>
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
                <div className="mb-4">
                  <h1 className="text-3xl font-black tracking-tight mb-2" style={{ fontFamily: "Georgia, serif" }}>Check your email</h1>
                  <p className="text-sm text-gray-600">We've sent a 6-digit code to <span className="font-semibold text-[#1c0a00]">{email}</span>. Codes expire after 10 minutes.</p>
                </div>

                <div>
                  <FieldLabel>Verification code</FieldLabel>
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter code" value={code} onChange={(e) => setCode(e.target.value)} className={`${inputClass} text-center text-xl tracking-[0.3em]`} maxLength={6} />
                </div>

                <ErrorBox msg={error} />

                <button type="submit" disabled={loading || !code.trim()} className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 px-7 py-4 text-base font-extrabold text-[#1a0800] shadow-xl transition hover:scale-[1.02] disabled:opacity-50">
                  {loading ? <span className="flex items-center justify-center gap-2"><i className="ri-loader-4-line animate-spin text-lg" />Verifying...</span> : "Sign in"}
                </button>

                <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                  <button type="button" onClick={() => { setStep("credentials"); setError(""); setCode(""); }} className="hover:text-gray-600 transition-colors">Back</button>
                  <button type="button" onClick={resendCode} disabled={loading} className="text-orange-500 hover:text-orange-600 font-semibold transition-colors disabled:opacity-40">Resend code</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}



