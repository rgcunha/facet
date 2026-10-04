import Link from "next/link";
import { connection } from "next/server";
import { UNTITLED_CV } from "@/lib/cv/empty";
import { listCvs } from "@/lib/store/cvs";
import { createCvAction } from "./actions";
import { DeleteCvButton } from "./delete-cv-button";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

export default async function LibraryPage() {
  await connection();
  const cvs = await listCvs();

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

        {cvs.length === 0 ? (
          <p className="card p-8 text-center text-muted">
            No CVs yet. Create one to get started.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {cvs.map((cv) => (
              <li
                key={cv.id}
                className="card flex flex-wrap items-center gap-4 px-6 py-5"
              >
                <div className="min-w-0 flex-[999_1_260px]">
                  <Link
                    href={`/cv/${cv.id}`}
                    className="text-[19px] font-bold text-ink no-underline"
                  >
                    {cv.title || UNTITLED_CV}
                  </Link>
                  <p className="text-sm text-muted">
                    Edited {formatDate(cv.updatedAt)} · {cv.pages} page target
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/cv/${cv.id}`} className="btn-secondary">
                    Edit
                  </Link>
                  <a
                    href={`/cv/${cv.id}/print`}
                    target="_blank"
                    className="btn-secondary"
                  >
                    PDF
                  </a>
                  <DeleteCvButton id={cv.id} title={cv.title} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
