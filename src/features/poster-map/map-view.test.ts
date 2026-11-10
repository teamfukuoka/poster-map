import {
  parseViewParam,
  stickerDisplayOf,
  stickerView,
  summarizeStickers,
  summarizeStickersByWard,
  withViewParam,
} from "./map-view";
import type { StickerStatus } from "./sticker-status";
import type { MapBoard } from "./types";

describe("parseViewParam", () => {
  test("シールを始めていなければ、URL にかかわらずポスター", () => {
    expect(parseViewParam("?view=sticker", false)).toBe("poster");
  });

  test("シールを始めていれば、指定がないときはシール", () => {
    expect(parseViewParam("", true)).toBe("sticker");
    expect(parseViewParam("?districts=a", true)).toBe("sticker");
  });

  test("view=poster のときだけポスター。知らない値はシール", () => {
    expect(parseViewParam("?view=poster", true)).toBe("poster");
    expect(parseViewParam("?view=other", true)).toBe("sticker");
  });
});

describe("withViewParam", () => {
  test("ほかの値と # を残して view だけ差し替える", () => {
    expect(withViewParam("https://example.test/?districts=a&view=poster#x", "sticker")).toBe(
      "/?districts=a&view=sticker#x",
    );
  });

  test("null なら view を消す", () => {
    expect(withViewParam("https://example.test/guide?view=sticker", null)).toBe("/guide");
  });
});

describe("stickerDisplayOf", () => {
  test("シールが未なら、ポスターが完了の掲示板だけ対象", () => {
    expect(stickerDisplayOf({ status: "done" }, undefined)).toBe("not_yet");
    expect(stickerDisplayOf({ status: "not_yet" }, undefined)).toBe("not_target");
    expect(stickerDisplayOf({ status: "reserved" }, "not_yet")).toBe("not_target");
  });

  test("予約・完了・問題ありは、ポスターの状態が変わってもそのまま出す", () => {
    expect(stickerDisplayOf({ status: "error_wrong_poster" }, "done")).toBe("done");
    expect(stickerDisplayOf({ status: "not_yet" }, "issue")).toBe("issue");
    expect(stickerDisplayOf({ status: "done" }, "reserved")).toBe("reserved");
  });
});

const board = (id: string, status: MapBoard["status"], ward = "中央区"): MapBoard => ({
  id,
  number: id,
  name: `掲示板${id}`,
  address: "",
  ward,
  lat: 33.59,
  long: 130.4,
  status,
});

describe("summarizeStickers", () => {
  test("対象はポスターが完了の数。完了率は対象に対する割合", () => {
    const boards = [
      board("1", "done"),
      board("2", "done"),
      board("3", "done"),
      board("4", "not_yet"),
    ];
    const stickers = new Map<string, StickerStatus>([
      ["1", "done"],
      ["2", "reserved"],
    ]);
    const summary = summarizeStickers(boards, stickers);
    expect(summary.target).toBe(3);
    expect(summary.counts).toEqual({
      not_yet: 1,
      reserved: 1,
      done: 1,
      issue: 0,
      not_target: 1,
    });
    expect(summary.donePercent).toBe(33.3);
  });

  test("対象がなければ 0%、対象より完了が多くても 100% まで", () => {
    expect(summarizeStickers([board("1", "not_yet")], new Map()).donePercent).toBe(0);
    // ポスターが完了でなくなった掲示板のシール完了も数える
    const boards = [board("1", "done"), board("2", "not_yet")];
    const stickers = new Map<string, StickerStatus>([
      ["1", "done"],
      ["2", "done"],
    ]);
    expect(summarizeStickers(boards, stickers).donePercent).toBe(100);
  });
});

describe("summarizeStickersByWard", () => {
  test("区の決まった順に並べ、知らない区は最後", () => {
    const boards = [
      board("1", "done", "西区"),
      board("2", "done", "東区"),
      board("3", "done", "どこか"),
      board("4", "done", "東区"),
    ];
    const rows = summarizeStickersByWard(boards, new Map([["2", "done" as const]]));
    expect(rows.map((r) => r.ward)).toEqual(["東区", "西区", "どこか"]);
    expect(rows[0].summary).toMatchObject({ target: 2, donePercent: 50 });
  });
});

describe("stickerView", () => {
  test("対象外のマーカーは薄くする", () => {
    const view = stickerView(new Map());
    expect(view.marker(board("1", "not_yet")).faded).toBe(true);
    expect(view.marker(board("2", "done")).faded).toBe(false);
  });
});
