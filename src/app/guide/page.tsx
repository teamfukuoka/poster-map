import type { Metadata } from "next";
import { GuideContent } from "@/features/poster-map/components/guide-content";
import { isStickerEnabled } from "@/features/poster-map/sticker-service";
import { getViewer } from "@/features/poster-map/volunteer-service";
import { readSiteConfig } from "@/lib/site-config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "使い方ガイド" };

/** 公開前に陣営の承認と election-law-check・redteam-check を通す文言 */
export default async function GuidePage() {
  const client = await createClient();
  const viewer = await getViewer(client);
  const isVolunteer = viewer.kind === "volunteer";
  // シール貼りの案内は、シールを始めている間だけ参加中の人に出す（地図の切り替えと同じ条件）
  const stickerEnabled = isVolunteer && (await isStickerEnabled(client));
  const { volunteerContact } = readSiteConfig();
  return (
    <GuideContent
      isVolunteer={isVolunteer}
      stickerEnabled={stickerEnabled}
      volunteerContact={volunteerContact}
    />
  );
}
