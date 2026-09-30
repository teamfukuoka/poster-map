"use client";
// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import { CircleHelp } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { loadMyBoardIdsAction, loadVolunteerBoardsAction } from "../actions";
import { toUserMessage } from "../errors";
import { fetchPublicBoards } from "../public-boards";
import type { MapBoard } from "../types";
import { useBoardFilter } from "../use-board-filter";
import type { Viewer } from "../volunteer-service";
import { BoardFilter } from "./board-filter";
import { ClosedNotice } from "./closed-notice";
import { HelpDialog } from "./help-dialog";
import { InfoDialog } from "./info-dialog";
import { JoinDialog } from "./join-dialog";
import { SummaryBar } from "./summary-bar";
import { UpdateDialog } from "./update-dialog";
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

type Loaded = { state: LoadState; myBoardIds: ReadonlySet<string> };

const EMPTY_IDS: ReadonlySet<string> = new Set();
const EMPTY_BOARDS: MapBoard[] = [];

async function loadVolunteerBoards(): Promise<Loaded> {
  const [boards, mine] = await Promise.all([loadVolunteerBoardsAction(), loadMyBoardIdsAction()]);
  if (!boards.ok) return { state: { kind: "error", message: boards.error }, myBoardIds: EMPTY_IDS };
  return {
    state: { kind: "ok", boards: boards.data },
    myBoardIds: mine.ok ? new Set(mine.data) : EMPTY_IDS,
  };
}

async function loadBoards(isVolunteer: boolean): Promise<Loaded> {
  if (!isVolunteer) {
    const result = await fetchPublicBoards();
    if (result.kind === "ok") {
      return { state: { kind: "ok", boards: result.boards }, myBoardIds: EMPTY_IDS };
    }
    return { state: result, myBoardIds: EMPTY_IDS };
  }
  try {
    return await loadVolunteerBoards();
  } catch {
    // Server Action は通信の切断や再デプロイで reject することがある
    return { state: { kind: "error", message: toUserMessage(null) }, myBoardIds: EMPTY_IDS };
  }
}

export function PosterMapApp({ initialViewer }: { initialViewer: Viewer }) {
  const [viewer, setViewer] = useState(initialViewer);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [myBoardIds, setMyBoardIds] = useState<ReadonlySet<string>>(EMPTY_IDS);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<MapBoard | null>(null);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey は再読み込みの合図
  useEffect(() => {
    let active = true;
    // 地図を表示しているときは作り直さない。裏で取り直して差し替える
    if (stateRef.current.kind !== "ok") setState({ kind: "loading" });
    loadBoards(isVolunteer).then((loaded) => {
      if (!active) return;
      // 裏での取り直しに失敗しても、今の表示を残す
      if (loaded.state.kind !== "ok" && stateRef.current.kind === "ok") return;
      setState(loaded.state);
      setMyBoardIds(loaded.myBoardIds);
    });
    return () => {
      active = false;
    };
  }, [isVolunteer, reloadKey]);

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

  const boards = state.kind === "ok" ? state.boards : EMPTY_BOARDS;
  const filter = useBoardFilter(boards, myBoardIds);

  const handleBoardClick = useCallback((board: MapBoard) => setSelected(board), []);
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
    if (board) setSelected(board);
  };

  const handleUpdated = (updated: MapBoard) => {
    setState((prev) =>
      prev.kind === "ok"
        ? { kind: "ok", boards: prev.boards.map((b) => (b.id === updated.id ? updated : b)) }
        : prev,
    );
    setMyBoardIds((prev) => new Set(prev).add(updated.id));
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
          <SummaryBar boards={boards} />
          <PosterMap
            boards={filter.filteredBoards}
            onBoardClick={handleBoardClick}
            controls={
              <BoardFilter
                filterState={filter.filterState}
                canShowMine={isVolunteer}
                onToggleStatus={filter.toggleStatus}
                onToggleShowOnlyMine={filter.toggleShowOnlyMine}
                onSelectAll={filter.selectAll}
                onDeselectAll={filter.deselectAll}
              />
            }
          />
          <WardSummary boards={boards} />
        </>
      )}

      {isVolunteer ? (
        selected && (
          <UpdateDialog
            key={selected.id}
            board={selected}
            onClose={closeSelected}
            onUpdated={handleUpdated}
          />
        )
      ) : (
        <InfoDialog board={selected} canJoin={canJoin} onJoin={openJoin} onClose={closeSelected} />
      )}
      <JoinDialog open={isJoinOpen} onOpenChange={handleJoinOpenChange} onJoined={handleJoined} />
      <HelpDialog open={isHelpOpen} onOpenChange={setIsHelpOpen} isVolunteer={isVolunteer} />
    </div>
  );
}
