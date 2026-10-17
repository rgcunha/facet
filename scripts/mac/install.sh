#!/usr/bin/env bash
# Installs or updates Facet for the current user, with no admin rights. Run it in Terminal:
#   curl -fsSL https://github.com/rgcunha/facet/releases/latest/download/install.sh | bash
# Downloads made by curl aren't quarantined, so Gatekeeper lets the unsigned Node binary run.
set -euo pipefail

# All in a function, so a download cut short runs nothing.
main() {
  home="$HOME/Library/Application Support/Facet"
  release=https://github.com/rgcunha/facet/releases/latest/download

  echo "Downloading Facet…"
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  curl -fL --progress-bar -o "$tmp/facet.tar.gz" "$release/facet-mac.tar.gz"
  tar -xzf "$tmp/facet.tar.gz" -C "$tmp"

  # An update replaces the app; the CVs (data) and the settings (.env) next to it stay.
  pkill -f "$home/app/server.js" || true
  mkdir -p "$home/data"
  rm -rf "$home/app"
  mv "$tmp/facet/app" "$home/app"
  # sysctl, not uname: Terminal may run under Rosetta on Apple Silicon.
  [ "$(sysctl -in hw.optional.arm64)" = 1 ] && arch=arm64 || arch=x64
  mv "$tmp/facet/node-$arch" "$home/app/node"

  if [ ! -f "$home/.env" ]; then
    key=$(osascript -e 'text returned of (display dialog "Paste the OpenRouter key you were given:" default answer "" with hidden answer with title "Facet")')
    if [ -z "$key" ]; then
      echo "No key entered. Run the install command again to enter it." >&2
      exit 1
    fi
    (umask 077 && { grep -v '^LLM_API_KEY=' "$home/app/.env.example"; printf 'LLM_API_KEY=%s\n' "$key"; } >"$home/.env")
  fi
  ln -s ../.env "$home/app/.env"

  mkdir -p "$HOME/Applications"
  rm -rf "$HOME/Applications/Facet.app"
  osacompile -o "$HOME/Applications/Facet.app" -e "do shell script quoted form of \"$home/app/start.sh\""

  if [ ! -d "/Applications/Google Chrome.app" ]; then
    echo "Note: exporting PDFs needs Google Chrome. Install it from https://www.google.com/chrome/"
  fi
  echo "Facet is installed. Open it any time from Applications (or Spotlight: \"Facet\")."
  open "$HOME/Applications/Facet.app"
}

main
