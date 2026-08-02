# Security

脆弱性は公開Issueではなく、GitHubのSecurity advisoryから非公開で報告してください。

- 認証、投稿、決済、個人情報入力を持ちません。
- 検索と比較は配信済みJSONを使い、ブラウザ内で完結します。
- 計測APIは同一オリジンを確認し、512 bytes以下のJSONと許可済み操作名だけを受理します。
- Content Security Policy、frame禁止、MIME sniffing禁止、権限機能禁止を設定します。
- 外部画像、広告、外部解析スクリプトを読み込みません。
