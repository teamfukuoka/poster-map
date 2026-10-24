import Link from "next/link";
import type { ReactNode } from "react";
import { FALLBACK_MESSAGE, toUserMessage } from "../errors";
import { DISPLAY_NAME_MAX_LENGTH, NOTE_MAX_LENGTH } from "../limits";
import { LOAD_ERROR } from "../public-boards";
import { type BoardStatus, PIE_ORDER, STATUS_CONFIG } from "../status";

type Props = {
  /** 参加中のボランティアか。取材・ネットの投稿への対応、交通費の案内、陣営内の問い合わせ先は参加中の人にだけ出す */
  isVolunteer: boolean;
  /** 陣営内の問い合わせ先（VOLUNTEER_CONTACT）。未設定なら受け取った担当者を案内する */
  volunteerContact?: string;
};

// DB の private.site_settings（公開期間）と揃えること
const PUBLIC_WINDOW_LABEL = "11/1（日）12:00 〜 11/14（土）23:55";

const FALLBACK_CONTACT = "参加コードを受け取った陣営の担当者に連絡してください。";

const STATUS_MEANING: Record<BoardStatus, string> = {
  done: "貼り終えた",
  reserved: "誰かが向かっている",
  not_yet: "まだ貼っていない",
  not_yet_dangerous: "貼りに行くのが危ない",
  error_wrong_poster: "貼る区画にほかのポスターがあって貼れない",
  other: "連絡事項に様子が書いてある",
};

const TROUBLES: { message: string; action: string }[] = [
  {
    message: toUserMessage({ message: "invalid_invite_code" }),
    action:
      "コードを入れ直してください。先頭が大文字になっていないか確かめてください（コードは小文字と数字だけ）。それでもだめなら問い合わせ先へ",
  },
  {
    message: toUserMessage({ message: "too_many_attempts" }),
    action: "15 分ほど待ってから、もう一度入れてください",
  },
  {
    message: toUserMessage({ message: "invalid_display_name" }),
    action: `ニックネームを ${DISPLAY_NAME_MAX_LENGTH} 文字以内にしてください`,
  },
  {
    message: toUserMessage({ message: "over_request_rate_limit" }),
    action: "参加する人が多い時間です。少し時間をおいてください",
  },
  {
    message: toUserMessage({ message: "not_a_volunteer" }),
    action: "参加の記録が消えています。「参加する」の手順でもう一度参加してください",
  },
  {
    message: toUserMessage({ message: "volunteer_revoked" }),
    action: "問い合わせ先へ連絡してください（地図を見ることはできます）",
  },
  {
    message: toUserMessage({ message: "note_too_long" }),
    action: "連絡事項を短くしてください",
  },
  {
    message: toUserMessage({ message: "board_not_found" }),
    action: "ページを読み込み直してください",
  },
  {
    // components/poster-map.tsx の現在地ボタンの文言と揃える（client モジュールなので import しない）
    message: "現在地を取得できませんでした。位置情報の許可を確認してください。",
    action: "スマホの設定で、ブラウザの位置情報を許可してください",
  },
  {
    message: LOAD_ERROR,
    action: "電波のよい場所で「もう一度読み込む」を押してください",
  },
  {
    message: FALLBACK_MESSAGE,
    action: "少し待ってからやり直してください。続くときは問い合わせ先へ",
  },
];

const SECTIONS = [
  ["prepare", "用意するもの"],
  ["open", "地図を開く"],
  ["join", "参加する（最初の 1 回だけ）"],
  ["read", "地図の見方"],
  ["search", "掲示場を探す"],
  ["pin", "ピンを押すと"],
  ["report", "報告する"],
  ["note", "連絡事項の書き方"],
  ["trouble", "困ったとき"],
  ["rules", "選挙のルール（必ず守ってください）"],
  ["contact", "問い合わせ先"],
] as const;

type SectionId = (typeof SECTIONS)[number][0];

function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  const title = SECTIONS.find(([key]) => key === id)?.[1];
  return (
    <section id={id} className="scroll-mt-4 space-y-2">
      <h2 className="border-brand border-l-4 pl-2 font-semibold text-base">{title}</h2>
      {children}
    </section>
  );
}

const TABLE =
  "w-full border-collapse text-left text-sm [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted [&_th]:p-2";

export function GuideContent({ isVolunteer, volunteerContact }: Props) {
  const contact = isVolunteer && volunteerContact ? volunteerContact : FALLBACK_CONTACT;
  return (
    <article className="max-w-2xl space-y-6 text-sm leading-relaxed">
      <header className="space-y-2">
        <h1 className="font-bold text-xl">使い方ガイド</h1>
        <p className="text-muted-foreground">ボランティアのみなさんへ</p>
        <p>
          福岡市内の公営のポスター掲示場を地図にして、「これから行く場所」と「貼り終えた場所」をみんなで共有するためのサイトです。同じ場所に二人で行ってしまうことや、貼り残しを減らせます。
        </p>
      </header>

      <div className="space-y-1 rounded-lg border border-brand bg-card p-4">
        <p className="font-semibold">最初にこれだけ</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            参加コードは、受け取ったあなただけのものです。SNS・オープンチャット・グループの投稿に貼らないでください。
          </li>
          <li>
            向かう掲示場を決めたら「予約」、貼り終えたら「完了」で報告します。予約は、ほかの人に「ここには私が行きます」と知らせるためのものです。
          </li>
          <li>
            危ない場所では無理をしないでください。「危険」で報告して、その場を離れてかまいません。
          </li>
        </ol>
      </div>

      <nav aria-label="目次" className="rounded-lg bg-muted p-4">
        <ol className="list-decimal space-y-0.5 pl-5">
          {SECTIONS.map(([id, title]) => (
            <li key={id}>
              <a href={`#${id}`} className="underline">
                {title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="prepare">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            スマートフォン（Safari か Chrome などのブラウザ。アプリのインストールは要りません）
          </li>
          <li>陣営から受け取った参加コード</li>
          <li>ポスターと貼る道具、貼る区画の番号（陣営からの案内に従ってください）</li>
        </ul>
      </Section>

      <Section id="open">
        <ul className="list-disc space-y-1 pl-5">
          <li>一般のみなさんが地図を見られるのは {PUBLIC_WINDOW_LABEL} です。</li>
          <li>参加したボランティアは、この時間の外でも地図を見て報告できます。</li>
          <li>
            公開の前に開くと「地図は公開期間中にご覧いただけます。」と出ます。そのまま「参加コードをお持ちの方」を押して参加してください。
          </li>
          <li>ホーム画面に追加しておくと、すぐに開けて便利です。</li>
        </ul>
      </Section>

      <Section id="join">
        <ol className="list-decimal space-y-1 pl-5">
          <li>画面上の「参加コードをお持ちの方」を押す（地図のピンを押したときにも出ます）</li>
          <li>
            「参加コード」に、受け取ったコードを入れる
            <br />
            コードは英語の小文字と数字だけです。スマホで先頭の 1
            文字が大文字になっていたら、小文字に直してください。
          </li>
          <li>
            「ニックネーム」に呼び名を入れる（{DISPLAY_NAME_MAX_LENGTH} 文字まで）
            <br />
            本名でなくて大丈夫です。ほかのボランティアに表示されます。
          </li>
          <li>「参加する」を押す</li>
          <li>画面の左上に「〇〇 さんとして参加中」と出たら完了です</li>
        </ol>
        <p className="font-semibold">知っておいてほしいこと</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            参加の記録は、その端末のそのブラウザに残ります（Cookie）。登録するのはニックネームだけです。
          </li>
          <li>別のスマホや別のブラウザで使うときは、同じ参加コードでもう一度参加してください。</li>
          <li>
            シークレットモード（プライベートブラウズ）で参加すると、閉じたときに参加の記録が消えます。ふつうのモードで開いてください。
          </li>
          <li>ブラウザの履歴や Cookie を消したときも、もう一度参加すれば元どおり使えます。</li>
        </ul>
      </Section>

      <Section id="read">
        <ul className="list-disc space-y-1 pl-5">
          <li>地図の上に、掲示場の数・完了の数・完了率と、状況ごとの数が出ます。</li>
          <li>地図の下の「区ごとの状況」で、区ごとの進み具合が分かります。</li>
          <li>
            数字の入った円は、近くの掲示場をまとめたものです。地図を拡大すると、1
            か所ずつのピンに分かれます。
          </li>
          <li>地図の右上の「使い方」を押すと、このガイドの短い版がいつでも見られます。</li>
        </ul>
        <table className={TABLE}>
          <thead>
            <tr>
              <th>色</th>
              <th>状況</th>
              <th>意味</th>
            </tr>
          </thead>
          <tbody>
            {PIE_ORDER.map((status) => (
              <tr key={status}>
                <td>
                  <span
                    aria-hidden
                    className="inline-block h-3 w-3 rounded-full align-middle"
                    style={{ backgroundColor: STATUS_CONFIG[status].color }}
                  />
                </td>
                <td>{STATUS_CONFIG[status].shortLabel}</td>
                <td>{STATUS_MEANING[status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="search">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            検索：地図の上の欄に、番号・名称・住所の一部を入れます。番号は「一本木-1」のような形です。2
            文字以上で候補が出るので、選ぶとその場所に移ります。
          </li>
          <li>
            現在地：地図の右下の「現在地」を押すと、今いる場所が出ます。初めてのときは位置情報の許可を求められます。位置情報はその端末の中だけで使い、サイトには送りません。
          </li>
          <li>
            フィルター：地図の右上の「フィルター」で、表示する状況を絞り込めます。「未貼付」だけにすると、まだ誰も行っていない場所が分かります。「自分が更新したものだけ」にチェックを入れると、自分が予約・報告した場所だけが出ます。
          </li>
          <li>全画面：地図の左下のボタンで、地図を画面いっぱいに広げられます。</li>
        </ul>
      </Section>

      <Section id="pin">
        <ul className="list-disc space-y-1 pl-5">
          <li>掲示場の番号・名称・住所が出ます。名称と住所はボタンでコピーできます。</li>
          <li>「Google マップ」「Apple マップ」を押すと、地図アプリで道案内を始められます。</li>
        </ul>
      </Section>

      <Section id="report">
        <p className="font-semibold">基本の流れ</p>
        <table className={TABLE}>
          <thead>
            <tr>
              <th>いつ</th>
              <th>選ぶ状況</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>向かう掲示場を決めたら</td>
              <td>{STATUS_CONFIG.reserved.label}</td>
            </tr>
            <tr>
              <td>貼り終えたら</td>
              <td>{STATUS_CONFIG.done.label}</td>
            </tr>
            <tr>
              <td>予約したけれど行けなくなったら</td>
              <td>{STATUS_CONFIG.not_yet.label}（ほかの人が行けるように戻す）</td>
            </tr>
            <tr>
              <td>その場ですぐ貼れるとき</td>
              <td>{STATUS_CONFIG.done.label}だけ（予約はしなくてかまいません）</td>
            </tr>
          </tbody>
        </table>
        <p className="font-semibold">予約とは</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            ほかの人に「ここには私が行きます」と知らせるためのものです。予約すると、ほかの人の地図で黄色になり、同じ場所に二人で向かうのを防げます。
          </li>
          <li>
            予約は時間がたっても消えません。行けなくなったら、必ず「{STATUS_CONFIG.not_yet.label}
            」に戻してください。
          </li>
          <li>予約しても、ほかの人が報告できなくなるわけではありません。</li>
        </ul>
        <p className="font-semibold">報告のしかた</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>地図のピンを押す</li>
          <li>「ポスターの状況を報告」で、当てはまる状況を 1 つ選ぶ</li>
          <li>
            必要なら「連絡事項（任意）」に様子を書く（下の「連絡事項の書き方」を見てください）
          </li>
          <li>「報告する」を押す</li>
          <li>「報告しました。ありがとうございます。」と出たら完了です。地図の色も変わります</li>
        </ol>
        <p className="font-semibold">こんなときは</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            貼りに行くのが危ない（交通量が多い、足場が悪い、夜で暗い など）→「
            {STATUS_CONFIG.not_yet_dangerous.label}
            」を選び、連絡事項に理由を書く。無理に貼らないでください。
          </li>
          <li>
            貼る区画にほかのポスターがある →「{STATUS_CONFIG.error_wrong_poster.label}
            」を選ぶ。そのポスターには触らない・はがさないでください。
          </li>
          <li>
            掲示場が見つからない・壊れている など →「{STATUS_CONFIG.other.label}
            」を選び、連絡事項に様子を書く。
          </li>
          <li>間違えて報告した → もう一度正しい状況で報告すれば、上書きされます。</li>
        </ul>
        <p className="font-semibold">ほかの人の予約</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>黄色（予約）の場所には、すでに誰かが向かっています。ほかの場所を選んでください。</li>
          <li>ピンを押したときの「更新履歴」で、誰がいつ報告したかが分かります。</li>
        </ul>
      </Section>

      <Section id="note">
        <p>
          連絡事項はほかのボランティアにも表示されます。画面が人の目に触れることもあると思って書いてください。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            書いてよいこと：「掲示板が傾いている」「番号札が見当たらない」「工事中で近づけない」など、掲示場の様子
          </li>
          <li>
            書かないこと：人の名前・顔や服装・車のナンバーなど、個人が特定できること／近くに住んでいる人や、声をかけてきた人のこと／ほかの候補者の名前や、ポスターについての感想
          </li>
          <li>{NOTE_MAX_LENGTH} 文字まで書けます。短くて大丈夫です。</li>
        </ul>
      </Section>

      <Section id="trouble">
        <table className={TABLE}>
          <thead>
            <tr>
              <th>画面に出る文言</th>
              <th>どうする</th>
            </tr>
          </thead>
          <tbody>
            {TROUBLES.map(({ message, action }) => (
              <tr key={message}>
                <td>{message}</td>
                <td>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="rules">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            ポスター貼りは、立候補の届出が受理された後から。11/1（日）、陣営から合図があってから始めてください。
          </li>
          <li>
            貼るのは、陣営から受け取ったポスターだけ。公営の掲示場の、案内された番号の区画に貼ります。ほかの場所に貼ったり、自分で作ったりしないでください。
          </li>
          <li>
            ほかの候補者のポスターには触らない。はがしたり、汚したり、動かしたりすると、法律で罰せられることがあります。
          </li>
          <li>
            ポスター貼りを含む選挙運動は、11/14（土）まで。11/15（日）の投票日は、貼りに行かないでください。
          </li>
          <li>
            お礼や報酬はありません。ボランティアどうしでも、物やお金のやりとりはしないでください。
            {isVolunteer && "交通費などは陣営の案内に従ってください。"}
          </li>
          <li>
            18 歳未満の方は、選挙運動を手伝えません。ご家族やお知り合いに 18
            歳未満の方がいるときも、お願いしないでください。
          </li>
          <li>
            参加中の画面（ニックネームや連絡事項）を SNS
            に載せない。ほかのボランティアの名前が写ります。
          </li>
          {isVolunteer && (
            <>
              <li>
                記者の方や、ほかの陣営の方などに声をかけられたら、その場で答えずに、問い合わせ先へ知らせてください。
              </li>
              <li>
                ネットで気になる投稿を見つけても、反論やコメントはせず、投稿のアドレスを問い合わせ先へ送ってください。
              </li>
            </>
          )}
        </ul>
      </Section>

      <Section id="contact">
        <p className="whitespace-pre-line">{contact}</p>
      </Section>

      <p>みなさんの一歩一歩で、地図が少しずつ青緑に変わっていきます。ありがとうございます。</p>

      <p>
        <Link href="/" className="underline">
          地図に戻る
        </Link>
      </p>
    </article>
  );
}
