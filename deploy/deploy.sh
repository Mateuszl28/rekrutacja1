#!/usr/bin/env bash
# Wdrożenie MebleLab 3D na VPS (Ubuntu + systemd), przez narzędzia PuTTY (pscp/plink).
#
# Uruchomienie (Git Bash / Windows, PuTTY w PATH):
#   KEY='C:\Users\lagoc\Desktop\vps.ppk' HOST='root@85.215.197.199' PORT=8090 bash deploy/deploy.sh
#
# Serwis nasłuchuje na PORT (domyślnie 8090) i serwuje frontend z dist/ + API /api.
# Nie rusza innych usług (np. Vibe na :8080).
set -e

KEY="${KEY:-C:\\Users\\lagoc\\Desktop\\vps.ppk}"
HOST="${HOST:-root@85.215.197.199}"
PORT="${PORT:-8090}"
DEST="/opt/meblelab-3d"

echo "› Build produkcyjny…"
npm run build

echo "› Kopiowanie na $HOST:$DEST (port $PORT)…"
plink -batch -i "$KEY" "$HOST" "mkdir -p $DEST/server"
pscp -batch -i "$KEY" -r dist "$HOST:$DEST/"
pscp -batch -i "$KEY" server/index.mjs "$HOST:$DEST/server/index.mjs"
pscp -batch -i "$KEY" deploy/meblelab-3d.service "$HOST:/etc/systemd/system/meblelab-3d.service"

echo "› Uruchamianie usługi systemd…"
plink -batch -i "$KEY" "$HOST" \
  "systemctl daemon-reload && systemctl enable meblelab-3d && systemctl restart meblelab-3d && sleep 2 && systemctl is-active meblelab-3d"

echo "✓ Wdrożono → http://${HOST#*@}:${PORT}/"
