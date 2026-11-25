#!/bin/sh
# Render the Homebrew cask for a release from its SHA256SUMS file.
#   scripts/update-cask.sh 0.1.0 dist/SHA256SUMS > greenroom.rb
set -eu

version=${1:?usage: update-cask.sh <version> <SHA256SUMS>}
sums=${2:?usage: update-cask.sh <version> <SHA256SUMS>}
template="$(dirname "$0")/../packaging/homebrew/greenroom.rb.tmpl"

sha_for() {
  value=$(grep " $1\$" "$sums" | cut -d' ' -f1)
  [ -n "$value" ] || { echo "error: no checksum for $1 in $sums" >&2; exit 1; }
  echo "$value"
}

arm=$(sha_for greenroom-mac-arm64.zip)
x64=$(sha_for greenroom-mac-x64.zip)

sed -e "s/@VERSION@/$version/" -e "s/@SHA_ARM64@/$arm/" -e "s/@SHA_X64@/$x64/" "$template"
