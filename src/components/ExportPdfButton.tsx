"use client";

import { useState, useTransition } from "react";

/**
 * Downloads the CV as a PDF, rendered on the server from the print view. Shows why when that fails
 * (e.g. the renderer isn't installed).
 */
export function ExportPdfButton({
  id,
  label,
  className,
  saveFirst,
  disabled = false,
}: {
  id: string;
  label: string;
  className: string;
  /** Saves pending edits; resolves to whether that worked, so an outdated version isn't exported. */
  saveFirst?: () => Promise<boolean>;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string>();
  const [exporting, startExport] = useTransition();

  const exportPdf = () =>
    startExport(async () => {
      setError(undefined);
      if (saveFirst && !(await saveFirst())) return; // the save status shows why
      const response = await fetch(`/cv/${id}/pdf`).catch(() => null);
      if (!response?.ok)
        return setError(
          (await response?.text()) || "Couldn't reach the app to export.",
        );
      const name = response.headers
        .get("Content-Disposition")
        ?.match(/filename\*=UTF-8''(.+)$/)?.[1];
      const link = document.createElement("a");
      link.href = URL.createObjectURL(await response.blob());
      link.download = name ? decodeURIComponent(name) : "CV.pdf";
      link.click();
      // Later: some browsers start the download after click() returns.
      setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
    });

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={exportPdf}
        disabled={disabled || exporting}
      >
        {exporting ? "Exporting…" : label}
      </button>
      {error && (
        <p role="alert" className="basis-full text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}
