#!/bin/sh
# 立ち上げっぱなしの next を落とす。
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
    *next-server*|*"next start"*) echo "kill $pid"; kill -9 "$pid" 2>/dev/null ;;
  esac
done
