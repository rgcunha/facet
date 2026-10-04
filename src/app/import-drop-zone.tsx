"use client";

import { useState, useTransition } from "react";
import { uploadPdfAction } from "./actions";

/** Drop or pick a CV PDF; the server reads it locally and opens the Import screen. */
export function ImportDropZone() {
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();

  const upload = (file: File | undefined) => {
    if (!file || pending) return; // one import at a time, also for drops while the input is disabled
    const form = new FormData();
    form.set("file", file);
    setError(undefined);
    startTransition(async () => {
      const result = await uploadPdfAction(form);
      if (result) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        className={`flex cursor-pointer flex-wrap items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-white px-6 py-6 text-center ${dragging ? "border-accent bg-canvas" : "border-muted"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files[0]);
        }}
      >
        <span>
          {pending ? (
            <strong>Reading the PDF on this computer…</strong>
          ) : (
            <>
              <strong>Drop a CV PDF here to import it</strong>{" "}
              <span className="text-muted">
                or <span className="text-accent underline">browse</span>
              </span>
            </>
          )}
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={pending}
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = ""; // so picking the same file again (e.g. after an error) still triggers
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
