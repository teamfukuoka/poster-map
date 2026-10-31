// OGP 画像の文字に使う Noto Sans JP（DESIGN.md の仮の書体）。
// 画像は build のときに一度だけ作るので、そのときに使う文字だけを Google Fonts から取る。

const TRUETYPE_SRC = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/;

/** text に入っている文字だけの TTF を返す。取れなければ throw して build を止める */
export async function loadNotoSansJp(weight: 700 | 900, text: string): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const src = css.match(TRUETYPE_SRC)?.[1];
  if (!src) throw new Error(`og-font: Noto Sans JP ${weight} の URL が見つからない`);
  const response = await fetch(src);
  if (!response.ok)
    throw new Error(`og-font: Noto Sans JP ${weight} を取れない（${response.status}）`);
  return response.arrayBuffer();
}
