import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";

export type CsvRow = Record<string, string>;

/** ヘッダー付きの CSV を行のオブジェクトにする（BOM・前後の空白・空行を除く） */
export function parseCsv(text: string): CsvRow[] {
  return parse(text, { columns: true, bom: true, skip_empty_lines: true, trim: true });
}

export function readCsvFiles(paths: readonly string[]): CsvRow[] {
  return paths.flatMap((path) => parseCsv(readFileSync(path, "utf8")));
}
