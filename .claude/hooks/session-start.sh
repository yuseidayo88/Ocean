#!/bin/bash
# セッションが始まるたびに、検査が走れる状態まで持っていく。
#
# **毎回やり直していたことを、ここに畳んだ**（Hermes の輪の「土台」）。
# 前は新しいセッションのたびに `npm install` → `npm run build` → headless chrome を
# 手で立て直していて、そのやり方は僕の頭の中にしか無かった。
set -euo pipefail

# 手もとの開発では動かさない（器を触らない）
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# ① 依存。`ci` ではなく `install`（器のキャッシュが効く）
npm install --no-audit --no-fund

# ② ビルド。検査は `next start` を使うので、1回目のビルドはどのみち要る
npm run build

# ③ 検査を動かす headless chrome（CDP は 9335）。
#    **版を決め打ちしない** — 器が変わると番号が変わる
if ! curl -s -o /dev/null --max-time 2 http://127.0.0.1:9335/json/version; then
  shell=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | head -1 || true)
  if [ -n "$shell" ]; then
    (setsid nohup "$shell" --no-sandbox --use-gl=swiftshader \
       --enable-gpu-rasterization --remote-debugging-port=9335 about:blank \
       > /tmp/chrome.log 2>&1 < /dev/null &)
  fi
fi

echo "OneFound: 依存とビルドを用意しました（検査は .claude/skills/checks を読む）"
