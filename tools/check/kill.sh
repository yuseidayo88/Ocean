#!/bin/sh
# 立ち上げっぱなしの next と、検査用の MCP サーバーを落とす。
#
# **話す相手も落とす**（2026-08-27）。前は next だけ見ていたので、
# 前の検査が残した `mcp-test` が口をふさぎ、**次の検査が別のサーバーと話していた**
# — 実際、鍵の要らないはずの相手が 401 を返し、通るはずのない道が通った。
# **`/tmp` に置かない** — 器が入れ替わると消えて、次のセッションの自分が困る
# （実際そうなっていた: `sh /tmp/killnext.sh` は新しいセッションでは存在しない）。
for p in /proc/[0-9]*; do
  pid=${p#/proc/}
  [ "$pid" = "$$" ] && continue
  c=$(tr '\0' ' ' < "$p/cmdline" 2>/dev/null)
  case "$c" in
    */bin/bash*|*kill.sh*) continue ;;
  esac
  case "$c" in
    *next-server*|*"next start"*|*mcp-test/server.mjs*) echo "kill $pid"; kill -9 "$pid" 2>/dev/null ;;
  esac
done
