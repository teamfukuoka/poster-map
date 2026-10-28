"use client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { DEFAULT_ZOOM, MAP_CENTER, MAX_ZOOM } from "@/features/poster-map/area";
import { coverageTooltipHtml, markerStyle } from "../coverage-map-view";
import { boardsInRow } from "../coverage-view";
import type { CoverageBoard, CoverageStatus, CoverageSummaryRow } from "../types";

/** 赤が灰色に埋もれないよう、担当あり → 予約あり → 担当なし の順に重ねる */
const DRAW_ORDER: readonly CoverageStatus[] = ["assigned", "reserved", "none"];

type Props = {
  boards: CoverageBoard[];
  /** 一覧で選んだ行。null なら全部を出して全体に戻す */
  selected: CoverageSummaryRow | null;
};

export default function CoverageMap({ boards, selected }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // 地図は一度だけ作る。点が多い（2,000 件超）ので canvas で描き、クラスタにはしない
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { preferCanvas: true }).setView(
      MAP_CENTER,
      DEFAULT_ZOOM,
    );
    L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", {
      attribution:
        '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>',
      maxZoom: MAX_ZOOM,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // 選んだ範囲の掲示場だけを描き、その範囲に寄せる
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const shown = selected ? boardsInRow(boards, selected) : boards;
    for (const status of DRAW_ORDER) {
      const { color, radius } = markerStyle(status);
      for (const b of shown) {
        if (b.coverage !== status) continue;
        L.circleMarker([b.lat, b.long], {
          radius,
          color,
          fillColor: color,
          fillOpacity: 0.85,
          weight: 1,
        })
          .bindTooltip(coverageTooltipHtml(b), { direction: "top" })
          .addTo(layer);
      }
    }

    // 選んでいない（または範囲に掲示場がない）ときは、全体の見え方に戻す
    if (!selected || shown.length === 0) {
      map.setView(MAP_CENTER, DEFAULT_ZOOM);
      return;
    }
    map.fitBounds(L.latLngBounds(shown.map((b) => [b.lat, b.long] as [number, number])), {
      padding: [24, 24],
      maxZoom: 17,
    });
  }, [boards, selected]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="掲示場のカバー状況の地図。赤は担当なし、黄は予約あり、灰色は担当あり"
      className="relative z-0 h-[360px] w-full overflow-hidden rounded-lg border border-border md:h-[480px]"
    />
  );
}
