import type { Metadata } from "next";
import { GuideContent } from "@/features/poster-map/components/guide-content";
import { getViewer } from "@/features/poster-map/volunteer-service";
import { readSiteConfig } from "@/lib/site-config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "使い方ガイド" };

/** 公開前に陣営の承認と election-law-check・redteam-check を通す文言 */
export default async function GuidePage() {
  const viewer = await getViewer(await createClient());
  const { volunteerContact } = readSiteConfig();
  return (
    <GuideContent isVolunteer={viewer.kind === "volunteer"} volunteerContact={volunteerContact} />
  );
}
