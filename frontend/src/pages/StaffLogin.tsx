import { useState } from "react";
import { useLocation } from "wouter";

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

export default function StaffLogin() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [staffId, setStaffId] = useState<number | null>(null);
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
      const res = await fetch("/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw Object.assign(new Error(data.error || "Login failed"), { status: res.status });
      setStaffId(data.staff_id);
      setStep("code");
    } catch (err: any) {
      if (err?.status === 401) {
        setError("We couldn't find an account with those details.");
      } else if (err?.status === 403) {
        setError("This account has been suspended.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !staffId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/staff/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: staffId, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw Object.assign(new Error(data.error || "Verification failed"), { status: res.status });
      localStorage.setItem("staff_token", data.token);
      localStorage.setItem("staff", JSON.stringify(data.staff));
      navigate("/staff/reviews");
    } catch (err: any) {
      setError("That code doesn't match, or it may have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fff8f0] text-[#1c0a00] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <p className="text-2xl font-extrabold text-[#1c0a00]" style={{ fontFamily: "Georgia, serif" }}>Me Time Stories</p>
          <p className="text-xs font-medium text-orange-600 tracking-widest uppercase">Editorial Review</p>
        </div>

        <div className="rounded-[28px] bg-white p-8 shadow-2xl">
          {step === "credentials" ? (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div className="mb-4">
                <h1 className="text-3xl font-black tracking-tight mb-2" style={{ fontFamily: "Georgia, serif" }}>Staff sign in</h1>
                <p className="text-sm text-gray-600">Internal access only.</p>
              </div>

              <div>
                <FieldLabel>Email address</FieldLabel>
                <input type="email" autoComplete="email" placeholder="you@metimestories.co.uk" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
              </div>

              <div>
                <FieldLabel>Password</FieldLabel>
                <input type="password" autoComplete="current-password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required />
              </div>

              <ErrorBox msg={error} />

              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 px-7 py-4 text-base font-extrabold text-[#1a0800] shadow-xl transition hover:scale-[1.02] disabled:opacity-50">
                {loading ? "Signing in..." : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCode} className="space-y-4">
              <div className="mb-4">
                <h1 className="text-3xl font-black tracking-tight mb-2" style={{ fontFamily: "Georgia, serif" }}>Check your email</h1>
                <p className="text-sm text-gray-600">We've sent a 6-digit code to <span className="font-semibold text-[#1c0a00]">{email}</span>.</p>
              </div>

              <div>
                <FieldLabel>Verification code</FieldLabel>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter code" value={code} onChange={(e) => setCode(e.target.value)} className={`${inputClass} text-center text-xl tracking-[0.3em]`} maxLength={6} />
              </div>

              <ErrorBox msg={error} />

              <button type="submit" disabled={loading || !code.trim()} className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 px-7 py-4 text-base font-extrabold text-[#1a0800] shadow-xl transition hover:scale-[1.02] disabled:opacity-50">
                {loading ? "Verifying..." : "Sign in"}
              </button>

              <div className="flex items-center justify-start text-xs text-gray-400 mt-2">
                <button type="button" onClick={() => { setStep("credentials"); setError(""); setCode(""); }} className="hover:text-gray-600 transition-colors">Back</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
