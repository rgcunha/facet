"use client";

import { UNTITLED_CV } from "@/lib/cv/empty";
import { deleteCvAction } from "./actions";

export function DeleteCvButton({
  id,
  title,
  variants = 0,
}: {
  id: string;
  title: string;
  variants?: number;
}) {
  return (
    <button
      type="button"
      className="btn-link text-danger hover:text-danger"
      onClick={() => {
        const alsoVariants = variants
          ? ` and its ${variants === 1 ? "variant" : `${variants} variants`}`
          : "";
        if (
          confirm(
            `Delete "${title || UNTITLED_CV}"${alsoVariants}? This cannot be undone.`,
          )
        )
          void deleteCvAction(id);
      }}
    >
      Delete
    </button>
  );
}
