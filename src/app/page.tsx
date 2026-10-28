import { PosterMapApp } from "@/features/poster-map/components/poster-map-app";
import { getViewer } from "@/features/poster-map/volunteer-service";
import { getIsPublicWindow } from "@/lib/public-window";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const [viewer, isPublicWindow] = await Promise.all([
    getViewer(await createClient()),
    getIsPublicWindow(),
  ]);
  // 期間外と分かっていれば、案内を最初の HTML に入れる（読み込み中の枠から入れ替わってずれない）
  return <PosterMapApp initialViewer={viewer} initialClosed={isPublicWindow === false} />;
}
