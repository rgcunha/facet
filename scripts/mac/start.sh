#!/usr/bin/env bash
# Starts Facet unless it's already running, then opens it in the browser. The Facet app that
# install.sh puts in ~/Applications runs this.
set -euo pipefail

app=$(cd "$(dirname "$0")" && pwd)
home=$(dirname "$app")
url=http://127.0.0.1:3210

up() { curl -fs -o /dev/null "$url"; }

if ! up; then
  # --use-system-ca: trust the company's certificates, for networks that inspect TLS.
  DATA_DIR="$home/data" PORT=3210 HOSTNAME=127.0.0.1 \
    nohup "$app/node" --use-system-ca "$app/server.js" </dev/null >"$home/facet.log" 2>&1 &
  # Up to 30 s: the first start is slow while macOS scans the new Node binary.
  for _ in $(seq 150); do up && break || sleep 0.2; done
fi

if up; then
  open "$url"
else
  osascript -e "display alert \"Facet couldn't start.\" message \"Details are in $home/facet.log\""
fi
