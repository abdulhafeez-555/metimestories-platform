import { createContext, useContext, useState, ReactNode } from 'react';
import {
  type Parent,
  type ChildSession,
  getParentToken,
  setParentToken,
  clearParentToken,
  getChildToken,
  setChildToken,
  clearChildToken,
} from '@/lib/familyApi';

const PARENT_OBJ_KEY = 'family_parent_obj';
const CHILD_OBJ_KEY = 'family_child_obj';

interface FamilyAuthContextValue {
  parent: Parent | null;
  child: ChildSession | null;
  isParentLoggedIn: boolean;
  isChildLoggedIn: boolean;
  setParentSession: (token: string, parent: Parent) => void;
  setChildSession: (token: string, child: ChildSession) => void;
  clearParentAuth: () => void;
  clearChildAuth: () => void;
}

const FamilyAuthContext = createContext<FamilyAuthContextValue | undefined>(undefined);

// Read any existing session from localStorage SYNCHRONOUSLY, at module
// load time / component initialisation — not inside a useEffect.
//
// This is the actual fix for the bug where logging in correctly, then
// navigating to the dashboard, would immediately bounce back to the
// login page (and the same for child PIN login bouncing back to the
// PIN screen). The old code always initialised state to `null` and
// only restored it from storage inside a useEffect, which runs AFTER
// the first render. setParentSession()/navigate() on the login page
// happen in the same tick — so the dashboard's very first render saw
// the still-null initial state and its own guard immediately redirected
// back to login, even though the login had genuinely already succeeded
// and localStorage already had the correct token written to it.
//
// Reading storage directly in useState's initialiser instead means the
// VERY FIRST render of any page already has the correct, current
// session — there is no "stale null" window for a guard to misfire in.
function readStoredParent(): Parent | null {
  const token = getParentToken();
  const stored = localStorage.getItem(PARENT_OBJ_KEY);
  if (!token || !stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    clearParentToken();
    return null;
  }
}

function readStoredChild(): ChildSession | null {
  const token = getChildToken();
  const stored = localStorage.getItem(CHILD_OBJ_KEY);
  if (!token || !stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    clearChildToken();
    return null;
  }
}

export function FamilyAuthProvider({ children }: { children: ReactNode }) {
  const [parent, setParent] = useState<Parent | null>(readStoredParent);
  const [child, setChild] = useState<ChildSession | null>(readStoredChild);

  const setParentSession = (token: string, parentData: Parent) => {
    setParentToken(token);
    localStorage.setItem(PARENT_OBJ_KEY, JSON.stringify(parentData));
    setParent(parentData);
  };

  const setChildSession = (token: string, childData: ChildSession) => {
    setChildToken(token);
    localStorage.setItem(CHILD_OBJ_KEY, JSON.stringify(childData));
    setChild(childData);
  };

  const clearParentAuth = () => {
    clearParentToken();
    localStorage.removeItem(PARENT_OBJ_KEY);
    setParent(null);
  };

  const clearChildAuth = () => {
    clearChildToken();
    localStorage.removeItem(CHILD_OBJ_KEY);
    setChild(null);
  };

  return (
    <FamilyAuthContext.Provider
      value={{
        parent,
        child,
        isParentLoggedIn: parent !== null,
        isChildLoggedIn: child !== null,
        setParentSession,
        setChildSession,
        clearParentAuth,
        clearChildAuth,
      }}
    >
      {children}
    </FamilyAuthContext.Provider>
  );
}

export function useFamilyAuth(): FamilyAuthContextValue {
  const ctx = useContext(FamilyAuthContext);
  if (!ctx) throw new Error('useFamilyAuth must be used inside a FamilyAuthProvider');
  return ctx;
}
