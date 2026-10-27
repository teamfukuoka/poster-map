import type { NormalizedBoard } from "./normalize-boards";
import type { CsvRow } from "./read-csv";

/** 掲示場ごとの校区・町名（private.board_areas の 1 行） */
export type BoardArea = {
  number: string;
  school: string;
  /** pdf: 通学区域一覧表で決まった / map: 地図で近い掲示場から決めた */
  schoolSource: "pdf" | "map";
  town: string;
  /** 丁目のない町名は null。数字だけ（"1"） */
  chome: string | null;
};

const REQUIRED_COLUMNS = ["number", "school", "school_source", "town", "chome"] as const;

/** 校区・町名の CSV を読む。問題のある行は areas に入れず、番号入りの 1 行にして problems に返す */
export function parseBoardAreas(rows: readonly CsvRow[]): {
  areas: BoardArea[];
  problems: string[];
} {
  if (rows.length > 0) {
    for (const column of REQUIRED_COLUMNS) {
      if (!(column in rows[0])) {
        throw new Error(`校区・町名の CSV に ${column} 列がありません`);
      }
    }
  }

  const areas: BoardArea[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const number = row.number ?? "";
    const label = number || `${index + 2} 行目（番号なし）`;
    if (!number) {
      problems.push(`${label}: 番号が空です`);
      return;
    }
    if (seen.has(number)) {
      problems.push(`${label}: 番号が重複しています`);
      return;
    }
    seen.add(number);
    if (row.school_source !== "pdf" && row.school_source !== "map") {
      problems.push(`${label}: school_source は pdf か map です（${row.school_source}）`);
      return;
    }
    if (!row.school) {
      problems.push(`${label}: school が空です`);
      return;
    }
    if (!row.town) {
      problems.push(`${label}: town が空です`);
      return;
    }
    if (row.chome && !/^\d+$/.test(row.chome)) {
      problems.push(`${label}: chome は数字だけです（${row.chome}）`);
      return;
    }
    areas.push({
      number,
      school: row.school,
      schoolSource: row.school_source,
      town: row.town,
      chome: row.chome || null,
    });
  });
  return { areas, problems };
}

/** 校区・町名の表にない掲示板の番号（取り込みを止めるのに使う） */
export function missingAreaNumbers(
  boards: readonly NormalizedBoard[],
  areas: readonly BoardArea[],
): string[] {
  const known = new Set(areas.map((area) => area.number));
  return boards.map((board) => board.number).filter((number) => !known.has(number));
}
