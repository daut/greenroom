#!/bin/sh
# Greenroom installer for macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/daut/greenroom/main/install.sh | sh
#   curl -fsSL .../install.sh | sh -s -- --uninstall
#
# Env:
#   GREENROOM_VERSION   install a specific version (e.g. 0.2.0), default: latest
#   GREENROOM_BASE_URL  override download location (testing / mirrors)
#
# Re-running the script updates an existing install.
set -eu

REPO="daut/greenroom"
APP_NAME="Greenroom"

main() {
  case "${1:-}" in
    --uninstall) uninstall; exit 0 ;;
    -h | --help) usage; exit 0 ;;
    "") ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac

  need curl
  os=$(detect_os)
  arch=$(detect_arch)
  artifact=$(artifact_name "$os" "$arch")
  base_url=$(release_url)

  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT INT TERM

  say "Downloading $artifact"
  download "$base_url/$artifact" "$tmp/$artifact"
  download "$base_url/SHA256SUMS" "$tmp/SHA256SUMS"
  verify_checksum "$tmp" "$artifact"

  case "$os" in
    mac) install_mac "$tmp/$artifact" ;;
    linux) install_linux "$tmp/$artifact" ;;
  esac
}

usage() {
  sed -n '2,12p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//' || true
}

install_mac() {
  dest="${GREENROOM_INSTALL_DIR:-$HOME/Applications}"
  mkdir -p "$dest"
  unzip -q "$1" -d "$tmp/app"
  quit_running_mac_app
  rm -rf "$dest/$APP_NAME.app"
  mv "$tmp/app/$APP_NAME.app" "$dest/"
  # Unsigned build: drop the quarantine flag so Gatekeeper doesn't block first launch.
  xattr -dr com.apple.quarantine "$dest/$APP_NAME.app" 2>/dev/null || true

  say "Installed $dest/$APP_NAME.app"
  say "Launch it from Spotlight or: open -a \"$dest/$APP_NAME.app\""
}

install_linux() {
  data_dir="${XDG_DATA_HOME:-$HOME/.local/share}"
  app_dir="$data_dir/greenroom"
  bin_dir="$HOME/.local/bin"
  mkdir -p "$app_dir" "$bin_dir" "$data_dir/applications"

  mv "$1" "$app_dir/$APP_NAME.AppImage"
  chmod +x "$app_dir/$APP_NAME.AppImage"
  ln -sf "$app_dir/$APP_NAME.AppImage" "$bin_dir/greenroom"
  write_desktop_entry "$data_dir/applications/greenroom.desktop" "$app_dir/$APP_NAME.AppImage"

  say "Installed $bin_dir/greenroom"
  case ":$PATH:" in
    *":$bin_dir:"*) ;;
    *) say "Note: add $bin_dir to your PATH to run 'greenroom' from a terminal." ;;
  esac
  warn_if_fuse_missing
}

write_desktop_entry() {
  cat >"$1" <<EOF
[Desktop Entry]
Type=Application
Name=$APP_NAME
Comment=Personal interview and presentation trainer
Exec="$2" %U
Terminal=false
Categories=Education;
EOF
}

warn_if_fuse_missing() {
  if ! ldconfig -p 2>/dev/null | grep -q 'libfuse.so.2'; then
    say "Note: AppImages need libfuse2 (Debian/Ubuntu: sudo apt install libfuse2t64 or libfuse2)."
    say "      Alternatively install the .deb from https://github.com/$REPO/releases"
  fi
}

uninstall() {
  case "$(detect_os)" in
    mac)
      quit_running_mac_app
      rm -rf "${GREENROOM_INSTALL_DIR:-$HOME/Applications}/$APP_NAME.app"
      data="$HOME/Library/Application Support/$APP_NAME"
      ;;
    linux)
      data_dir="${XDG_DATA_HOME:-$HOME/.local/share}"
      rm -rf "$data_dir/greenroom"
      rm -f "$HOME/.local/bin/greenroom" "$data_dir/applications/greenroom.desktop"
      data="${XDG_CONFIG_HOME:-$HOME/.config}/$APP_NAME"
      ;;
  esac
  say "Uninstalled $APP_NAME. Your settings and keys are kept in: $data"
}

quit_running_mac_app() {
  osascript -e "quit app \"$APP_NAME\"" >/dev/null 2>&1 || true
}

detect_os() {
  case "$(uname -s)" in
    Darwin) echo mac ;;
    Linux) echo linux ;;
    *) die "unsupported OS: $(uname -s) (macOS and Linux only)" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64 | amd64) echo x64 ;;
    arm64 | aarch64) echo arm64 ;;
    *) die "unsupported CPU architecture: $(uname -m)" ;;
  esac
}

artifact_name() {
  case "$1-$2" in
    mac-*) echo "greenroom-mac-$2.zip" ;;
    linux-x64) echo "greenroom-linux-x86_64.AppImage" ;;
    linux-arm64) echo "greenroom-linux-arm64.AppImage" ;;
  esac
}

release_url() {
  if [ -n "${GREENROOM_BASE_URL:-}" ]; then
    echo "$GREENROOM_BASE_URL"
  elif [ -n "${GREENROOM_VERSION:-}" ]; then
    echo "https://github.com/$REPO/releases/download/v${GREENROOM_VERSION#v}"
  else
    echo "https://github.com/$REPO/releases/latest/download"
  fi
}

download() {
  curl -fSL --progress-bar "$1" -o "$2" || die "download failed: $1"
}

verify_checksum() {
  expected=$(grep " $2\$" "$1/SHA256SUMS" | cut -d' ' -f1)
  [ -n "$expected" ] || die "no checksum listed for $2"
  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$1/$2" | cut -d' ' -f1)
  else
    actual=$(shasum -a 256 "$1/$2" | cut -d' ' -f1)
  fi
  [ "$expected" = "$actual" ] || die "checksum mismatch for $2"
  say "Checksum OK"
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is required"
}

say() {
  printf '%s\n' "$*"
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

main "$@"
