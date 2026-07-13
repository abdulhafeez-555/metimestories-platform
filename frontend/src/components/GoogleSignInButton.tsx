import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleSignInButtonProps {
  endpoint: "/api/auth/parent/google" | "/api/auth/author/google";
  redirectTo: string;
  tokenKey: string;
  userKey: string;
  onError?: (message: string) => void;
}

export default function GoogleSignInButton({
  endpoint,
  redirectTo,
  tokenKey,
  userKey,
  onError,
}: GoogleSignInButtonProps) {
  const [, navigate] = useLocation();
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error("VITE_GOOGLE_CLIENT_ID is not set in the frontend .env file.");
      return;
    }

    const handleCredentialResponse = async (response: any) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: response.credential }),
        });
        const data = await res.json();
        if (!res.ok) {
          onError?.(data.error || "Google sign-in failed. Please try again.");
          return;
        }
        localStorage.setItem(tokenKey, data.token);
        localStorage.setItem(userKey, JSON.stringify(data.parent || data.author));
        navigate(redirectTo);
      } catch {
        onError?.("Something went wrong signing in with Google. Please try again.");
      }
    };

    const initGoogle = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
        shape: "pill",
      });
    };

    if (window.google) {
      initGoogle();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          initGoogle();
        }
      }, 100);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={buttonRef} className="flex justify-center" />;
}
