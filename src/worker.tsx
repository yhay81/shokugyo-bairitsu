import { Hono } from "hono";
import type { Context } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";

type Bindings = { ASSETS: Fetcher; DB: D1Database };
type Variables = { requestId: string };
type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403,
  ) {
    super(message);
  }
}

const origin = "https://shokugyo-bairitsu.yhay81.com";
const dataPage = "https://www.mhlw.go.jp/toukei/list/114-1d.html";
const openingsWorkbook = "https://www.mhlw.go.jp/toukei/list/xls/114-1d-04.xlsx";
const seekersWorkbook = "https://www.mhlw.go.jp/toukei/list/xls/114-1d-05.xlsx";
const termsPage = "https://www.mhlw.go.jp/toukei/list/114-1_yougo.html";
const useTerms = "https://www.mhlw.go.jp/chosakuken/index.html";
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const eventNames = new Set([
  "visited",
  "searched",
  "no_result",
  "region_changed",
  "group_changed",
  "employment_changed",
  "year_changed",
  "occupation_changed",
  "compared",
  "copied",
]);

const nowSeconds = () => Math.floor(Date.now() / 1000);
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const sameOrigin = (c: AppContext) => {
  const site = c.req.header("sec-fetch-site");
  if (site && site !== "same-origin") throw new ApiError("cross_site_request", 403);
  const requestOrigin = c.req.header("origin");
  if (requestOrigin && requestOrigin !== new URL(c.req.url).origin)
    throw new ApiError("cross_site_request", 403);
};
const parseJson = async (c: AppContext) => {
  if (Number(c.req.header("content-length") ?? "0") > 512)
    throw new ApiError("invalid_payload", 400);
  try {
    return await c.req.json<unknown>();
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};
const record = async (c: AppContext, name: string) => {
  const session = (c.req.header("x-shokugyo-bairitsu-session") ?? "").toLowerCase();
  if (!sessionPattern.test(session)) return;
  await c.env.DB.prepare(
    "INSERT INTO product_events (session_hash,event_name,is_qa,created_at) VALUES (?,?,?,?)",
  )
    .bind(
      await sha256(session),
      name,
      c.req.header("x-shokugyo-bairitsu-qa") === "1" ? 1 : 0,
      nowSeconds(),
    )
    .run();
};

const nav = [
  { href: "/", label: "職種と地域" },
  { href: "/guide", label: "数字の見方" },
  { href: "/source", label: "出典" },
  { href: "/privacy", label: "保存" },
];

const Layout = ({
  canonical,
  children,
  description,
  noindex = false,
  title,
}: {
  canonical: string;
  children: unknown;
  description: string;
  noindex?: boolean;
  title: string;
}) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <title>{title}</title>
      <meta content={description} name="description" />
      <link href={canonical} rel="canonical" />
      {noindex ? <meta content="noindex" name="robots" /> : null}
      <meta content="website" property="og:type" />
      <meta content="ja_JP" property="og:locale" />
      <meta content={title} property="og:title" />
      <meta content={description} property="og:description" />
      <meta content={canonical} property="og:url" />
      <meta content={`${origin}/og.svg`} property="og:image" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content="#283a36" name="theme-color" />
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      <link href="/manifest.webmanifest" rel="manifest" />
      <link href="/styles.css" rel="stylesheet" />
    </head>
    <body>
      <header class="site-header">
        <a aria-label="職種求人倍率 ホーム" class="brand" href="/">
          <span aria-hidden="true" class="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>職種求人倍率</span>
        </a>
        <nav aria-label="主なページ">
          {nav.map((item) => (
            <a href={item.href}>{item.label}</a>
          ))}
        </nav>
      </header>
      {children}
      <footer>
        <div>
          <strong>職種求人倍率</strong>
          <p>厚生労働省「職業安定業務統計 雇用関係指標」を加工して作成</p>
        </div>
        <div class="footer-links">
          <a href="/source">出典と注意</a>
          <a href="/privacy">保存と計測</a>
          <a href="https://github.com/yhay81/shokugyo-bairitsu">ソースコード</a>
        </div>
      </footer>
    </body>
  </html>
);

const BalanceBoardFigure = () => (
  <div
    aria-label="一般事務の求人票と求職票を左右に置き、中央で倍率を示す比較盤"
    class="balance-board"
    role="img"
  >
    <div class="board-tabs" aria-hidden="true">
      {"ＡＢＣＤＥＦＧＨＩＪＫ".split("").map((letter) => (
        <i>{letter}</i>
      ))}
    </div>
    <div class="board-card" aria-hidden="true">
      <div class="board-card-title">
        <span>25</span>
        <strong>一般事務従事者</strong>
      </div>
      <div class="ticket-balance">
        <div class="ticket-stack is-opening">
          <i />
          <i />
          <strong>求人</strong>
          <b>1,633,497</b>
        </div>
        <div class="balance-pivot">
          <span>÷</span>
          <b>0.34倍</b>
        </div>
        <div class="ticket-stack is-seeker">
          <i />
          <i />
          <strong>求職</strong>
          <b>4,836,025</b>
        </div>
      </div>
      <small>全国 · パートを含む常用 · 2025</small>
    </div>
  </div>
);

const HomePage = () => (
  <Layout
    canonical={`${origin}/`}
    description="ハローワークの職種別有効求人数と有効求職者数から、73職種、全国・47労働局、2023〜2025年度の有効求人倍率と元件数を最大4地域で比較できます。"
    title="職種別の有効求人倍率を地域比較 | 職種求人倍率"
  >
    <main>
      <section class="hero-shell">
        <div class="hero-copy">
          <p class="period-label">2023—2025年度 · ハローワーク</p>
          <h1>職種ごとの求人と求職を、同じ盤で。</h1>
          <p class="lead">同じ職種・地域・年度の有効件数をそろえ、倍率と元の2値を並べます。</p>
          <div aria-label="収録内容" class="hero-facts">
            <span>
              <b>73</b> 職種
            </span>
            <span>
              <b>48</b> 地域
            </span>
            <span>
              <b>最大4</b> 地域比較
            </span>
          </div>
        </div>
        <BalanceBoardFigure />
      </section>

      <section aria-labelledby="occupation-title" class="occupation-picker">
        <div class="section-heading">
          <div>
            <p class="section-kicker">職種を選ぶ</p>
            <h2 id="occupation-title">73枚の職種カード</h2>
          </div>
          <p id="occupation-status" role="status">
            公式表を読み込んでいます
          </p>
        </div>
        <div class="occupation-controls">
          <label class="occupation-search">
            <span>職種名</span>
            <input
              autocomplete="off"
              id="occupation-search"
              placeholder="例：事務、介護、情報"
              type="search"
            />
          </label>
          <label>
            <span>分類</span>
            <select id="occupation-group">
              <option value="all">すべて</option>
            </select>
          </label>
        </div>
        <div class="occupation-grid" id="occupation-list" />
      </section>

      <section aria-labelledby="compare-title" class="compare-panel">
        <div class="section-heading compare-heading">
          <div>
            <p class="section-kicker">選択した地域</p>
            <h2 id="compare-title">同じ職種を並べる</h2>
          </div>
          <div class="compare-actions">
            <span id="compare-count">0 / 4</span>
            <button disabled id="copy-compare" type="button">
              比較をコピー
            </button>
          </div>
        </div>
        <div class="metric-controls">
          <label>
            <span>雇用区分</span>
            <select id="employment">
              <option value="a">パートを含む常用</option>
              <option value="f">パートを除く常用</option>
              <option value="t">常用的パート</option>
            </select>
          </label>
          <label>
            <span>年度</span>
            <select id="year">
              <option value="2025">2025年度</option>
              <option value="2024">2024年度</option>
              <option value="2023">2023年度</option>
            </select>
          </label>
        </div>
        <p class="metric-note" id="metric-note">
          月間有効件数を年度で合計した公式値です。同じセルの求人 ÷ 求職で倍率を算出します。
        </p>
        <div class="empty-compare" id="compare-list">
          一覧の「比較に追加」から、2〜4地域を選んでください。
        </div>
      </section>

      <section aria-labelledby="finder-title" class="finder">
        <div class="section-heading">
          <div>
            <p class="section-kicker">地域一覧</p>
            <h2 id="finder-title">都道府県を選ぶ</h2>
          </div>
          <p id="data-status" role="status">
            求人・求職表を準備しています
          </p>
        </div>
        <div class="controls">
          <label class="search-field">
            <span>都道府県・全国</span>
            <input
              autocomplete="off"
              id="search"
              placeholder="例：東京、福岡、全国"
              type="search"
            />
          </label>
          <label>
            <span>地域</span>
            <select id="region">
              <option value="all">すべて</option>
            </select>
          </label>
          <label>
            <span>並び順</span>
            <select id="sort">
              <option value="source">都道府県コード順</option>
              <option value="name">名前順</option>
            </select>
          </label>
        </div>
      </section>

      <section aria-labelledby="results-title" class="results-section">
        <div class="results-heading">
          <div>
            <h2 id="results-title">一般事務従事者</h2>
            <p id="condition-label">パートを含む常用 · 2025年度</p>
          </div>
          <p>
            <b id="result-count">—</b> 地域
          </p>
        </div>
        <div class="place-grid" id="results" />
      </section>

      <aside class="boundary">
        <span aria-hidden="true">÷</span>
        <div>
          <strong>倍率だけでは、仕事の良し悪しは決められません</strong>
          <p>
            年度内の月間有効件数による比率です。応募数、採用確率、賃金、仕事の質、民間求人を含む労働市場全体は分かりません。
          </p>
        </div>
      </aside>
    </main>
    <script defer src="/app.js" />
  </Layout>
);

const GuidePage = () => (
  <Layout
    canonical={`${origin}/guide`}
    description="職種求人倍率の有効求人数、有効求職者数、雇用区分、分類不能、0人分母、年度値の読み方を説明します。"
    title="数字の見方 | 職種求人倍率"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="section-kicker">数字の見方</p>
        <h1>求人と求職を、同じ条件で。</h1>
        <p>職種、雇用区分、労働局、年度をそろえた2値だけから倍率を算出します。</p>
      </div>
      <section class="ratio-guide" aria-label="有効求人倍率の割り算を示す図">
        <div class="formula-card">
          <div>
            <span>月間有効求人数</span>
            <strong>633,590</strong>
          </div>
          <b aria-hidden="true">÷</b>
          <div>
            <span>月間有効求職者数</span>
            <strong>435,484</strong>
          </div>
          <i aria-hidden="true">=</i>
          <div class="formula-result">
            <span>有効求人倍率</span>
            <strong>1.45倍</strong>
          </div>
        </div>
      </section>
      <section class="guide-grid">
        <article>
          <span>分子</span>
          <h2>月間有効求人数</h2>
          <p>前月から繰り越した未充足の求人数と、その月の新規求人数を合わせたものです。</p>
        </article>
        <article>
          <span>分母</span>
          <h2>月間有効求職者数</h2>
          <p>
            前月から繰り越した就職未決定の求職者数と、その月の新規求職申込みを合わせたものです。
          </p>
        </article>
        <article>
          <span>年度値</span>
          <h2>12か月の延べ</h2>
          <p>月間有効件数の年度合計です。同じ人や未充足求人が複数月に含まれ得ます。</p>
        </article>
        <article>
          <span>0人</span>
          <h2>分母が0なら算出なし</h2>
          <p>求職者数が0のセルは無限大と表示しません。未公表値も周辺地域や年度から補いません。</p>
        </article>
      </section>
      <section class="note-panel">
        <h2>分類不能の求職者がいます</h2>
        <p>
          2025年度の全国・パートを含む常用では、有効求職者数22,698,922のうち4,403,017が「分類不能の職業」です。職種別の分母には含まれないため、全体倍率との単純比較や職種ランキングを行いません。
        </p>
        <a href={dataPage}>厚生労働省 雇用関係指標</a>
      </section>
    </main>
  </Layout>
);

const SourcePage = () => (
  <Layout
    canonical={`${origin}/source`}
    description="職種求人倍率が利用する厚生労働省の第4表・第5表、対応づけ、欠測、0人分母、分類不能、確認日、利用条件を示します。"
    title="出典とデータ | 職種求人倍率"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="section-kicker">出典</p>
        <h1>2つの公式表、31,536組を照合。</h1>
        <p>
          第4表の有効求人数と第5表の性計・年齢計による有効求職者数を、同じセルへ対応づけました。
        </p>
      </div>
      <section class="source-ledger">
        <div>
          <span>提供元</span>
          <strong>厚生労働省</strong>
          <a href={dataPage}>雇用関係指標（年度）</a>
        </div>
        <div>
          <span>分子</span>
          <strong>第4表 · 職業別有効求人数</strong>
          <a href={openingsWorkbook}>公式Excel</a>
        </div>
        <div>
          <span>分母</span>
          <strong>第5表 · 職業別有効求職者数</strong>
          <a href={seekersWorkbook}>公式Excel</a>
        </div>
        <div>
          <span>収録範囲</span>
          <strong>48地域 × 73職種</strong>
          <a href={termsPage}>用語の解説</a>
        </div>
        <div>
          <span>雇用区分</span>
          <strong>常用計・フルタイム・パート</strong>
          <span>2023〜2025年度</span>
        </div>
        <div>
          <span>利用条件</span>
          <strong>公共データ利用規約 第1.0版</strong>
          <a href={useTerms}>厚生労働省の利用規約</a>
        </div>
      </section>
      <section class="prose-section">
        <h2>行った加工</h2>
        <ul>
          <li>第4表・第5表の2023年度以降3シートから、73の職業中分類だけを抽出しました。</li>
          <li>全国と47労働局、3雇用区分、3年度の31,536組・63,072元値を対応づけました。</li>
          <li>
            雇用区分の常用計がフルタイムとパートの和に一致し、全国計が47労働局の和に一致することを検査しました。
          </li>
          <li>
            第5表は推計せず公式の性計・年齢計を使います。性計が男女の単純合計と異なる8,777セルも性計を優先しました。
          </li>
          <li>479組の未公表値をnullで保持し、603組の求職者数0は倍率を算出しません。</li>
          <li>求人と求職がそろい分母が正の30,454組だけ、求人 ÷ 求職を画面で算出します。</li>
          <li>労働局名を都道府県名へ短縮し、9地域と全国に分類しました。</li>
          <li>
            出典：厚生労働省「職業安定業務統計 雇用関係指標（年度）第4表・第5表」を加工して作成。
          </li>
        </ul>
      </section>
      <section class="prose-section">
        <h2>ファイル確認</h2>
        <p>
          2026年8月2日取得。第4表は1,001,209 bytes、SHA-256:
          4c740910e86217951ea7ccfe9f0ed32ff53b3f088c3c97e2328fd13c5d5070ce。第5表は24,574,237
          bytes、SHA-256: 0f2ce1388a319c36771e7e9115ab4562bf6d12d63f4289b0bc52a199c1381d55。
        </p>
      </section>
    </main>
  </Layout>
);

const PrivacyPage = () => (
  <Layout
    canonical={`${origin}/privacy`}
    description="職種求人倍率の端末保存、匿名利用計測、保持期間、追跡拒否への対応を示します。"
    title="保存と計測 | 職種求人倍率"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="section-kicker">保存</p>
        <h1>選んだ地域は、端末に。</h1>
        <p>検索語、地域名、職種、年度、雇用区分、求人・求職件数、倍率をサーバーへ記録しません。</p>
      </div>
      <section class="privacy-grid">
        <article>
          <h2>端末に保存</h2>
          <p>比較に選んだ公開地域IDを最大4件だけブラウザへ保存します。アカウントは不要です。</p>
        </article>
        <article>
          <h2>操作名だけを計測</h2>
          <p>訪問、検索、0件、条件変更、職種選択、比較追加、コピーの操作名だけを計測します。</p>
        </article>
        <article>
          <h2>35日で削除</h2>
          <p>
            ランダムなセッションIDをSHA-256で変換し、操作名、QA区分、時刻とともにD1へ保存します。
          </p>
        </article>
        <article>
          <h2>追跡拒否を尊重</h2>
          <p>
            Do Not TrackまたはGlobal Privacy
            Controlが有効な場合は計測しません。広告・外部解析・Cookieは使いません。
          </p>
        </article>
      </section>
    </main>
  </Layout>
);

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Request-Id", c.get("requestId"));
});
app.use(
  "*",
  jsxRenderer(({ children }) => <>{children}</>),
);
app.get("/", (c) => c.html(<HomePage />));
app.get("/guide", (c) => c.html(<GuidePage />));
app.get("/source", (c) => c.html(<SourcePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));
app.post("/api/telemetry", async (c) => {
  sameOrigin(c);
  const body = await parseJson(c);
  if (
    typeof body !== "object" ||
    body === null ||
    !("name" in body) ||
    typeof body.name !== "string" ||
    !eventNames.has(body.name)
  )
    throw new ApiError("invalid_event", 400);
  await record(c, body.name);
  return c.body(null, 202);
});
app.get("/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({
    asOf: "2026-08-02",
    ok: row?.ok === 1,
    records: 31536,
    service: "shokugyo-bairitsu",
  });
});
app.get("/sitemap.xml", (c) => {
  const paths = ["/", "/guide", "/source", "/privacy"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
  c.header("Cache-Control", "public,max-age=300,s-maxage=300");
  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(xml);
});
app.notFound((c) => {
  c.status(404);
  return c.html(
    <Layout
      canonical={`${origin}/404`}
      description="指定されたページは見つかりません。"
      noindex
      title="ページが見つかりません | 職種求人倍率"
    >
      <main class="text-page">
        <div class="page-intro">
          <p class="section-kicker">404</p>
          <h1>この職種カードは見つかりません。</h1>
          <p>
            <a href="/">職種と地域の比較へ戻る</a>
          </p>
        </div>
      </main>
    </Layout>,
  );
});
app.onError((error, c) => {
  if (error instanceof ApiError)
    return c.json({ error: error.message, requestId: c.get("requestId") }, error.status);
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

export const scheduled = async (_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) => {
  await env.DB.prepare("DELETE FROM product_events WHERE created_at < ?")
    .bind(nowSeconds() - 35 * 86400)
    .run();
};

export default app;
