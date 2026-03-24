import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";

import type { StorageAdapter } from "@z-dev-toolbox/storage";

export const useToolDraftState = <T,>(
  storage: StorageAdapter,
  key: string,
  initialValue: T,
) => {
  const [draft, setDraft] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const changedBeforeHydrateRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadDraft = async () => {
      try {
        const stored = await storage.getItem<T>(key);

        if (cancelled || changedBeforeHydrateRef.current || stored === null) {
          return;
        }

        setDraft(stored);
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    void loadDraft();

    return () => {
      cancelled = true;
    };
  }, [key, storage]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void storage.setItem(key, draft);
  }, [draft, hydrated, key, storage]);

  const updateDraft: Dispatch<SetStateAction<T>> = (value) => {
    if (!hydrated) {
      changedBeforeHydrateRef.current = true;
    }

    setDraft(value);
  };

  return [draft, updateDraft, hydrated] as const;
};
