"use client";

import { useRef, useState, useTransition } from "react";
import type { ImportDraft, PrivateValue } from "@/lib/cv/schema";
import { plural } from "@/lib/cv/format";
import {
  redact,
  sameValue,
  TOKEN_PATTERN,
  toMasks,
} from "@/lib/privacy/redact";
import { cancelImportAction, parseImportAction } from "../../actions";

/** Shows exactly what will be sent (same `redact` the server uses) and lets the user adjust the masks. */
export function ImportReview({ draft }: { draft: ImportDraft }) {
  const [unmasked, setUnmasked] = useState<string[]>([]);
  const [custom, setCustom] = useState<PrivateValue[]>([]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const previewRef = useRef<HTMLDivElement>(null);

  const masked = [
    ...draft.detected.filter((d) => !unmasked.includes(d.value)),
    ...custom,
  ];
  const sent = redact(draft.text, toMasks(masked));

  const toggle = (value: string) =>
    setUnmasked((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );

  const maskSelection = () => {
    const selection = window.getSelection();
    const value = selection?.toString().trim();
    if (
      !value ||
      !previewRef.current?.contains(selection!.anchorNode) ||
      TOKEN_PATTERN.test(value)
    )
      return;
    const detected = draft.detected.find((d) => sameValue(d.value, value));
    if (detected)
      setUnmasked((prev) => prev.filter((v) => v !== detected.value)); // re-mask, don't duplicate
    else if (!custom.some((c) => sameValue(c.value, value)))
      setCustom((prev) => [...prev, { kind: "custom", value }]);
    selection!.removeAllRanges();
  };

  const parse = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await parseImportAction(draft.id, masked);
      if (result) setError(result.error);
    });
  };

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-5 px-6 pt-8 pb-16">
      <button
        type="button"
        className="btn-link self-start font-semibold"
        disabled={pending}
        onClick={() => startTransition(() => cancelImportAction(draft.id))}
      >
        ← Cancel import
      </button>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight font-bold">
            Import {draft.fileName}
          </h1>
          <p className="text-muted">
            Read on this computer · {plural(draft.pageCount, "page")} ·{" "}
            {plural(masked.length, "personal detail")} masked. Check below, then
            parse.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary min-h-12 px-6 text-base"
          onClick={parse}
          disabled={pending}
        >
          {pending ? "Parsing…" : "Parse CV →"}
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger bg-white px-4 py-3 text-danger"
        >
          {error}
        </p>
      )}

      <section
        aria-labelledby="masked-h"
        className="card flex flex-col gap-3 px-5 py-4"
      >
        <h2 id="masked-h" className="text-[15px] font-bold">
          Masked: stays on this computer
        </h2>
        <ul className="flex flex-wrap gap-2">
          {[...draft.detected, ...custom].map((d) => {
            const isMasked = !unmasked.includes(d.value);
            const isCustom = custom.includes(d);
            return (
              <li
                key={d.value}
                className="flex items-center gap-1.5 rounded-full border border-line py-1 pr-1 pl-3 text-sm"
              >
                <span className={isMasked ? "" : "text-muted line-through"}>
                  {d.value}
                </span>
                <span className="rounded-full bg-mask px-2 font-mono text-xs text-mask-ink">
                  {d.kind}
                </span>
                <button
                  type="button"
                  className="btn-link min-h-8 px-2 text-sm"
                  onClick={() =>
                    isCustom
                      ? setCustom((prev) => prev.filter((c) => c !== d))
                      : toggle(d.value)
                  }
                >
                  {isCustom ? "Remove" : isMasked ? "Send as-is" : "Mask"}
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              className="btn-secondary min-h-9 rounded-full border-dashed text-sm"
              onClick={maskSelection}
            >
              + Mask selected text
            </button>
          </li>
        </ul>
        <p className="text-sm text-muted">
          Something personal still visible below? Select it in the text, then
          click “Mask selected text”.
        </p>
      </section>

      <details open className="card overflow-hidden">
        <summary className="cursor-pointer border-b border-line bg-canvas px-5 py-3.5 font-semibold">
          What’s sent to the model{" "}
          <span className="font-normal text-muted">· exactly this text</span>
        </summary>
        <div
          ref={previewRef}
          className="max-h-[480px] overflow-y-auto px-6 py-5 text-[15px] leading-relaxed whitespace-pre-wrap"
        >
          {sent.split(TOKEN_PATTERN).map((part, i) =>
            TOKEN_PATTERN.test(part) ? (
              <mark
                key={i}
                className="rounded bg-mask px-1 font-mono text-[13px] text-mask-ink"
              >
                {part}
              </mark>
            ) : (
              part
            ),
          )}
        </div>
      </details>
      <p className="text-sm text-muted">
        Employers, schools and dates are sent so the model can structure the CV.
        A request that still contains a masked value is blocked before it leaves
        this computer.
      </p>
    </main>
  );
}
