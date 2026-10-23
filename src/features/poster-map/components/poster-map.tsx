"use client";
// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./poster-map.css";
import { Expand, LocateFixed, Minimize } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DEFAULT_ZOOM, MAP_CENTER, MAX_ZOOM } from "../area";
import { flyToBoard } from "../fly-to-board";
import {
  boardTooltipHtml,
  clusterIconHtml,
  clusterTooltipHtml,
  markerIconHtml,
  offsetPosition,
} from "../marker-icons";
import { countByStatus } from "../stats";
import type { MapBoard } from "../types";
import { BoardSearch } from "./board-search";

type MarkerWithBoard = L.Marker & { board?: MapBoard };

type Props = {
  /** フィルター適用後の掲示板 */
  boards: readonly MapBoard[];
  onBoardClick: (board: MapBoard) => void;
  /** 地図の右上に重ねるもの（フィルター） */
  controls?: ReactNode;
};

function childBoards(cluster: L.MarkerCluster): MapBoard[] {
  return (cluster.getAllChildMarkers() as MarkerWithBoard[]).flatMap((m) =>
    m.board ? [m.board] : [],
  );
}

function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const { html, size } = clusterIconHtml(countByStatus(childBoards(cluster)));
  return L.divIcon({
    html,
    className: "custom-cluster",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function PosterMap({ boards, onBoardClick, controls }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const locationRef = useRef<L.CircleMarker | null>(null);
  /** 検索で最後に選んだ掲示板。移動の間に選び直されたら、前のダイアログは開かない */
  const lastSearchedRef = useRef<MapBoard | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current).setView(MAP_CENTER, DEFAULT_ZOOM);
    L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", {
      attribution:
        '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>',
      maxZoom: MAX_ZOOM,
    }).addTo(map);

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      iconCreateFunction: createClusterIcon,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      // 1,644 件なら一度に追加できる。分割すると clearLayers と競合して古いマーカーが残る
      chunkedLoading: false,
      removeOutsideVisibleBounds: true,
      spiderfyDistanceMultiplier: 2,
      spiderLegPolylineOptions: { weight: 2, color: "#222", opacity: 0.5 },
    });
    cluster.on("clustermouseover", (e) => {
      const target = (e as L.LeafletEvent & { propagatedFrom: L.MarkerCluster }).propagatedFrom;
      target
        .bindTooltip(clusterTooltipHtml(countByStatus(childBoards(target))), {
          direction: "top",
          className: "cluster-tooltip",
        })
        .openTooltip();
    });
    cluster.on("clustermouseout", (e) => {
      (e as L.LeafletEvent & { propagatedFrom: L.MarkerCluster }).propagatedFrom.closeTooltip();
    });
    map.addLayer(cluster);

    mapRef.current = map;
    clusterRef.current = cluster;
    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      locationRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();

    const byLocation = new Map<string, MapBoard[]>();
    for (const board of boards) {
      const key = `${board.lat.toFixed(6)}_${board.long.toFixed(6)}`;
      byLocation.set(key, [...(byLocation.get(key) ?? []), board]);
    }

    const canHover = window.matchMedia("(hover: hover)").matches;
    const markers: L.Marker[] = [];
    for (const group of byLocation.values()) {
      group.forEach((board, index) => {
        const marker: MarkerWithBoard = L.marker(
          offsetPosition(board.lat, board.long, index, group.length),
          {
            icon: L.divIcon({
              html: markerIconHtml(board.status),
              className: "custom-marker",
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
            keyboard: true,
            title: `#${board.number} ${board.name}`,
          },
        );
        marker.board = board;
        marker.on("click", () => onBoardClick(board));
        if (canHover) {
          marker.bindTooltip(boardTooltipHtml(board, group.length), { direction: "top" });
        }
        markers.push(marker);
      });
    }
    cluster.addLayers(markers);
  }, [boards, onBoardClick]);

  // 現在地はボタンを押したときだけ取得する（送信しない・追跡しない）
  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast.error("この端末では現在地を取得できません。");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const map = mapRef.current;
        if (!map) return;
        const latLng: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        locationRef.current?.remove();
        locationRef.current = L.circleMarker(latLng, {
          radius: 12,
          color: "#0081cc",
          fillColor: "#00afcc",
          fillOpacity: 0.7,
          weight: 3,
        })
          .addTo(map)
          .bindTooltip("現在地", { direction: "top" });
        map.flyTo(latLng, Math.max(map.getZoom(), 16), { duration: 0.8 });
      },
      () => {
        setIsLocating(false);
        toast.error("現在地を取得できませんでした。位置情報の許可を確認してください。");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  };

  // 検索で選んだら、その掲示板まで移動してからマーカーを押したときと同じダイアログを開く
  const handleSearchSelect = (board: MapBoard) => {
    const map = mapRef.current;
    if (!map) return;
    lastSearchedRef.current = board;
    flyToBoard(map, board, MAX_ZOOM, (b) => lastSearchedRef.current === b, onBoardClick);
  };

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: isFullscreen の変化が合図
  useEffect(() => {
    // 大きさが変わった後に Leaflet へ知らせる
    const id = setTimeout(() => mapRef.current?.invalidateSize(), 100);
    return () => clearTimeout(id);
  }, [isFullscreen]);

  const bottom = isFullscreen ? "calc(1rem + env(safe-area-inset-bottom))" : "1rem";

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 bg-background"
          : "relative z-0 h-[65vh] min-h-[420px] w-full"
      }
      style={isFullscreen ? { height: "100dvh", width: "100dvw" } : undefined}
    >
      <div ref={containerRef} className="h-full w-full" />

      <BoardSearch boards={boards} onSelect={handleSearchSelect} />
      {controls}

      <button
        type="button"
        onClick={() => setIsFullscreen((v) => !v)}
        className="absolute left-4 z-[1000] rounded-full border border-border bg-background p-3 text-ink shadow-card hover:bg-brand-light"
        style={{ bottom }}
        aria-label={isFullscreen ? "全画面表示を終える" : "全画面で表示"}
        title={isFullscreen ? "全画面表示を終える（Esc）" : "全画面で表示"}
      >
        {isFullscreen ? <Minimize size={20} /> : <Expand size={20} />}
      </button>

      <button
        type="button"
        onClick={handleLocate}
        disabled={isLocating}
        className="absolute right-4 z-[1000] flex min-h-11 items-center gap-1 rounded-full border-2 border-brand bg-background px-4 py-2 font-bold text-brand-dark shadow-card hover:bg-brand-light disabled:opacity-60"
        style={{ bottom }}
      >
        <LocateFixed size={18} />
        {isLocating ? "取得中…" : "現在地"}
      </button>
    </div>
  );
}
