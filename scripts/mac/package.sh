#!/usr/bin/env bash
# Builds dist/facet-mac.tar.gz: the standalone server plus Node for both Mac chips, so install.sh
# needs nothing else on the Mac. Runs on Linux or macOS.
set -euo pipefail

NODE_VERSION=24.21.0
root=$(git rev-parse --show-toplevel)
dist="$root/dist"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$dist/cache" "$work/src" "$work/facet"

# Build from the files git would commit, so the ignored ones (data/ with CVs, .env with the key)
# can't reach the bundle.
git -C "$root" ls-files -z --cached --others --exclude-standard |
  tar -C "$root" --null -T - -c | tar -x -C "$work/src"
(cd "$work/src" && bun install --frozen-lockfile && bun run build)

app="$work/facet/app"
cp -R "$work/src/.next/standalone" "$app"
cp -R "$work/src/.next/static" "$app/.next/static"
cp -R "$work/src/public" "$app/public"
cp "$work/src/.env.example" "$root/scripts/mac/start.sh" "$app/"
# sharp serves next/image, which the app doesn't use, and the traced binaries are this machine's.
rm -rf "$app/node_modules/sharp" "$app/node_modules/@img"
if [ -e "$app/data" ] || [ -e "$app/.env" ]; then
  echo "The bundle contains data/ or .env; refusing to package it." >&2
  exit 1
fi

sums="$dist/cache/SHASUMS256-$NODE_VERSION.txt"
[ -f "$sums" ] || curl -fsSL -o "$sums" "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"
for arch in arm64 x64; do
  name="node-v$NODE_VERSION-darwin-$arch"
  [ -f "$dist/cache/$name.tar.gz" ] ||
    curl -fsSL -o "$dist/cache/$name.tar.gz" "https://nodejs.org/dist/v$NODE_VERSION/$name.tar.gz"
  (cd "$dist/cache" && grep " $name.tar.gz\$" "$sums" | shasum -a 256 -c --status)
  tar -xzf "$dist/cache/$name.tar.gz" -C "$work/facet" --strip-components=2 "$name/bin/node"
  mv "$work/facet/node" "$work/facet/node-$arch"
done

tar -czf "$dist/facet-mac.tar.gz" -C "$work" facet
cp "$root/scripts/mac/install.sh" "$dist/"
echo "Built $dist/facet-mac.tar.gz ($(du -h "$dist/facet-mac.tar.gz" | cut -f1))"
