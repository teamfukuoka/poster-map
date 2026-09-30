#!/usr/bin/env bash
# 流用元の名称が NOTICE.md 以外に残っていないかを調べる（無所属候補のサイトのため）
set -euo pipefail
cd "$(dirname "$0")/.."
if grep -rIniE 'チームみらい|チーム未来|チーみら|team[-_ ]?mir|mirai|action\.team' . \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
  --exclude=NOTICE.md --exclude=check-branding.sh --exclude=pnpm-lock.yaml; then
  echo "NG: 流用元の名称が残っています。NOTICE.md 以外に書かないでください。" >&2
  exit 1
fi
echo "OK: branding"
