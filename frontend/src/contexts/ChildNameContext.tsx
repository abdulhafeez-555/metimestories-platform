import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface ChildNameContextValue {
  childName: string | null;
  setChildName: (name: string) => void;
  clearChildName: () => void;
  promptOpen: boolean;
  openPrompt: () => void;
  closePrompt: () => void;
}

const ChildNameContext = createContext<ChildNameContextValue>({
  childName: null,
  setChildName: () => {},
  clearChildName: () => {},
  promptOpen: false,
  openPrompt: () => {},
  closePrompt: () => {},
});

const SESSION_KEY = "mts_child_name_session";
const SKIPPED_KEY = "mts_welcome_skipped";
const OLD_LS_KEY = "mts_child_name";

export function ChildNameProvider({ children }: { children: ReactNode }) {
  const [childName, setChildNameState] = useState<string | null>(() => {
    try {
      // Remove any previously persisted name from localStorage immediately.
      // This clears the leakage for any visitor who had a name stuck from a
      // prior permanent storage write.
      localStorage.removeItem(OLD_LS_KEY);
      // Use sessionStorage only — scoped to this tab, cleared on close.
      return sessionStorage.getItem(SESSION_KEY) || null;
    } catch {
      return null;
    }
  });
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    if (childName) return;
    try {
      if (sessionStorage.getItem(SKIPPED_KEY)) return;
    } catch {}
    const t = setTimeout(() => setPromptOpen(true), 1800);
    return () => clearTimeout(t);
  }, []);

  const setChildName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setChildNameState(null);
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {}
      return;
    }
    const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    setChildNameState(capitalised);
    try {
      sessionStorage.setItem(SESSION_KEY, capitalised);
    } catch {}
  };

  const clearChildName = () => {
    setChildNameState(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  };

  const openPrompt = () => setPromptOpen(true);

  const closePrompt = () => {
    setPromptOpen(false);
    try {
      sessionStorage.setItem(SKIPPED_KEY, "1");
    } catch {}
  };

  return (
    <ChildNameContext.Provider value={{ childName, setChildName, clearChildName, promptOpen, openPrompt, closePrompt }}>
      {children}
    </ChildNameContext.Provider>
  );
}

export function useChildName() {
  return useContext(ChildNameContext);
}
