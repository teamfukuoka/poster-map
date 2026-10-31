import { ImageResponse } from "next/og";
import { loadNotoSansJp } from "@/lib/og-font";

// 公開の画面を SNS・LINE でシェアしたときの画像。管理画面は (staff) と login で外す。
// 公開前に陣営の承認と election-law-check・redteam-check を通す文言。
// サイト名は受理の前後で変わるので、画像には変わらない名前だけを入れる（title は layout が DB から出す）。
const TITLE = "福岡市ポスター掲示板マップ";
const LINES = ["掲示板の場所と、貼り終えたかどうかを", "地図で確かめられます。"];

export const alt = `${TITLE}：${LINES.join("")}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 色は DESIGN.md（#212121 の文字・#00AFCC・Web の #EAF8FA と #0081CC→#00AFCC の帯）
const INK = "#212121";
const BRAND = "#00AFCC";
const BRAND_LIGHT = "#EAF8FA";
const PIN_PATH =
  "M16 1.5C10.2 1.5 5.5 6.1 5.5 11.8 5.5 19.6 16 30.5 16 30.5S26.5 19.6 26.5 11.8C26.5 6.1 21.8 1.5 16 1.5Zm0 6a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6Z";

export default async function Image() {
  const [black, bold] = await Promise.all([
    loadNotoSansJp(900, TITLE),
    loadNotoSansJp(700, LINES.join("")),
  ]);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#FFFFFF",
        fontFamily: "Noto Sans JP",
        color: INK,
      }}
    >
      <div
        style={{
          height: 16,
          width: "100%",
          background: "linear-gradient(90deg, #0081CC, #00AFCC)",
        }}
      />
      {/* LINE などは真ん中を切り取って出すので、中央にそろえる */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 70,
            background: BRAND_LIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="84" height="84" viewBox="0 0 32 32" aria-hidden="true">
            <path fill={BRAND} fillRule="evenodd" d={PIN_PATH} />
          </svg>
        </div>
        <div style={{ fontSize: 76, fontWeight: 900, lineHeight: 1.2 }}>{TITLE}</div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontSize: 38,
            fontWeight: 700,
          }}
        >
          {LINES.map((line) => (
            <div key={line} style={{ lineHeight: 1.6 }}>
              {line}
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 16, width: "100%", background: BRAND_LIGHT }} />
    </div>,
    {
      ...size,
      fonts: [
        { name: "Noto Sans JP", data: black, weight: 900, style: "normal" },
        { name: "Noto Sans JP", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
