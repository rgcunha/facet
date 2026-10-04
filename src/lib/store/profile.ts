import { emptyProfile } from "@/lib/cv/empty";
import {
  type Contact,
  type PrivateValue,
  type Profile,
  profileSchema,
} from "@/lib/cv/schema";
import { sameValue } from "@/lib/privacy/redact";
import { dataPath, readJson, writeJsonAtomic } from "./fs";

const profileFile = () => dataPath("profile.json");

export async function getProfile(): Promise<Profile> {
  return (await readJson(profileFile(), profileSchema)) ?? emptyProfile();
}

/** Merges into the stored profile, so saving contact details never drops the vault (and vice versa). */
export async function updateProfile(
  patch:
    | Partial<Omit<Profile, "v">>
    | ((current: Profile) => Partial<Omit<Profile, "v">>),
) {
  const current = await getProfile();
  const next = {
    ...current,
    ...(typeof patch === "function" ? patch(current) : patch),
  };
  await writeJsonAtomic(profileFile(), profileSchema.parse(next));
}

/**
 * Fills only empty contact fields, and only from values the user kept masked (confirmed as theirs):
 * an import never overwrites contact details shared by every CV.
 */
function fillContact(current: Contact, masked: PrivateValue[]): Contact {
  const first = (kind: PrivateValue["kind"]) =>
    masked.find((m) => m.kind === kind)?.value ?? "";
  const links = masked.filter((m) => m.kind === "url").map((m) => m.value);
  return {
    name: current.name || first("name"),
    email: current.email || first("email"),
    phone: current.phone || first("phone"),
    location: current.location || first("address"),
    dateOfBirth: current.dateOfBirth || first("dob"),
    links: current.links.length ? current.links : links,
  };
}

/**
 * After an import: fill empty contact details from the masked values, and add them to the vault,
 * so later LLM calls (tailoring) mask and check against them too.
 */
export const recordImport = (masked: PrivateValue[]) =>
  updateProfile(({ contact, vault }) => ({
    contact: fillContact(contact, masked),
    vault: [
      ...vault,
      ...masked.filter((m) => !vault.some((v) => sameValue(v.value, m.value))),
    ],
  }));
