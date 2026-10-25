import type { ReactNode } from "react";
import { isBoardStatus, STATUS_CONFIG } from "@/features/poster-map/status";
import {
  formatJst,
  isBeforeStaleTable,
  siteStateLabel,
  sortWardProgress,
  textOrDash,
} from "../dashboard-view";
import type { Dashboard as DashboardData } from "../types";
import { SiteStateBadge } from "./site-state-badge";

const EMPTY = "いまはありません";

function statusLabel(status: string): string {
  return isBoardStatus(status) ? STATUS_CONFIG[status].label : status;
}

function Section({
  title,
  empty,
  emptyText = EMPTY,
  children,
}: {
  title: string;
  empty: boolean;
  emptyText?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-bold text-brand-dark">{title}</h2>
      {empty ? (
        <p className="rounded-lg bg-card p-3 text-muted-foreground text-sm shadow-card">
          {emptyText}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-card p-3 shadow-card">{children}</div>
      )}
    </section>
  );
}

const TH = "py-1 pr-3 font-normal";
const TD = "py-1 pr-3 align-top";
const NOWRAP = "whitespace-nowrap";

/** 最初の画面。表の順は設計書 §6 */
export function Dashboard({ data, now }: { data: DashboardData; now: Date }) {
  const staleEmptyText = isBeforeStaleTable(now) ? "11月1日14:00から表示します" : EMPTY;
  return (
    <div className="space-y-6">
      <SiteStateBadge label={siteStateLabel(data.site, now)} />

      <Section
        title="長く残っている予約"
        empty={data.stale.length === 0}
        emptyText={staleEmptyText}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className={TH}>番号</th>
              <th className={TH}>区</th>
              <th className={TH}>名前</th>
              <th className={TH}>予約した人</th>
              <th className={TH}>予約の時刻</th>
            </tr>
          </thead>
          <tbody>
            {data.stale.map((row) => (
              <tr key={row.board_id} className="border-t">
                <td className={`${TD} ${NOWRAP}`}>{row.number}</td>
                <td className={`${TD} ${NOWRAP}`}>{row.ward}</td>
                <td className={TD}>{textOrDash(row.name)}</td>
                <td className={TD}>{textOrDash(row.reserved_by)}</td>
                <td className={`${TD} ${NOWRAP}`}>{formatJst(row.reserved_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="「危険」の報告" empty={data.dangerous.length === 0}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className={TH}>番号</th>
              <th className={TH}>区</th>
              <th className={TH}>名前</th>
              <th className={TH}>報告の時刻</th>
              <th className={TH}>報告した人</th>
              <th className={TH}>連絡事項</th>
            </tr>
          </thead>
          <tbody>
            {data.dangerous.map((row) => (
              <tr key={row.board_id} className="border-t">
                <td className={`${TD} ${NOWRAP}`}>{row.number}</td>
                <td className={`${TD} ${NOWRAP}`}>{row.ward}</td>
                <td className={TD}>{textOrDash(row.name)}</td>
                <td className={`${TD} ${NOWRAP}`}>{formatJst(row.reported_at)}</td>
                <td className={TD}>{textOrDash(row.reported_by)}</td>
                <td className={`${TD} min-w-48 whitespace-pre-wrap break-words`}>
                  {textOrDash(row.note)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="新しい連絡事項（直近24時間）" empty={data.reports.length === 0}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className={TH}>報告の時刻</th>
              <th className={TH}>番号</th>
              <th className={TH}>区</th>
              <th className={TH}>状況</th>
              <th className={TH}>報告した人</th>
              <th className={TH}>連絡事項</th>
            </tr>
          </thead>
          <tbody>
            {data.reports.map((row) => (
              <tr key={row.history_id} className="border-t">
                <td className={`${TD} ${NOWRAP}`}>{formatJst(row.created_at)}</td>
                <td className={`${TD} ${NOWRAP}`}>{row.number}</td>
                <td className={`${TD} ${NOWRAP}`}>{row.ward}</td>
                <td className={TD}>{statusLabel(row.new_status)}</td>
                <td className={TD}>{textOrDash(row.display_name)}</td>
                <td className={`${TD} min-w-48 whitespace-pre-wrap break-words`}>
                  {textOrDash(row.note)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="区ごとの進み具合" empty={data.wards.length === 0}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className={TH}>区</th>
              <th className={`${TH} text-right`}>全数</th>
              <th className={`${TH} text-right`}>完了</th>
              <th className={`${TH} text-right`}>予約</th>
            </tr>
          </thead>
          <tbody>
            {sortWardProgress(data.wards).map((row) => (
              <tr key={row.ward} className="border-t">
                <td className={TD}>{row.ward}</td>
                <td className={`${TD} text-right`}>{row.total}</td>
                <td className={`${TD} text-right`}>{row.done}</td>
                <td className={`${TD} text-right`}>{row.reserved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
