#!/usr/bin/env bash
# Builds the Mac bundle and publishes it as the latest GitHub release, which install.sh downloads.
set -euo pipefail

if [ -n "$(git status --porcelain)" ]; then
  echo "Commit your changes first: a release is built from the working tree." >&2
  exit 1
fi
bash "$(dirname "$0")/package.sh"
root=$(git rev-parse --show-toplevel)
gh release create "v$(date +%Y.%m.%d-%H%M)" "$root/dist/facet-mac.tar.gz" "$root/dist/install.sh" \
  --repo rgcunha/facet --target "$(git rev-parse HEAD)" --generate-notes
