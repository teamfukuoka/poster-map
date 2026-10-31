import Link from "next/link";
import type { ReactNode } from "react";
import { toUserMessage } from "@/features/poster-map/errors";
import { STATUS_CONFIG } from "@/features/poster-map/status";
import { REHEARSAL_NOTE } from "../coverage-view";
import { HELP_SECTIONS, type HelpId, type HelpSectionId, helpTitle } from "../help-sections";
import {
  INVITE_CODE_MAX_LENGTH,
  INVITE_CODE_MIN_LENGTH,
  LABEL_MAX_LENGTH,
  PUBLISH_CONFIRM_WORD,
  RESET_CONFIRM_WORD,
  REVERT_CONFIRM_WORD,
} from "../validation";

// DB の private.site_settings（公開期間）と site_name の切り替えに揃えること
const PUBLIC_WINDOW_LABEL = "11/1（日）0:00 〜 11/14（土）23:58";
const NAME_BEFORE = "福岡市ポスター掲示板マップ";
const NAME_AFTER = "佐々木あやの ポスター掲示板マップ";

const TABLE =
  "w-full border-collapse text-left text-sm [&_td]:border [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:bg-muted [&_th]:p-2";

function Section({ id, children }: { id: HelpSectionId; children: ReactNode }) {
  const section = HELP_SECTIONS.find((s) => s.id === id);
  const href = section && "href" in section ? section.href : undefined;
  return (
    <section id={id} className="scroll-mt-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-brand border-l-4 pl-2">
        <h2 className="font-semibold text-base">{helpTitle(id)}</h2>
        {href && (
          <Link href={href} className="text-brand-dark text-xs underline underline-offset-2">
            この画面を開く
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Topic({
  id,
  adminOnly,
  children,
}: {
  id: HelpId;
  adminOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 space-y-1">
      <h3 className="font-semibold">
        {helpTitle(id)}
        {adminOnly && <AdminOnly />}
      </h3>
      {children}
    </section>
  );
}

function AdminOnly() {
  return (
    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 align-middle font-normal text-muted-foreground text-xs">
      管理者だけ
    </span>
  );
}

function Ul({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}

function Ol({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-1 pl-5">{children}</ol>;
}

/** 画面のボタン・見出しの名前 */
function Ui({ children }: { children: ReactNode }) {
  return <span className="font-semibold">「{children}」</span>;
}

const SCREENS: { id: HelpSectionId; does: string; who: string }[] = [
  {
    id: "dashboard",
    does: "公開の状態と、気をつける報告・区ごとの進み具合を見る",
    who: "全員",
  },
  { id: "codes", does: "参加コードの登録・確認・失効", who: "見るのは全員・登録と失効は管理者" },
  { id: "coverage", does: "担当者に地域を割り当て、担当のいない掲示場を見つける", who: "全員" },
  { id: "site", does: "一般の人への公開の切り替えと、リハーサルの片付け", who: "管理者" },
  { id: "members", does: "管理画面に入れる人を見る・登録する・外す", who: "管理者" },
  { id: "audit", does: "管理画面での操作を新しい順に見る", who: "全員" },
];

const TROUBLES: { when: ReactNode; action: ReactNode }[] = [
  {
    when: `ボランティアの画面に「${toUserMessage({ message: "invalid_invite_code" })}」`,
    action: (
      <>
        配ったとおりに入れているか（大文字・小文字・記号、スマホで先頭が大文字になっていないか）を確かめてもらう。
        <Ui>参加コード</Ui>の一覧で、そのコードが「有効」かを見る。
      </>
    ),
  },
  {
    when: "「参加コードの入力に続けて失敗したため、受付を一時停止しています。…」",
    action: "15分ほど待ってから入れ直してもらう。",
  },
  {
    when: `「${toUserMessage({ message: "over_request_rate_limit" })}」が続く`,
    action:
      "一度に参加する人が多いと出る。少し時間をずらしてもらい、IT 担当に知らせる（参加の上限を上げる）。",
  },
  {
    when: `「${toUserMessage({ message: "volunteer_revoked" })}」`,
    action:
      "コードを失効させたときに止めた人。誤って止めたなら、新しいコードを渡して参加し直してもらう。",
  },
  {
    when: "参加コードが外にもれた（SNS やオープンチャットに貼られた など）",
    action: (
      <>
        そのコードを<Ui>失効させる</Ui>
        。確認で「このコードで参加した人もまとめて止める」にチェックをつける。配布先には新しいコードを登録して渡す。
      </>
    ),
  },
  {
    when: `「${STATUS_CONFIG.error_wrong_poster.label}」の報告`,
    action:
      "自分で対応しない。番号と連絡事項を広報責任者へ知らせる。ボランティアにはポスターに触らないよう伝える。",
  },
  {
    when: "「危険」の報告",
    action: "区のリーダーに共有する。無理に貼りに行かせない。",
  },
  {
    when: "連絡事項に個人が特定できること・ほかの候補者についての記述・いたずら",
    action:
      "IT 担当に知らせる（報告した人を止める・連絡事項を消す）。状況が誤っているなら、ほかのボランティアに正しい状況を報告し直してもらう。",
  },
  {
    when: "掲示場の位置が地図と違う",
    action: "番号と正しい場所を IT 担当に知らせる。",
  },
  {
    when: "ボランティア本人から「自分のデータを消して」",
    action: "ニックネームと参加したおおよその日時を聞いて、IT 担当に渡す。",
  },
  {
    when: "一般の人に地図を見せるのをすぐ止めたい",
    action: (
      <>
        管理者が<Ui>公開とリセット</Ui>の<Ui>一般の人への公開を止める</Ui>
        を押す。止めるかどうかは広報責任者と相談する。ボランティアは使い続けられる。
      </>
    ),
  },
  {
    when: "メディアからの接触・炎上の兆候",
    action: "自分で対応しない。記録して広報責任者へ上げる。",
  },
  {
    when: "管理画面やサイトが全部エラーになる",
    action: "IT 担当に知らせる。",
  },
];

export function AdminHelpContent() {
  return (
    <article className="mx-auto max-w-2xl space-y-8 text-sm leading-relaxed">
      <header className="space-y-2">
        <h1 className="font-bold text-xl">管理画面のヘルプ</h1>
        <p>
          ポスター掲示板マップを運営する事務局のための説明です。管理画面の各画面の見出しの横にある
          <Ui>くわしく</Ui>から、ここの該当する説明に飛べます。
        </p>
        <p className="text-muted-foreground">
          ボランティア向けの説明は
          <Link href="/guide" className="underline">
            使い方ガイド
          </Link>
          にあります。
        </p>
      </header>

      <nav aria-label="目次" className="rounded-lg bg-muted p-4">
        <ol className="list-decimal space-y-0.5 pl-5">
          {HELP_SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="underline">
                {section.title}
              </a>
              {"topics" in section && (
                <ul className="mt-0.5 mb-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  {section.topics.map((topic) => (
                    <li key={topic.id}>
                      <a href={`#${topic.id}`} className="text-muted-foreground underline">
                        {topic.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <Section id="overview">
        <p>
          地図は、ボランティアが「予約（これから行く）」「完了（貼り終えた）」を報告し合うためのものです。管理画面では、その報告を見て、参加コードを配り、一般の人への公開を切り替えます。
        </p>
        <table className={TABLE}>
          <thead>
            <tr>
              <th>画面</th>
              <th>できること</th>
              <th>使う人</th>
            </tr>
          </thead>
          <tbody>
            {SCREENS.map((screen) => (
              <tr key={screen.id}>
                <td className="whitespace-nowrap">
                  <a href={`#${screen.id}`} className="underline">
                    {helpTitle(screen.id)}
                  </a>
                </td>
                <td>{screen.does}</td>
                <td>{screen.who}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="roles">
        <p>
          管理画面に入れるのは、管理者が
          <a href="#members" className="underline">
            管理メンバー
          </a>
          に登録した Google アカウントだけです。
        </p>
        <Ul>
          <li>
            <span className="font-semibold">管理者</span>
            ：すべての操作ができます。参加コードの登録と失効、公開の切り替え、報告をまとめて戻す、管理メンバーの登録と外す、は管理者だけです。
          </li>
          <li>
            <span className="font-semibold">運営</span>
            ：最初の画面・参加コードの一覧（表示とコピー）・カバー地域・操作の記録を使えます。カバー地域の担当者の登録・直す・外すもできます。
          </li>
        </Ul>
        <p>
          画面の上に「ログイン中: 管理者」か「ログイン中:
          運営」と出ます。「このアカウントでは管理画面に入れません」と出たら、管理者に一覧への追加を頼んでください。
        </p>
      </Section>

      <Section id="schedule">
        <table className={TABLE}>
          <thead>
            <tr>
              <th>日</th>
              <th>すること</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="whitespace-nowrap">〜10/31</td>
              <td>
                リハーサル。運営の数人だけで参加して試す。一般の人には「公開期間中にご覧いただけます」と出る。
                <span className="font-semibold">
                  10/31 のうちに、リハーサルの報告を
                  <a href="#site-reset" className="underline">
                    まとめて戻す
                  </a>
                </span>
                。本番の参加コードを配布先ごとに作る。
              </td>
            </tr>
            <tr>
              <td className="whitespace-nowrap">11/1（日）</td>
              <td>
                0:00
                に公開期間が始まる（止めたまま）。受理の連絡を受けたら公開し、参加コードを配る（
                <a href="#day1" className="underline">
                  11月1日の流れ
                </a>
                ）。
              </td>
            </tr>
            <tr>
              <td className="whitespace-nowrap">11/2〜11/14</td>
              <td>
                <a href="#daily" className="underline">
                  毎日の確認
                </a>
                。困りごとへの対応。
              </td>
            </tr>
            <tr>
              <td className="whitespace-nowrap">11/14（土）23:58</td>
              <td>一般の人には自動で見えなくなる。ボランティアはその後も地図を見られる。</td>
            </tr>
            <tr>
              <td className="whitespace-nowrap">11/15（日）</td>
              <td className="font-semibold">投票日。何も操作しない。</td>
            </tr>
            <tr>
              <td className="whitespace-nowrap">11/16〜12/15</td>
              <td>IT 担当がデータを削除する。</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section id="dashboard">
        <p>
          いちばん上に、地図の公開の状態が出ます。「期間外」は公開期間（{PUBLIC_WINDOW_LABEL}
          ）の外、「公開中」は一般の人に見えている、「止めている」は管理者が一般の人への公開を止めている状態です。どの状態でも、参加したボランティアは地図を使えます。
        </p>
        <Topic id="dashboard-stale">
          <p>
            「{STATUS_CONFIG.reserved.label}
            」のまま6時間以上たった掲示場です。予約は自動では消えないので、放っておくとほかの人がそこを避けて貼り残しになります。
          </p>
          <Ul>
            <li>区のリーダーに番号を伝えて、確かめてもらいます。</li>
            <li>
              行けないと分かったら、予約した本人かリーダーが地図で「{STATUS_CONFIG.not_yet.label}
              」に戻します。
            </li>
            <li>
              11/1 14:00 より前は「11月1日14:00から表示します」と出ます（初日の朝から6時間）。
            </li>
          </Ul>
        </Topic>
        <Topic id="dashboard-danger">
          <p>
            「{STATUS_CONFIG.not_yet_dangerous.label}
            」になっている掲示場と、その最新の報告です。区のリーダーに共有し、無理に貼りに行かせないでください。
          </p>
        </Topic>
        <Topic id="dashboard-reports">
          <p>
            直近24時間の報告のうち、連絡事項が書かれたもの・「
            {STATUS_CONFIG.error_wrong_poster.label}
            」・「{STATUS_CONFIG.other.label}」です。
          </p>
          <Ul>
            <li>
              「{STATUS_CONFIG.error_wrong_poster.label}
              」は自分で対応せず、番号と連絡事項を広報責任者へ知らせます。
            </li>
            <li>
              個人が特定できること・ほかの候補者についての記述があったら、
              <a href="#trouble" className="underline">
                困ったとき
              </a>
              のとおりにします。
            </li>
          </Ul>
        </Topic>
        <Topic id="dashboard-wards">
          <p>
            区ごとの掲示場の数と、そのうち何か所が進んでいるかです。陣営内の報告にそのまま使えます。
          </p>
          <Ul>
            <li>
              <span className="font-semibold">計画</span>
              ：担当者がいるか、だれかが予約・完了の報告をした掲示場（
              <a href="#coverage" className="underline">
                カバー地域
              </a>
              の「担当あり」＋「予約あり」）。
            </li>
            <li>
              <span className="font-semibold">実績</span>：「{STATUS_CONFIG.done.label}
              」の報告がある掲示場。
            </li>
            <li>10/31 までは「{REHEARSAL_NOTE}」と出ます。</li>
          </Ul>
        </Topic>
      </Section>

      <Section id="codes">
        <p>
          ボランティアは、事務局から受け取った参加コードを地図に入れて参加します。コードは配布先ごとに分けて作り、もれたときにそのコードだけを止められるようにします。
        </p>
        <Topic id="codes-register" adminOnly>
          <Ol>
            <li>
              「配布先の名前」を入れる（{LABEL_MAX_LENGTH}文字まで。例：東区チーム、11/1 説明会）。
              <span className="font-semibold">個人名は入れません。</span>
            </li>
            <li>
              「参加コード」を入れる。{INVITE_CODE_MIN_LENGTH}〜{INVITE_CODE_MAX_LENGTH}
              文字で、英字・数字・記号をそれぞれ1つ以上（半角・空白なし）。記号はスマホで打ちやすい「-」や「_」がおすすめです。
            </li>
            <li>
              <Ui>登録する</Ui>を押し、確認でもう一度<Ui>登録する</Ui>。
            </li>
          </Ol>
          <p>
            コードは自分で考えます（パスワードの生成機能を使うと簡単です）。登録したコードは、一覧の
            <Ui>表示</Ui>で後から確かめられるので、別の場所に書き残さなくてかまいません。
          </p>
        </Topic>
        <Topic id="codes-list">
          <Ul>
            <li>
              「状態」は、有効（参加に使える）か失効（もう使えない）です。「参加した人数」は、そのコードで参加した人と、そのうち止めていない人の数です。
            </li>
            <li>
              <Ui>表示</Ui>でコードが出て、<Ui>コピー</Ui>
              で貼り付けられます。表示するたびに操作の記録に残ります。
            </li>
            <li>
              <span className="font-semibold">失効させる</span>
              <AdminOnly />
              ：このコードでの新しい参加が止まります。もれたときは、確認で「このコードで参加した人もまとめて止める」にチェックをつけてください。止めた人は地図を見られますが、報告できなくなります。
            </li>
            <li>
              リハーサル用のコードは、リハーサルが終わったら失効させます（本番のコードを使った場合は失効させない）。
            </li>
          </Ul>
        </Topic>
        <Topic id="codes-share">
          <Ul>
            <li>
              配るのは <span className="font-semibold">11/1 の受理の後</span>
              です。使い方ガイドは先に配ってかまいません（コードは入っていません）。
            </li>
            <li>配布先のリーダーに、個別に渡します（対面・電話・個別のメッセージ）。</li>
            <li>
              SNS・オープンチャット・陣営内の公開チャンネル・大勢が入るグループには貼りません。Backlog
              や Drive にも書きません。
            </li>
            <li>
              大文字・小文字・記号を登録したとおりに伝えるため、<Ui>コピー</Ui>
              で貼り付けるか、1文字ずつ読み合わせます。
            </li>
            <li>
              説明会などで一度に大勢が参加するときは、前もって IT
              担当に知らせてください（参加の受付に1時間あたりの上限があります）。
            </li>
          </Ul>
        </Topic>
      </Section>

      <Section id="coverage">
        <p>
          担当者（班や人の呼び名）に、区・投票区・校区・町名・丁目の範囲を割り当てて、まだだれも受け持っていない掲示場を見つける画面です。運営も使えます。
        </p>
        <Topic id="coverage-totals">
          <Ul>
            <li>
              <span className="font-semibold">担当あり</span>
              ：どれかの担当者の範囲に入っている掲示場。
            </li>
            <li>
              <span className="font-semibold">予約あり</span>
              ：担当者はいないが、だれかが予約か完了の報告をした掲示場。
            </li>
            <li>
              <span className="font-semibold">担当なし</span>
              ：どちらでもない掲示場。0 でなければ赤で出ます。ここを減らすのが目標です。
            </li>
            <li>
              <span className="font-semibold">カバー率</span>：担当ありと予約ありを合わせた割合。
            </li>
          </Ul>
          <p>
            「校区・町名が入っていない掲示場が…」と出たら、IT
            担当に知らせてください（掲示場の取り込みをやり直します）。
          </p>
        </Topic>
        <Topic id="coverage-table">
          <Ul>
            <li>
              <Ui>区</Ui>
              <Ui>投票区</Ui>
              <Ui>校区</Ui>
              <Ui>町名</Ui>で、数える単位を切り替えます。<Ui>区で絞る</Ui>
              で1つの区だけにできます。
            </li>
            <li>
              <Ui>担当なしがある所だけ</Ui>
              にチェックをつけると、まだ割り当てが要る所だけが残ります。
            </li>
            <li>
              地名を押すと、その範囲の掲示場の一覧が出て、地図がその範囲に寄ります。町名の「丁目」を押すと丁目ごとに分かれます。
            </li>
            <li>「いまの担当者」は、その範囲に割り当てられている担当者の呼び名です。</li>
            <li>
              投票区は、掲示場の番号の「-数字」より前の部分です（「馬出第一-3」なら馬出第一）。
            </li>
          </Ul>
        </Topic>
        <Topic id="coverage-map">
          <p>
            掲示場を色で分けて出します。赤が担当なし、黄が予約あり、灰が担当ありです。表で地名を選ぶと、その範囲に寄ります。
          </p>
        </Topic>
        <Topic id="coverage-register">
          <Ol>
            <li>
              「呼び名」を入れる（「A班」「担当1」のような呼び名。
              <span className="font-semibold">本名・電話番号・住所は入れません</span>）。
            </li>
            <li>必要ならメモを入れる（受け持つ日など）。</li>
            <li>
              範囲を足す。<Ui>地名で探す</Ui>に地名の一部を入れて選ぶか、区を選んで
              <Ui>区ぜんぶを足す</Ui>
              、または投票区や校区・町名を選んで足します。何か所でも足せます。投票区は「馬出第一」のように地名で探しても出ます。
            </li>
            <li>
              「選んだ範囲」を確かめて<Ui>登録する</Ui>。
            </li>
          </Ol>
          <p>
            同じ掲示場を2つの担当者が受け持ってもかまいません（表の「いまの担当者」に両方出ます）。
          </p>
        </Topic>
        <Topic id="coverage-assignees">
          <Ul>
            <li>
              <Ui>直す</Ui>で呼び名・メモ・範囲を変えられます。
            </li>
            <li>
              <Ui>外す</Ui>
              と、その担当者の範囲がなくなります。ほかの担当者も予約もない掲示場は「担当なし」に戻ります。掲示場や報告は消えません。
            </li>
          </Ul>
        </Topic>
      </Section>

      <Section id="site">
        <p>
          運営の人には「いまの設定」だけが出ます。公開の切り替えとリセットは管理者だけができます。
        </p>
        <Topic id="site-status">
          <p>
            公開の状態・公開期間・サイト名・受理の確認（届出の受理を確かめて「公開する」を押したか）が出ます。受理の前のサイト名は「
            {NAME_BEFORE}」、公開したあとは「{NAME_AFTER}」です。
          </p>
        </Topic>
        <Topic id="site-publish" adminOnly>
          <Ul>
            <li>
              <Ui>公開する</Ui>
              ：届出の受理を確かめてから押します。確認の欄に「{PUBLISH_CONFIRM_WORD}
              」と入れます。サイト名が「{NAME_AFTER}」に変わり、一般の人に地図が出ます。11/1 0:00
              より前は押せません。
            </li>
            <li>
              <Ui>一般の人への公開を止める</Ui>
              ：緊急のとき、一般の人に地図を見せないようにします。ボランティアは使い続けられます。戻すときは
              <Ui>公開を再開する</Ui>。
            </li>
            <li>
              <Ui>受理前に戻す</Ui>
              ：「公開する」を押し間違えたときだけ使います。確認の欄に「{REVERT_CONFIRM_WORD}
              」と入れます。サイト名が「{NAME_BEFORE}」に戻り、一般の人への公開が止まります。
            </li>
            <li>
              切り替えたあと、一般の人の画面には最大60秒ほど前の表示が残ります。シークレットウィンドウで開いて確かめてください。
            </li>
          </Ul>
        </Topic>
        <Topic id="site-reset" adminOnly>
          <p>
            リハーサルの片付けに使います。すべての報告の履歴を消し、すべての掲示場を「
            {STATUS_CONFIG.not_yet.label}
            」に戻します。元に戻せません。確認の欄に「{RESET_CONFIRM_WORD}」と入れます。
          </p>
          <Ul>
            <li>
              <span className="font-semibold">10/31 のうちに</span>
              済ませます。11/1 0:00 を過ぎるとこの操作は画面から消えます。
            </li>
            <li>
              参加コード・参加済みのボランティア・カバー地域の担当者は消えません。リハーサル用のコードは別に
              <a href="#codes-list" className="underline">
                失効させます
              </a>
              。
            </li>
          </Ul>
        </Topic>
      </Section>

      <Section id="members">
        <p>管理者だけが使えます。運営の人のメニューには出ません。</p>
        <Topic id="members-add" adminOnly>
          <Ol>
            <li>
              その人がログインに使う Google
              アカウントのメールアドレスを入れる（大文字・全角で入れても、小文字・半角にそろえて登録します）。
            </li>
            <li>
              役割（<span className="font-semibold">管理者</span>か
              <span className="font-semibold">運営</span>）を選ぶ。迷ったら運営にします。
            </li>
            <li>
              <Ui>登録する</Ui>を押し、確認の画面でメールアドレスと役割を確かめて
              <Ui>登録する</Ui>。
            </li>
          </Ol>
          <p>
            登録した人に、管理画面のアドレスと「Google
            でログインしてください」と伝えます。メールアドレスは Slack や Backlog
            に書かず、本人に直接確かめてください。
          </p>
        </Topic>
        <Topic id="members-list" adminOnly>
          <Ul>
            <li>いま管理画面に入れる人が全員出ます。自分の行には「あなた」と出ます。</li>
            <li>
              「最後のログイン」が「まだログインしていません」の人は、登録したあと一度も入っていません。メールアドレスの打ち間違いがないか確かめてください。
            </li>
            <li>
              <Ui>外す</Ui>
              と、その人は次の操作から管理画面に入れなくなります。陣営を離れた人は早めに外します。
            </li>
            <li>
              自分自身は外せません。ほかの管理者に頼んでください（管理者がだれもいなくなるのを防ぐためです）。
            </li>
            <li>役割を変えるときは、外してから登録し直します。</li>
          </Ul>
        </Topic>
      </Section>

      <Section id="audit">
        <p>
          管理画面での操作（参加コードの登録・失効・表示、公開の切り替え、報告をまとめて戻す、担当者の登録・変更・外す、管理メンバーの登録・外す）が、新しい順に直近100件出ます。だれがいつ何をしたかを確かめるときに見ます。ボランティアの報告はここには出ません（地図のピンの「更新履歴」で見ます）。
        </p>
      </Section>

      <Section id="day1">
        <p>
          11/1 0:00
          に公開期間が始まりますが、一般の人への公開は止めたままにしておきます（最初の画面は「止めている」）。
        </p>
        <Ol>
          <li>受理の連絡役から「受理された」と連絡をもらう。</li>
          <li>
            管理者が<Ui>公開とリセット</Ui>の<Ui>公開する</Ui>を押し、「{PUBLISH_CONFIRM_WORD}
            」と入れて確定する。
          </li>
          <li>
            1分ほど待ってシークレットウィンドウで地図を開き、地図が出ること、サイト名が「
            {NAME_AFTER}
            」になっていることを確かめる。
          </li>
          <li>広報責任者と陣営に「公開した」と伝える。</li>
          <li>
            参加コードを配る（
            <a href="#codes-share" className="underline">
              配り方
            </a>
            ）。
          </li>
        </Ol>
        <p>
          受理が遅れたら<Ui>公開する</Ui>を押さずに待ちます。参加コードも受理の後まで配りません。
        </p>
      </Section>

      <Section id="daily">
        <p>11/1〜11/14 の毎朝、15分ほど。</p>
        <Ol>
          <li>シークレットウィンドウで地図を開き、一般の人に地図が出ているか確かめる。</li>
          <li>
            <a href="#dashboard" className="underline">
              最初の画面
            </a>
            を開き、「危険」の報告と新しい連絡事項を見る。気をつけるものは
            <a href="#trouble" className="underline">
              困ったとき
            </a>
            のとおりにする。
          </li>
          <li>長く残っている予約を区のリーダーに伝える。</li>
          <li>
            <a href="#coverage" className="underline">
              カバー地域
            </a>
            で担当なしが残っている所を見て、担当者を割り当てる。
          </li>
          <li>区ごとの進み具合を陣営内に共有する。</li>
        </Ol>
      </Section>

      <Section id="trouble">
        <table className={TABLE}>
          <thead>
            <tr>
              <th>できごと</th>
              <th>すること</th>
            </tr>
          </thead>
          <tbody>
            {TROUBLES.map((row, i) => (
              // 文言は固定なので、並びの番号で足りる
              // biome-ignore lint/suspicious/noArrayIndexKey: 並びが変わらない固定の表
              <tr key={i}>
                <td className="min-w-40">{row.when}</td>
                <td>{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="donts">
        <Ul>
          <li>
            参加コード・パスワードを Slack・Backlog・Drive・メールに書かない。配るときは個別に渡す。
          </li>
          <li>担当者の呼び名・配布先の名前に、本名・電話番号・住所を入れない。</li>
          <li>11/1 を過ぎてから、報告をまとめて戻そうとしない（画面からも消えます）。</li>
          <li>11/15（投票日）は何も操作しない。</li>
          <li>
            ほかの候補者・メディア・炎上に、地図の運営として自分で対応しない。広報責任者へ上げる。
          </li>
        </Ul>
      </Section>
    </article>
  );
}
