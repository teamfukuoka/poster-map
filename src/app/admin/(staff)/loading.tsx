// 画面の移動を押したらすぐ出す（中身は DB に問い合わせてから届く）
export default function Loading() {
  return (
    <output className="flex min-h-[40vh] items-center justify-center rounded-lg bg-muted text-muted-foreground text-sm">
      読み込み中…
    </output>
  );
}
