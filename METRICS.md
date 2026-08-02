# Product metrics

35日保持の匿名イベントから、次を確認します。

- `users`: QAを除く利用者
- `searchers`: 職種名または地域名を検索した利用者
- `successful_searches` / `no_result_searches`: 検索・0件の操作回数
- `region_changers` / `group_changers`: 地域・職種分類を使った利用者
- `employment_changers` / `year_changers`: 比較条件を変更した利用者
- `occupation_changers`: 職種カードを選んだ利用者
- `comparers`: 比較へ追加した利用者
- `copiers`: 比較結果をコピーした利用者

検索語、地域、職種、分類、雇用区分、年度、求人・求職件数、倍率はイベントに含めません。自動QAは`is_qa=1`として実利用から除外します。

```powershell
npm run metrics
```
