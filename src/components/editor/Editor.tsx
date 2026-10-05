"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { joinFilled, range } from "@/lib/cv/format";
import type { Contact, CvContent, EditorValues, Job } from "@/lib/cv/schema";
import { tightenAction } from "@/app/actions";
import { ChangesBanner, FabricationWarnings, FieldChange } from "./changes";
import {
  Card,
  CommaListField,
  Grid,
  ItemList,
  StringListField,
  TextField,
} from "./fields";
import { LiveScoreChange, MatchReport, useBaseScore } from "./MatchReport";
import { Preview } from "./Preview";
import { TailorPanel } from "./TailorPanel";
import { type SaveStatus, useAutosave } from "./use-autosave";

const statusText: Record<SaveStatus, string> = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  error: "Couldn’t save. Retrying on next change",
};

export function Editor({
  id,
  defaultValues,
  sourceUrl,
  justImported = false,
  job,
  base,
  openTailor = false,
}: {
  id: string;
  defaultValues: EditorValues;
  /** The original PDF, for CVs created by import. */
  sourceUrl?: string;
  justImported?: boolean;
  /** For a tailored variant: the job offer, and its base CV to compare with. */
  job: Job | null;
  base?: { contact: Contact; content: CvContent };
  openTailor?: boolean;
}) {
  const form = useForm<EditorValues>({ defaultValues });
  const [showImportBanner, setShowImportBanner] = useState(justImported);
  const [tailorOpen, setTailorOpen] = useState(openTailor);
  const [tightenError, setTightenError] = useState<string>();
  const [tightening, startTighten] = useTransition();
  const { status, flush } = useAutosave(form, id);
  const baseScore = useBaseScore(base, job?.report ?? undefined);

  // Saved first, so the model shortens what is on screen; the page then reloads with the result.
  const tighten = (overflowLines: number) =>
    startTighten(async () => {
      setTightenError(undefined);
      const result = (await flush())
        ? await tightenAction(id, overflowLines)
        : { error: "Couldn’t save your latest edits; try again." };
      if (result) setTightenError(result.error);
    });

  // Open the tab synchronously (popup blockers), then point it at the print view once the latest edits are saved.
  const exportPdf = async () => {
    const tab = window.open("", "_blank");
    if (!(await flush())) {
      tab?.close(); // The status shows the save error; don't print an outdated version.
      return;
    }
    if (tab) tab.location.href = `/cv/${id}/print`;
  };

  return (
    <FormProvider {...form}>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1392px] flex-wrap items-center gap-x-5 gap-y-3 px-6 py-2.5">
          <Link href="/" className="btn-link font-semibold">
            ← CVs
          </Link>
          <label className="min-w-0 flex-[1_1_240px]">
            <span className="sr-only">CV name</span>
            <input
              className="w-full bg-transparent py-1 text-lg font-bold"
              placeholder="CV name"
              {...form.register("title")}
              disabled={tightening}
            />
          </label>
          {job?.report && (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-[13px] text-muted">Match</span>
              <LiveScoreChange report={job.report} before={baseScore} />
            </span>
          )}
          <span
            role="status"
            className={`text-[13px] ${status === "error" ? "text-danger" : "text-muted"}`}
          >
            {statusText[status]}
          </span>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            Length
            <select
              className="input w-auto"
              {...form.register("pages", { valueAsNumber: true })}
              disabled={tightening}
            >
              <option value={1}>1 page</option>
              <option value={2}>2 pages</option>
            </select>
          </label>
          <button
            type="button"
            className={
              tailorOpen
                ? "btn-secondary bg-ink text-white hover:bg-ink hover:text-white"
                : "btn-secondary"
            }
            aria-pressed={tailorOpen}
            disabled={tightening}
            onClick={() => setTailorOpen(!tailorOpen)}
          >
            Tailor…
          </button>
          <button type="button" className="btn-primary" onClick={exportPdf}>
            Export PDF
          </button>
        </div>
      </header>

      {showImportBanner && (
        <div className="mx-auto max-w-[1392px] px-6 pt-4">
          <div
            role="status"
            className="flex flex-wrap items-center gap-4 rounded-lg bg-accent/10 px-4 py-3 text-sm"
          >
            <span className="flex-[1_1_400px]">
              <strong>Parsed.</strong> Compare with your original on the right
              and fix anything that landed in the wrong place.
            </span>
            <button
              type="button"
              className="btn-link min-h-9"
              onClick={() => setShowImportBanner(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[1392px] flex-col gap-2.5 px-6 pt-4 empty:hidden">
        <ChangesBanner job={job} />
        <FabricationWarnings />
        {tightenError && (
          <p
            role="alert"
            className="rounded-lg border border-danger bg-white px-4 py-3 text-sm text-danger"
          >
            {tightenError}
          </p>
        )}
      </div>

      <main className="mx-auto flex max-w-[1392px] flex-wrap items-start gap-6 px-6 pt-4 pb-12">
        <form
          aria-label="CV content"
          className="min-w-0 flex-[1_1_520px]"
          onSubmit={(e) => e.preventDefault()}
        >
          {/* Locked while "Tighten to fit" runs: its result replaces the content, so edits made meanwhile would be lost. */}
          <fieldset
            disabled={tightening}
            className="flex min-w-0 flex-col gap-3.5 disabled:opacity-60"
          >
            <Card title="Contact">
              <Grid>
                <TextField name="contact.name" label="Full name" />
                <TextField name="contact.email" label="Email" />
                <TextField name="contact.phone" label="Phone" />
                <TextField name="contact.location" label="Location" />
                <TextField
                  name="contact.dateOfBirth"
                  label="Date of birth (optional)"
                />
              </Grid>
              <StringListField
                name="contact.links"
                label="Links"
                addLabel="Add link"
              />
            </Card>

            <Card title="Headline & summary">
              <TextField name="content.headline" label="Headline" />
              <FieldChange field="headline" />
              <TextField name="content.summary" label="Summary" rows={4} />
              <FieldChange field="summary" />
            </Card>

            <ItemList
              section="experience"
              title="Experience"
              addLabel="Add role"
              summary={(e) =>
                joinFilled([e.role, e.company, range(e.start, e.end)])
              }
            >
              {(p) => (
                <>
                  <Grid>
                    <TextField name={`${p}.role`} label="Role" />
                    <TextField name={`${p}.company`} label="Company" />
                    <TextField name={`${p}.location`} label="Location" />
                    <TextField name={`${p}.start`} label="Start" />
                    <TextField name={`${p}.end`} label="End" />
                  </Grid>
                  <StringListField
                    name={`${p}.highlights`}
                    label="Highlights"
                    addLabel="Add highlight"
                  />
                </>
              )}
            </ItemList>

            <ItemList
              section="education"
              title="Education"
              addLabel="Add education"
              summary={(e) => joinFilled([e.degree, e.institution])}
            >
              {(p) => (
                <>
                  <Grid>
                    <TextField name={`${p}.degree`} label="Degree" />
                    <TextField name={`${p}.institution`} label="Institution" />
                    <TextField name={`${p}.location`} label="Location" />
                    <TextField name={`${p}.start`} label="Start" />
                    <TextField name={`${p}.end`} label="End" />
                  </Grid>
                  <TextField name={`${p}.details`} label="Details" rows={2} />
                </>
              )}
            </ItemList>

            <ItemList
              section="skills"
              title="Skills"
              addLabel="Add group"
              summary={(s) => s.group}
            >
              {(p) => (
                <>
                  <TextField name={`${p}.group`} label="Group" />
                  <CommaListField
                    name={`${p}.items`}
                    label="Skills (comma-separated)"
                  />
                </>
              )}
            </ItemList>

            <ItemList
              section="projects"
              title="Projects"
              addLabel="Add project"
              summary={(x) => x.name}
            >
              {(p) => (
                <>
                  <Grid>
                    <TextField name={`${p}.name`} label="Name" />
                    <TextField name={`${p}.link`} label="Link" />
                  </Grid>
                  <TextField
                    name={`${p}.description`}
                    label="Description"
                    rows={2}
                  />
                </>
              )}
            </ItemList>

            <ItemList
              section="languages"
              title="Languages"
              addLabel="Add language"
              summary={(l) => joinFilled([l.name, l.level])}
            >
              {(p) => (
                <Grid>
                  <TextField name={`${p}.name`} label="Language" />
                  <TextField name={`${p}.level`} label="Level" />
                </Grid>
              )}
            </ItemList>

            <ItemList
              section="extras"
              title="Other sections"
              addLabel="Add section"
              summary={(x) => x.title}
            >
              {(p) => (
                <>
                  <TextField name={`${p}.title`} label="Section title" />
                  <StringListField
                    name={`${p}.items`}
                    label="Entries"
                    addLabel="Add entry"
                  />
                </>
              )}
            </ItemList>
          </fieldset>
        </form>

        {tailorOpen ? (
          <TailorPanel
            cvId={id}
            onClose={() => setTailorOpen(false)}
            saveFirst={flush}
          />
        ) : (
          <Preview
            sourceUrl={sourceUrl}
            base={base}
            report={
              job?.report && (
                <MatchReport
                  report={job.report}
                  confirmed={job.report.confirmed}
                  before={baseScore}
                />
              )
            }
            showSecond={justImported}
            onTighten={tighten}
            tightening={tightening}
          />
        )}
      </main>
    </FormProvider>
  );
}
