import { board } from "./components/coverage-fixtures";
import { coverageTooltipHtml, markerStyle } from "./coverage-map-view";

describe("markerStyle", () => {
  it("担当なし > 予約あり > 担当ありの順に大きく、塗りの色も違う", () => {
    expect(markerStyle("none").radius).toBeGreaterThan(markerStyle("reserved").radius);
    expect(markerStyle("reserved").radius).toBeGreaterThan(markerStyle("assigned").radius);
    const fills = new Set(
      (["none", "reserved", "assigned"] as const).map((c) => markerStyle(c).fillColor),
    );
    expect(fills.size).toBe(3);
  });

  it("担当ありは、地図に溶けないよう縁を塗りと違う色にする", () => {
    const s = markerStyle("assigned");
    expect(s.color).not.toBe(s.fillColor);
  });
});

describe("coverageTooltipHtml", () => {
  it("値はすべてエスケープする", () => {
    const html = coverageTooltipHtml(
      board({
        board_id: "b1",
        name: "<b>x</b>",
        address: "<i>住所</i>",
        school: "<u>校区</u>",
        town: "<s>町</s>",
        assignee_labels: ["<script>"],
      }),
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<i>");
    expect(html).not.toContain("<u>");
    expect(html).not.toContain("<s>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("番号・住所・校区・町名（丁目）・担当者を出す。担当者がいなければ「担当なし」", () => {
    const html = coverageTooltipHtml(board({ board_id: "b1", assignee_labels: ["A班", "B班"] }));
    expect(html).toContain("東-001");
    expect(html).toContain("福岡市東区馬出1-1");
    expect(html).toContain("馬出小");
    expect(html).toContain("馬出 1丁目");
    expect(html).toContain("A班、B班");
    expect(coverageTooltipHtml(board({ board_id: "b2", assignee_labels: [] }))).toContain(
      "担当なし",
    );
  });

  it("校区・町名の表にない掲示場は空欄でなく「不明」", () => {
    const html = coverageTooltipHtml(
      board({ board_id: "b3", school: null, town: null, chome: null }),
    );
    expect(html).toContain("校区: 不明");
    expect(html).toContain("町名: 不明");
  });
});
