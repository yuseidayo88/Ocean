/**
 * 言葉は短く、全画面で同じ語を使う。
 * 状態は 判断待ち / 要確認 / 実行中 / 待機 / 完了 / 承認済 の6語だけ。
 */
export const ja = {
  brand: 'OneFound',

  nav: {
    home: 'ホーム', inbox: '通知', work: 'Work', task: 'タスク',
    deliverable: '成果物', member: 'メンバー', decision: '決定事項',
    chat: 'チャット', search: '検索',
  },

  state: {
    wait: '判断待ち',   // あなたが決める
    check: '要確認',    // あなたが成果物を見る
    running: '実行中',
    idle: '待機',
    done: '完了',
    approved: '承認済',
  },

  composer: {
    placeholder: '統括AIに指示する',
    executive: '統括AI',
    auto: '自動',
  },

  auth: {
    title: 'OneFound',
    lead: '一人社長のための AI カンパニー。',
    email: 'メールアドレス',
    send: 'ログインのリンクを送る',
    sent: 'メールを見てください。リンクを開くと入れます。',
    signOut: 'ログアウト',
  },

  home: {
    greeting: '何をはじめますか？',
    emptyLead: 'やりたいことを、そのまま書いてください。',
    views: { office: 'オフィス', desk: 'デスク', progress: '進捗', flow: 'ワークフロー' },
  },

  error: {
    title: 'うまくいきませんでした',
    retry: 'もう一度',
    back: 'ホームへ戻る',
    notFound: 'この画面は見つかりませんでした',
    unauthorized: 'ログインが要ります',
    rateLimited: '枠に当たって止まりました',
  },
}
