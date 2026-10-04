import Link from "next/link";
import { connection } from "next/server";
import { UNTITLED_CV } from "@/lib/cv/empty";
import { plural } from "@/lib/cv/format";
import { listCvs } from "@/lib/store/cvs";
import { createCvAction } from "./actions";
import { DeleteCvButton } from "./delete-cv-button";
import { ImportDropZone } from "./import-drop-zone";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

export default async function LibraryPage() {
  await connection();
  const cvs = await listCvs();
  // Variants whose base is gone (shouldn't happen: deleting a base deletes them) still show up.
  const bases = cvs.filter(
    (cv) => cv.kind === "base" || !cvs.some((b) => b.id === cv.baseId),
  );

  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-6 py-3 text-lg font-bold">
          <span className="flex size-[30px] items-center justify-center rounded-lg bg-ink text-sm text-white">
            CV
          </span>
          CV Tool
        </div>
      </header>

      <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-6 pt-10 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[32px] leading-tight font-bold tracking-tight">
            CVs
          </h1>
          <form action={createCvAction}>
            <button className="btn-primary">New CV</button>
          </form>
        </div>

        <ImportDropZone />

        {cvs.length === 0 ? (
          <p className="card p-8 text-center text-muted">
            No CVs yet. Import a PDF above, or start with “New CV”.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {bases.map((cv) => {
              const variants = cvs.filter((v) => v.baseId === cv.id);
              return (
                <li key={cv.id} className="card overflow-hidden">
                  <div className="flex flex-wrap items-center gap-4 px-6 py-5">
                    <div className="min-w-0 flex-[999_1_260px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/cv/${cv.id}`}
                          className="text-[19px] font-bold text-ink no-underline"
                        >
                          {cv.title || UNTITLED_CV}
                        </Link>
                        <span className="rounded bg-accent-soft px-2 py-0.5 text-xs font-bold tracking-wide text-accent-strong uppercase">
                          Base
                        </span>
                      </div>
                      <p className="text-sm text-muted">
                        Edited {formatDate(cv.updatedAt)} ·{" "}
                        {plural(variants.length, "variant")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/cv/${cv.id}`} className="btn-secondary">
                        Edit
                      </Link>
                      <Link
                        href={`/cv/${cv.id}?tailor=1`}
                        className="btn-primary"
                      >
                        Tailor…
                      </Link>
                      <DeleteCvButton
                        id={cv.id}
                        title={cv.title}
                        variants={variants.length}
                      />
                    </div>
                  </div>
                  {variants.length > 0 && (
                    <ul
                      aria-label="Variants"
                      className="flex flex-col px-6 pb-2 pl-[52px]"
                    >
                      {variants.map((v) => (
                        <li
                          key={v.id}
                          className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line py-3"
                        >
                          <Link
                            href={`/cv/${v.id}`}
                            className="min-w-0 flex-[999_1_240px] text-ink no-underline"
                          >
                            <strong>{v.title}</strong>
                            {v.job?.company && (
                              <span className="text-muted">
                                {" "}
                                · {v.job.company}
                              </span>
                            )}
                          </Link>
                          <span className="text-sm text-muted uppercase">
                            {v.language}
                          </span>
                          <span className="min-w-16 text-sm text-muted">
                            {formatDate(v.createdAt)}
                          </span>
                          <Link href={`/cv/${v.id}`} className="btn-link">
                            Edit
                          </Link>
                          <a
                            href={`/cv/${v.id}/print`}
                            target="_blank"
                            className="btn-link"
                          >
                            PDF
                          </a>
                          <DeleteCvButton id={v.id} title={v.title} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
