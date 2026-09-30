"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STATUS_CONFIG } from "../status";
import type { MapBoard } from "../types";
import { BoardInfo } from "./board-info";

type Props = {
  board: MapBoard | null;
  /** 参加の案内を出すか（停止された端末では出さない） */
  canJoin: boolean;
  onJoin: () => void;
  onClose: () => void;
};

/** 参加していない人向け。状況を見るだけ */
export function InfoDialog({ board, canJoin, onJoin, onClose }: Props) {
  return (
    <Dialog open={board !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>掲示板の情報</DialogTitle>
          <DialogDescription>
            現在の状況：{board ? STATUS_CONFIG[board.status].label : ""}
          </DialogDescription>
        </DialogHeader>
        {board && <BoardInfo board={board} />}
        <DialogFooter>
          {canJoin && (
            <Button variant="outline" onClick={onJoin}>
              参加コードをお持ちの方
            </Button>
          )}
          <Button onClick={onClose}>閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
