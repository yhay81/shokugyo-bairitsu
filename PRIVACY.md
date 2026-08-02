# Privacy

## Browser storage

最大4件の公開地域IDを`localStorage`へ保存します。検索語、地域、職種、分類、雇用区分、年度、並び順は保存しません。保存内容はブラウザのサイトデータ削除で消せます。

## Anonymous product events

D1には次だけを35日間保存します。

- ランダムなセッションIDのSHA-256
- 許可済み操作名
- 自動QA区分
- 発生時刻

検索語、地域ID・名称、職種、分類、雇用区分、年度、求人・求職件数、倍率、IPアドレス、User-Agentをイベント行へ保存しません。広告、外部解析、Cookie、フィンガープリントは使いません。Do Not TrackまたはGlobal Privacy Controlが有効な場合はイベントを送信しません。
