"use client";
// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import { CircleHelp } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  loadMyBoardIdsAction,
  loadMyReservedBoardIdsAction,
  loadStickerStateAction,
  loadVolunteerBoardsAction,
} from "../actions";
import { toUserMessage } from "../errors";
import {
  type MapMode,
  parseViewParam,
  posterView,
  STICKER_DISPLAYS,
  type StickerDisplay,
  stickerDisplayOf,
  stickerView,
  withViewParam,
} from "../map-view";
import { fetchPublicBoards } from "../public-boards";
import type { StickerStatus } from "../sticker-status";
import type { MapBoard } from "../types";
import { useBoardFilter } from "../use-board-filter";
import type { Viewer } from "../volunteer-service";
import { BoardFilter } from "./board-filter";
import { BulkReserve, StickerBulkReserve } from "./bulk-reserve";
import { ClosedNotice } from "./closed-notice";
import { HelpDialog } from "./help-dialog";
import { InfoDialog } from "./info-dialog";
import { JoinDialog } from "./join-dialog";
import { StickerDialog } from "./sticker-dialog";
import { StickerFilter } from "./sticker-filter";
import { StickerSummaryBar, StickerWardSummary } from "./sticker-summary";
import { SummaryBar } from "./summary-bar";
import { UpdateDialog } from "./update-dialog";
import { ViewToggle } from "./view-toggle";
import { WardSummary } from "./ward-summary";

// leaflet は window を使うので、ブラウザでだけ読み込む
const PosterMap = dynamic(() => import("./poster-map"), {
  ssr: false,
  loading: () => <div className="h-[65vh] min-h-[420px] animate-pulse rounded-lg bg-muted" />,
});

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; boards: MapBoard[] }
  | { kind: "closed" }
  | { kind: "error"; message: string };

/** ポスターシール貼りチャレンジ。参加中のボランティアだけが読める */
type Sticker = {
  /** 管理画面で「シールを始める」が ON か */
  enabled: boolean;
  /** シールが「未」でない掲示板の状態（ない掲示板は「未」） */
  stickers: ReadonlyMap<string, StickerStatus>;
  /** 自分のシールの予約 */
  myReservedIds: ReadonlySet<string>;
};

type Loaded = {
  state: LoadState;
  myBoardIds: ReadonlySet<string>;
  /** 自分の予約（最後に予約したのが自分）。まとめて戻すボタンの件数に使う */
  myReservedIds: ReadonlySet<string>;
  /** 読み込めなかったときは null（今の表示を残す） */
  sticker: Sticker | null;
};

const EMPTY_IDS: ReadonlySet<string> = new Set();
const EMPTY_BOARDS: MapBoard[] = [];
const STICKER_OFF: Sticker = { enabled: false, stickers: new Map(), myReservedIds: EMPTY_IDS };

async function loadVolunteerBoards(): Promise<Loaded> {
  const [boards, mine, reserved, sticker] = await Promise.all([
    loadVolunteerBoardsAction(),
    loadMyBoardIdsAction(),
    loadMyReservedBoardIdsAction(),
    loadStickerStateAction(),
  ]);
  if (!boards.ok) {
    return {
      state: { kind: "error", message: boards.error },
      myBoardIds: EMPTY_IDS,
      myReservedIds: EMPTY_IDS,
      sticker: null,
    };
  }
  return {
    state: { kind: "ok", boards: boards.data },
    myBoardIds: mine.ok ? new Set(mine.data) : EMPTY_IDS,
    myReservedIds: reserved.ok ? new Set(reserved.data) : EMPTY_IDS,
    sticker: sticker.ok
      ? {
          enabled: sticker.data.enabled,
          stickers: new Map(sticker.data.stickers.map((e) => [e.boardId, e.status])),
          myReservedIds: new Set(sticker.data.myReservedIds),
        }
      : null,
  };
}

async function loadBoards(isVolunteer: boolean): Promise<Loaded> {
  if (!isVolunteer) {
    const result = await fetchPublicBoards();
    if (result.kind === "ok") {
      return {
        state: { kind: "ok", boards: result.boards },
        myBoardIds: EMPTY_IDS,
        myReservedIds: EMPTY_IDS,
        sticker: STICKER_OFF,
      };
    }
    return { state: result, myBoardIds: EMPTY_IDS, myReservedIds: EMPTY_IDS, sticker: STICKER_OFF };
  }
  try {
    return await loadVolunteerBoards();
  } catch {
    // Server Action は通信の切断や再デプロイで reject することがある
    return {
      state: { kind: "error", message: toUserMessage(null) },
      myBoardIds: EMPTY_IDS,
      myReservedIds: EMPTY_IDS,
      sticker: null,
    };
  }
}

type Props = {
  initialViewer: Viewer;
  /** サーバーで公開期間外と分かったか。分からないときは false（/api/boards で確かめる） */
  initialClosed?: boolean;
};

export function PosterMapApp({ initialViewer, initialClosed = false }: Props) {
  const [viewer, setViewer] = useState(initialViewer);
  const [state, setState] = useState<LoadState>(
    initialClosed ? { kind: "closed" } : { kind: "loading" },
  );
  const [myBoardIds, setMyBoardIds] = useState<ReadonlySet<string>>(EMPTY_IDS);
  const [myReservedIds, setMyReservedIds] = useState<ReadonlySet<string>>(EMPTY_IDS);
  const [reloadKey, setReloadKey] = useState(0);
  const [sticker, setSticker] = useState<Sticker>(STICKER_OFF);
  /**
   * 選んでいる表示。URL の view から始める（指定がなければシール）。
   * シールを始めていない間は、mapMode がいつもポスターになるので、この値は使われない。
   */
  const [mode, setMode] = useState<MapMode>(() =>
    typeof window === "undefined" ? "sticker" : parseViewParam(window.location.search, true),
  );
  const [stickerDisplays, setStickerDisplays] = useState<ReadonlySet<StickerDisplay>>(
    () => new Set(STICKER_DISPLAYS),
  );
  const [selected, setSelected] = useState<MapBoard | null>(null);
  /** 開いているダイアログ。ピンを押したときの表示で決め、シールのダイアログからポスターに切り替えられる */
  const [dialogKind, setDialogKind] = useState<MapMode>("poster");
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  /** ピンから参加に進んだときの掲示板。参加の後に報告を開く */
  const joinBoardRef = useRef<MapBoard | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const isVolunteer = viewer.kind === "volunteer";
  const canJoin = viewer.kind === "public";
  // 期間外と分かっている一般の人は、/api/boards を取りに行かない（404 で終わるだけ）
  const skipPublicFetch = initialClosed && !isVolunteer;

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey は再読み込みの合図
  useEffect(() => {
    if (skipPublicFetch) return;
    let active = true;
    // 地図を表示しているときは作り直さない。裏で取り直して差し替える
    if (stateRef.current.kind !== "ok") setState({ kind: "loading" });
    loadBoards(isVolunteer).then((loaded) => {
      if (!active) return;
      // 裏での取り直しに失敗しても、今の表示を残す
      if (loaded.state.kind !== "ok" && stateRef.current.kind === "ok") return;
      setState(loaded.state);
      setMyBoardIds(loaded.myBoardIds);
      setMyReservedIds(loaded.myReservedIds);
      if (loaded.sticker) setSticker(loaded.sticker);
    });
    return () => {
      active = false;
    };
  }, [isVolunteer, reloadKey, skipPublicFetch]);

  // ボランティアはタブに戻ったとき、ほかの人の報告を反映するため裏で取り直す
  // （一般の閲覧者は /api/boards の CDN キャッシュがあるので取り直さない）
  useEffect(() => {
    if (!isVolunteer) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") setReloadKey((k) => k + 1);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isVolunteer]);

  const stickerEnabled = isVolunteer && sticker.enabled;
  const mapMode: MapMode = stickerEnabled ? mode : "poster";

  /** 選んだ表示を URL に残す（再読み込み・共有しても同じ表示で開く） */
  const changeMode = useCallback((next: MapMode) => {
    setMode(next);
    window.history.replaceState(
      window.history.state,
      "",
      withViewParam(window.location.href, next),
    );
  }, []);

  const boards = state.kind === "ok" ? state.boards : EMPTY_BOARDS;
  const filter = useBoardFilter(boards, myBoardIds);

  const stickerBoards = useMemo(
    () =>
      boards.filter((b) => stickerDisplays.has(stickerDisplayOf(b, sticker.stickers.get(b.id)))),
    [boards, stickerDisplays, sticker.stickers],
  );
  const view = useMemo(
    () => (mapMode === "sticker" ? stickerView(sticker.stickers) : posterView(isVolunteer)),
    [mapMode, sticker.stickers, isVolunteer],
  );

  const mapModeRef = useRef(mapMode);
  useEffect(() => {
    mapModeRef.current = mapMode;
  }, [mapMode]);

  const handleBoardClick = useCallback((board: MapBoard) => {
    setDialogKind(mapModeRef.current);
    setSelected(board);
  }, []);
  const closeSelected = useCallback(() => setSelected(null), []);

  const openJoin = () => {
    joinBoardRef.current = selected;
    setSelected(null);
    setIsJoinOpen(true);
  };

  const handleJoinOpenChange = (open: boolean) => {
    if (!open) joinBoardRef.current = null;
    setIsJoinOpen(open);
  };

  const handleJoined = (displayName: string) => {
    const board = joinBoardRef.current;
    joinBoardRef.current = null;
    setIsJoinOpen(false);
    setViewer({ kind: "volunteer", displayName });
    if (board) {
      setDialogKind("poster");
      setSelected(board);
    }
  };

  /** 自分が報告した掲示板を反映する。予約にしたものは自分の予約に足し、それ以外は外す */
  const applyUpdates = useCallback((updated: readonly MapBoard[]) => {
    const byId = new Map(updated.map((b) => [b.id, b]));
    setState((prev) =>
      prev.kind === "ok"
        ? { kind: "ok", boards: prev.boards.map((b) => byId.get(b.id) ?? b) }
        : prev,
    );
    setMyBoardIds((prev) => new Set([...prev, ...byId.keys()]));
    setMyReservedIds((prev) => {
      const next = new Set(prev);
      for (const b of updated) {
        if (b.status === "reserved") next.add(b.id);
        else next.delete(b.id);
      }
      return next;
    });
  }, []);

  const handleBulkUpdated = useCallback(
    (updated: MapBoard[]) => {
      applyUpdates(updated);
      // 同じころにほかの人が報告した分も映すため、裏で取り直す
      setReloadKey((k) => k + 1);
    },
    [applyUpdates],
  );

  /** 自分が報告したシールを反映する */
  const applyStickerUpdates = useCallback((ids: readonly string[], status: StickerStatus) => {
    setSticker((prev) => {
      const stickers = new Map(prev.stickers);
      const myReservedIds = new Set(prev.myReservedIds);
      for (const id of ids) {
        if (status === "not_yet") stickers.delete(id);
        else stickers.set(id, status);
        if (status === "reserved") myReservedIds.add(id);
        else myReservedIds.delete(id);
      }
      return { ...prev, stickers, myReservedIds };
    });
  }, []);

  const handleStickerBulkUpdated = useCallback(
    (ids: string[], status: StickerStatus) => {
      applyStickerUpdates(ids, status);
      setReloadKey((k) => k + 1);
    },
    [applyStickerUpdates],
  );

  const handleStickerUpdated = (entry: { boardId: string; status: StickerStatus }) => {
    applyStickerUpdates([entry.boardId], entry.status);
    setSelected((prev) => (prev?.id === entry.boardId ? null : prev));
  };

  const handleUpdated = (updated: MapBoard) => {
    applyUpdates([updated]);
    // 報告の間に別の掲示板を開いていたら、そちらは閉じない
    setSelected((prev) => (prev?.id === updated.id ? null : prev));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {viewer.kind === "volunteer" && (
          <p className="text-muted-foreground">{viewer.displayName} さんとして参加中</p>
        )}
        {viewer.kind === "revoked" && (
          <p className="text-muted-foreground">
            この端末の参加は停止されています。閲覧はそのまま続けられます。
          </p>
        )}
        <div className="ml-auto flex gap-2">
          {canJoin && state.kind === "ok" && (
            <Button variant="outline" size="sm" onClick={openJoin}>
              参加コードをお持ちの方
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setIsHelpOpen(true)}>
            <CircleHelp aria-hidden />
            使い方
          </Button>
        </div>
      </div>

      {state.kind === "loading" && (
        <output className="flex h-[65vh] min-h-[420px] items-center justify-center rounded-lg bg-muted text-muted-foreground text-sm">
          読み込み中…
        </output>
      )}

      {state.kind === "closed" && <ClosedNotice canJoin={canJoin} onJoin={openJoin} />}

      {state.kind === "error" && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-lg border bg-card p-6 text-center">
          <p role="alert">{state.message}</p>
          <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            もう一度読み込む
          </Button>
        </div>
      )}

      {state.kind === "ok" && (
        <>
          {stickerEnabled && <ViewToggle mode={mapMode} onChange={changeMode} />}
          {mapMode === "sticker" ? (
            <StickerSummaryBar boards={boards} stickers={sticker.stickers} />
          ) : (
            <SummaryBar boards={boards} isVolunteer={isVolunteer} />
          )}
          <PosterMap
            boards={mapMode === "sticker" ? stickerBoards : filter.filteredBoards}
            allBoards={boards}
            onBoardClick={handleBoardClick}
            view={view}
            controls={
              mapMode === "sticker" ? (
                <StickerFilter displays={stickerDisplays} onChange={setStickerDisplays} />
              ) : (
                <BoardFilter
                  filterState={filter.filterState}
                  isVolunteer={isVolunteer}
                  onToggleStatus={filter.toggleStatus}
                  onToggleShowOnlyMine={filter.toggleShowOnlyMine}
                  onSelectAll={filter.selectAll}
                  onDeselectAll={filter.deselectAll}
                />
              )
            }
            districtActions={
              !isVolunteer
                ? undefined
                : mapMode === "sticker"
                  ? (districts) => (
                      <StickerBulkReserve
                        boards={boards}
                        districts={districts}
                        stickers={sticker.stickers}
                        myReservedIds={sticker.myReservedIds}
                        onUpdated={handleStickerBulkUpdated}
                      />
                    )
                  : (districts) => (
                      <BulkReserve
                        boards={boards}
                        districts={districts}
                        myReservedIds={myReservedIds}
                        onUpdated={handleBulkUpdated}
                      />
                    )
            }
          />
          {mapMode === "sticker" ? (
            <StickerWardSummary boards={boards} stickers={sticker.stickers} />
          ) : (
            <WardSummary boards={boards} />
          )}
        </>
      )}

      {isVolunteer ? (
        selected &&
        (stickerEnabled && dialogKind === "sticker" ? (
          <StickerDialog
            key={`sticker-${selected.id}`}
            board={selected}
            sticker={sticker.stickers.get(selected.id) ?? "not_yet"}
            onClose={closeSelected}
            onUpdated={handleStickerUpdated}
            onReportPoster={() => setDialogKind("poster")}
          />
        ) : (
          <UpdateDialog
            key={selected.id}
            board={selected}
            onClose={closeSelected}
            onUpdated={handleUpdated}
          />
        ))
      ) : (
        <InfoDialog board={selected} canJoin={canJoin} onJoin={openJoin} onClose={closeSelected} />
      )}
      <JoinDialog open={isJoinOpen} onOpenChange={handleJoinOpenChange} onJoined={handleJoined} />
      <HelpDialog
        open={isHelpOpen}
        onOpenChange={setIsHelpOpen}
        isVolunteer={isVolunteer}
        stickerEnabled={stickerEnabled}
      />
    </div>
  );
}
