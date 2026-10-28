import type { ReactNode } from "react";
import { isBoardStatus, STATUS_CONFIG } from "@/features/poster-map/status";
import { formatShare, isRehearsalNotePeriod, REHEARSAL_NOTE } from "../coverage-view";
import {
  formatJst,
  isBeforeStaleTable,
  siteStateLabel,
  sortWardProgress,
  sumWardProgress,
  textOrDash,
} from "../dashboard-view";
import type { HelpId } from "../help-sections";
import type { Dashboard as DashboardData } from "../types";
import { HelpLink, SectionTitle } from "./help-link";
import { SiteStateBadge } from "./site-state-badge";

const EMPTY = "いまはありません";

function statusLabel(status: string): string {
  return isBoardStatus(status) ? STATUS_CONFIG[status].label : status;
}

function Section({
  title,
  help,
  empty,
  emptyText = EMPTY,
  children,
}: {
  title: string;
  help: HelpId;
  empty: boolean;
  emptyText?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <SectionTitle help={help}>{title}</SectionTitle>
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
  const wardTotals = sumWardProgress(data.wards);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <SiteStateBadge label={siteStateLabel(data.site)} />
        <HelpLink id="dashboard" />
      </div>

      <Section
        title="長く残っている予約"
        help="dashboard-stale"
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

      <Section title="「危険」の報告" help="dashboard-danger" empty={data.dangerous.length === 0}>
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

      <Section
        title="新しい連絡事項（直近24時間）"
        help="dashboard-reports"
        empty={data.reports.length === 0}
      >
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

      <Section title="区ごとの進み具合" help="dashboard-wards" empty={data.wards.length === 0}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className={TH}>区</th>
              <th className={`${TH} text-right`}>全数</th>
              <th className={`${TH} text-right`}>計画</th>
              <th className={`${TH} text-right`}>実績</th>
            </tr>
          </thead>
          <tbody>
            {sortWardProgress(data.wards).map((row) => (
              <tr key={row.ward} className="border-t">
                <td className={TD}>{row.ward}</td>
                <td className={`${TD} text-right`}>{row.total}</td>
                <td className={`${TD} text-right`}>{formatShare(row.planned, row.total)}</td>
                <td className={`${TD} text-right`}>{formatShare(row.done, row.total)}</td>
              </tr>
            ))}
            <tr className="border-t font-bold">
              <td className={TD}>合計</td>
              <td className={`${TD} text-right`}>{wardTotals.total}</td>
              <td className={`${TD} text-right`}>
                {formatShare(wardTotals.planned, wardTotals.total)}
              </td>
              <td className={`${TD} text-right`}>
                {formatShare(wardTotals.done, wardTotals.total)}
              </td>
            </tr>
          </tbody>
        </table>
        {isRehearsalNotePeriod(now) && (
          <p className="mt-2 text-muted-foreground text-xs">{REHEARSAL_NOTE}</p>
        )}
      </Section>
    </div>
  );
}
