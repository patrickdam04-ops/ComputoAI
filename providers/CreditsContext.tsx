"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/nextjs";

type CreditsContextType = {
  credits: number;
  loading: boolean;
  deductCredits: (amount: number) => void;
  refreshCredits: () => Promise<void>;
};

const CreditsContext = createContext<CreditsContextType>({
  credits: 0,
  loading: true,
  deductCredits: () => {},
  refreshCredits: async () => {},
});

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const { isSignedIn } = useAuth();

  const refreshCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits");
      if (res.ok) {
        const data = (await res.json()) as { credits_balance: number };
        setCredits(data.credits_balance);
      }
    } catch (err) {
      console.error("Error fetching credits:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const deductCredits = useCallback((amount: number) => {
    setCredits((prev) => Math.max(0, prev - amount));
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      refreshCredits();
    }
  }, [isSignedIn, refreshCredits]);

  return (
    <CreditsContext.Provider
      value={{ credits, loading, deductCredits, refreshCredits }}
    >
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  return useContext(CreditsContext);
}
