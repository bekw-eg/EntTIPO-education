"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "@/components/providers/AccountProvider";
import type { LearningRoadView } from "@/lib/learning-road/types";

export function useLearningRoad() {
  const { user } = useAccount();
  const userId = user?.id;
  const [road, setRoad] = useState<LearningRoadView | null>(null);
  const [error, setError] = useState(false);
  const requestRef = useRef(0);
  const reload = useCallback(async () => {
    if (!userId) return;
    const requestId = ++requestRef.current;
    try {
      const response = await fetch("/api/learning-road", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const value: LearningRoadView = await response.json();
      if (requestRef.current === requestId) { setRoad(value); setError(false); }
    } catch { if (requestRef.current === requestId) setError(true); }
  }, [userId]);
  useEffect(() => {
    setRoad(null); setError(false); void reload();
    const requests = requestRef;
    const refresh = () => { void reload(); };
    window.addEventListener("focus", refresh);
    return () => { requests.current++; window.removeEventListener("focus", refresh); };
  }, [reload]);
  return { road, error, reload };
}
