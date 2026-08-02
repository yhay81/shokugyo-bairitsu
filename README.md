# 職種求人倍率

厚生労働省の職業別有効求人数と有効求職者数を、73職種、全国・47労働局、3雇用区分、2023〜2025年度から選び、倍率と元件数を最大4地域で比較する日本語Webサービスです。

- Production: <https://shokugyo-bairitsu.yhay81.com>
- Source: 厚生労働省「職業安定業務統計 雇用関係指標（年度）」第4表・第5表
- Runtime: Cloudflare Workers + Hono JSX + Vite+ + D1
- Account: 不要

## Commands

```powershell
npm install
npm run data:check
npm run check
npm test
npm run build
npm run dev
```

公開前は`npm run release:check`を実行します。D1 migrationを適用してから`npm run deploy`で配信します。

## Data boundary

年度値は月間有効件数の合計で、固有の求人票数・人数ではありません。倍率は同じ職種・労働局・雇用区分・年度の`有効求人数 ÷ 有効求職者数`です。分類不能の求職者、応募数、採用確率、賃金、民間求人を含む市場全体を示しません。未公表値は補完せず、求職者数0のセルは倍率を算出しません。

コードはMIT Licenseです。データの利用条件は[SOURCE.md](SOURCE.md)を参照してください。
