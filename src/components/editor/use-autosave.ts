"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { saveCvAction } from "@/app/actions";
import type { EditorValues } from "@/lib/cv/schema";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

const DELAY_MS = 800;

/**
 * Saves the form 800 ms after the last change. `flush` saves right away and resolves to whether it
 * succeeded (used before export).
 */
export function useAutosave(form: UseFormReturn<EditorValues>, id: string) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Edits are counted; `saved` is the count the last successful save covered.
  const edits = useRef(0);
  const saved = useRef(0);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const upTo = edits.current;
    setStatus("saving");
    try {
      await saveCvAction(id, form.getValues());
      saved.current = Math.max(saved.current, upTo);
      setStatus(edits.current === saved.current ? "saved" : "unsaved");
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }, [form, id]);

  useEffect(() => {
    const { unsubscribe } = form.watch(() => {
      edits.current++;
      setStatus("unsaved");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, DELAY_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer.current); // a stale save must not fire after the editor is gone (e.g. remounted)
    };
  }, [form, flush]);

  // Unsaved edits when leaving: in-app navigation saves them; closing or reloading the tab gets the browser's warning.
  useEffect(() => {
    const hasUnsaved = () => edits.current !== saved.current;
    const warn = (e: BeforeUnloadEvent) => {
      if (hasUnsaved()) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (hasUnsaved()) void flush();
    };
  }, [flush]);

  return { status, flush };
}
