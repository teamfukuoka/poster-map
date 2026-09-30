import { Button } from "@/components/ui/button";

type Props = {
  /** 参加の案内を出すか（停止された端末では出さない） */
  canJoin: boolean;
  onJoin: () => void;
};

/** 公開期間外に、ボランティア以外が開いたときの表示 */
export function ClosedNotice({ canJoin, onJoin }: Props) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-lg border bg-card p-6 text-center">
      <p className="font-semibold">地図は公開期間中にご覧いただけます。</p>
      {canJoin && (
        <Button variant="outline" onClick={onJoin}>
          参加コードをお持ちの方
        </Button>
      )}
    </div>
  );
}
