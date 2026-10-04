import { emptyProfile } from "@/lib/cv/empty";
import { type Profile, profileSchema } from "@/lib/cv/schema";
import { dataPath, readJson, writeJsonAtomic } from "./fs";

const profileFile = () => dataPath("profile.json");

export async function getProfile(): Promise<Profile> {
  return (await readJson(profileFile(), profileSchema)) ?? emptyProfile();
}

export async function saveProfile(profile: Profile) {
  await writeJsonAtomic(profileFile(), profileSchema.parse(profile));
}
