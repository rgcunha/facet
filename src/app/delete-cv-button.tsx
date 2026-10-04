"use client";

import { UNTITLED_CV } from "@/lib/cv/empty";
import { deleteCvAction } from "./actions";

export function DeleteCvButton({ id, title }: { id: string; title: string }) {
  return (
    <button
      type="button"
      className="btn-link text-danger hover:text-danger"
      onClick={() => {
        if (confirm(`Delete "${title || UNTITLED_CV}"? This cannot be undone.`))
          void deleteCvAction(id);
      }}
    >
      Delete
    </button>
  );
}
