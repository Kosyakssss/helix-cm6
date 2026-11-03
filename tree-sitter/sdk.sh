#!/bin/sh
set -eu
sdk_version=29
if [ -n "${WASI_SDK_PATH:-}" ]; then
  echo "$WASI_SDK_PATH"
  exit 0
fi
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) platform=arm64-macos ;;
  Darwin-x86_64) platform=x86_64-macos ;;
  Linux-aarch64) platform=arm64-linux ;;
  Linux-x86_64) platform=x86_64-linux ;;
  *) echo "unsupported platform" >&2; exit 1 ;;
esac
path="${XDG_CACHE_HOME:-$HOME/.cache}/helix-motions/wasi-sdk-$sdk_version.0-$platform"
if [ ! -x "$path/bin/clang" ]; then
  mkdir -p "$(dirname "$path")"
  curl -fsSL "https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-$sdk_version/wasi-sdk-$sdk_version.0-$platform.tar.gz" | tar -xz -C "$(dirname "$path")"
fi
echo "$path"
