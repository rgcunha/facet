"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useId,
  useSyncExternalStore,
} from "react";
import { runCost } from "@/lib/cv/format";
import type { Run } from "@/lib/cv/schema";
import type { ModelOption } from "@/lib/llm/models";

const ModelsContext = createContext<{
  models: ModelOption[];
  error: string | null;
}>({ models: [], error: "No model list: render inside a ModelsProvider." });

/**
 * The models from LLM_MODELS, read on the server, for every picker and result label below. `error`
 * says what's wrong with LLM_MODELS when there are none, so the pickers can show it.
 */
export function ModelsProvider({
  models,
  error,
  children,
}: {
  models: ModelOption[];
  error: string | null;
  children: ReactNode;
}) {
  return <ModelsContext value={{ models, error }}>{children}</ModelsContext>;
}

/*
 * One choice for the whole app: every picker shows it, and it's remembered in this browser. Read from
 * localStorage once, then kept in memory, because localStorage can be unavailable (private windows,
 * blocked site data).
 */
const KEY = "cv-tool.model";
const listeners = new Set<() => void>();
let chosen: string | null | undefined; // undefined: not read yet

function current() {
  if (chosen === undefined)
    try {
      chosen = localStorage.getItem(KEY);
    } catch {
      chosen = null; // unavailable: the default, and choices last for this visit
    }
  return chosen;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function choose(id: string) {
  chosen = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // unavailable: the choice lasts until the page is closed
  }
  listeners.forEach((listener) => listener());
}

/**
 * The picked model, or the default (the first in LLM_MODELS) when none is picked or it was removed.
 * Undefined when LLM_MODELS is broken; the call then fails with that error.
 */
export function useModel(): ModelOption | undefined {
  const { models } = useContext(ModelsContext);
  const id = useSyncExternalStore(subscribe, current, () => null);
  return models.find((m) => m.id === id) ?? models[0];
}

/** The files in public/logos, named after the OpenRouter id prefix. */
const LOGOS = new Set([
  "anthropic",
  "deepseek",
  "google",
  "meta-llama",
  "mistralai",
  "openai",
  "qwen",
  "x-ai",
]);

/** The model company's official mark (bundled in public/logos). Decorative: the name is always beside it. */
function VendorLogo({ vendor }: { vendor: string }) {
  if (LOGOS.has(vendor))
    // eslint-disable-next-line @next/next/no-img-element -- a 20px local SVG needs no image optimisation
    return <img src={`/logos/${vendor}.svg`} alt="" className="size-5" />;
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className="text-muted"
    >
      <rect x="5" y="5" width="14" height="14" rx="3" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </svg>
  );
}

/** The one Model picker beside a button that calls the model. */
export function ModelPicker({
  disabled,
  inline,
}: {
  disabled?: boolean;
  /** Label beside the select instead of above it, for toolbars. */
  inline?: boolean;
}) {
  const { models, error } = useContext(ModelsContext);
  const model = useModel();
  const tiersId = useId();
  if (!model)
    return (
      <p role="alert" className="max-w-xs text-[13px] text-danger">
        {error}
      </p>
    );
  return (
    <label
      className={
        inline ? "flex items-center gap-2 text-[13px] text-muted" : "label"
      }
    >
      Model
      <span className="flex items-center gap-2">
        <VendorLogo vendor={model.vendor} />
        <select
          className="input w-auto"
          value={model.id}
          onChange={(e) => choose(e.target.value)}
          disabled={disabled}
          aria-describedby={tiersId}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.tier}
            </option>
          ))}
        </select>
      </span>
      {/* Read out instead of "dollar dollar dollar". */}
      <span id={tiersId} hidden>
        Cost per run: $ under 1 cent, $$ 1 to 5 cents, $$$ over 5 cents.
      </span>
    </label>
  );
}

/** Which model wrote a result and what it cost: "[logo] DeepSeek V4.1 Flash · $0.004". */
export function RunInfo({ run }: { run: Run }) {
  const listed = useContext(ModelsContext).models.find(
    (m) => m.id === run.model,
  );
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
      {/* A model since removed from LLM_MODELS gets the generic icon. */}
      <VendorLogo vendor={listed?.vendor ?? ""} />
      {listed?.name ?? run.model} · {runCost(run)}
    </span>
  );
}
