/**
 * **行き先の検査**（2026-08-27）。ブラウザを立てずに、`lib/web/fetch.ts` の
 * 断り方だけを確かめる。ここは**危ないところ**なので、通しの検査に混ぜず1本にする —
 * 「モデルが行き先を決める」ので、緩めた瞬間にサーバーの中が読まれる。
 *
 *   npx tsx tools/check/safe.ts
 */
import { blockedWhy, normalize, readPage, textOf } from '../../lib/web/fetch';

let bad = 0;
const ok = (name: string, pass: boolean, saw = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `  ← ${saw}`}`);
  if (!pass) bad++;
};
/** 本番の顔で見る（`DEMO_MODE` を渡さない） */
const no = (url: string) => blockedWhy(url, false);
const yes = (url: string) => blockedWhy(url, false) === null;

console.log('— 通すもの —');
ok('ふつうの https', yes('https://example.com/about'));
ok('頭を落として書いても通る（https を足す）', yes('example.com/about'), String(no('example.com/about')));
ok('443 は既定なので通る', yes('https://example.com:443/'));

console.log('\n— 断るもの —');
ok('http は断る', !!no('http://example.com'), String(no('http://example.com')));
ok('file: は断る', !!no('file:///etc/passwd'));
ok('localhost は断る', !!no('https://localhost/x'));
ok('127.0.0.1 は断る', !!no('https://127.0.0.1/x'));
ok('10.x は断る', !!no('https://10.0.0.5/x'));
ok('172.16〜31 は断る', !!no('https://172.20.1.1/x'));
ok('192.168 は断る', !!no('https://192.168.1.1/x'));
ok('169.254（クラウドのメタデータ）は断る', !!no('https://169.254.169.254/latest/meta-data/'));
ok('::1 は断る', !!no('https://[::1]/x'));
ok('fd00（ユニークローカル）は断る', !!no('https://[fd00::1]/x'));
ok('*.internal は断る', !!no('https://db.internal/x'));
ok('URL の中の利用者名とパスワードは断る', !!no('https://user:pass@example.com/'));
ok('既定でない口は断る', !!no('https://example.com:2375/'), String(no('https://example.com:2375/')));
ok('形になっていないものは断る', !!no('ほげ'));

console.log('\n— 中身を取り出す —');
const got = textOf(
  '<html><head><title>パン屋</title><style>a{}</style></head>'
  + '<body><script>alert(1)</script><h1>朝のパン</h1><p>6時に焼きます。</p>'
  + '<ul><li>食パン</li><li>あんぱん</li></ul></body></html>');
ok('題が取れる', got.title === 'パン屋', got.title ?? '(なし)');
ok('script と style は落ちる', !/alert|a\{\}/.test(got.text), got.text.slice(0, 60));
ok('見出しと本文が行で分かれる', /朝のパン\n6時に焼きます。/.test(got.text), JSON.stringify(got.text));
ok('箇条書きは印が付く', /・食パン/.test(got.text) && /・あんぱん/.test(got.text), JSON.stringify(got.text));

console.log('\n— 転送の先も、同じ検査に掛ける —');
ok('相対の転送先を絶対に直してから見る',
   normalize('example.com') === 'https://example.com'
   && new URL('/x', 'https://example.com/a/b').toString() === 'https://example.com/x');

/**
 * **本当に取ってこられるか。** `BASE` を渡したときだけ走る（立っているサーバーの
 * `/login` を読む）。この環境は外に出られないので、確かめられるのは自分自身だけ —
 * それでも「取る → タグを落とす → 本文になる」は本物の道を通る。
 *
 *   BASE=http://127.0.0.1:3460 DEMO_MODE=1 npx tsx tools/check/safe.ts
 */
if (process.env.BASE) {
  console.log('\n— 本当に読む —');
  process.env.DEMO_MODE = '1';                  // localhost を通すのはデモのときだけ
  try {
    const page = await readPage(`${process.env.BASE.replace('localhost', '127.0.0.1')}/login`);
    ok('取ってこられた', page.text.length > 20, page.text.slice(0, 60));
    ok('タグが落ちている', !/[<>]/.test(page.text.slice(0, 400)), page.text.slice(0, 60));
    ok('中身が本文になっている', /OneFound|ログイン|メール/.test(page.text), page.text.slice(0, 90));
  } catch (e) {
    ok('取ってこられた', false, e instanceof Error ? e.message : String(e));
  }
  // **私設アドレスは、デモでも本番の顔で見ると断る**（栓の向きを取り違えない）
  ok('デモでなければ、同じ住所を断る', !!blockedWhy(`${process.env.BASE}/login`, false));
}

console.log(bad ? `\n${bad}件 通らなかった` : '\nぜんぶ通った');
process.exit(bad ? 1 : 0);
