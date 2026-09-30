import { PosterMapApp } from "@/features/poster-map/components/poster-map-app";
import { getViewer } from "@/features/poster-map/volunteer-service";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const viewer = await getViewer(await createClient());
  return <PosterMapApp initialViewer={viewer} />;
}
