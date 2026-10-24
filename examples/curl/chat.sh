#!/usr/bin/env sh
# 零依賴範例:chat/completions 的原始 HTTP 形態。
# 環境變數:AUTONOMIA_BASE_URL(預設 http://localhost:8787/api/ai/v1)、AUTONOMIA_API_KEY、AUTONOMIA_MODEL(選配)
set -eu

BASE_URL="${AUTONOMIA_BASE_URL:-http://localhost:8787/api/ai/v1}"
MODEL="${AUTONOMIA_MODEL:-autonomia/gpt-5.2}"

if [ -z "${AUTONOMIA_API_KEY:-}" ]; then
  echo "請先設定 AUTONOMIA_API_KEY(在控制台「金鑰」頁建立)" >&2
  exit 1
fi

curl -sS "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $AUTONOMIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(printf '{
    "model": "%s",
    "messages": [{"role": "user", "content": "用一句話介紹你自己。"}]
  }' "$MODEL")"
echo
