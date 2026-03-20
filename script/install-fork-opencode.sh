#!/usr/bin/env bash

set -euo pipefail

REPO_URL="${OPENCODE_REPO_URL:-git@github.com:p4r4d0xb0x/opencode.git}"
BRANCH="${OPENCODE_BRANCH:-local/remove-pr-18186}"
ROOT_DIR="${OPENCODE_ROOT_DIR:-$HOME/work/opencode-fork}"
INSTALL_DIR="${OPENCODE_INSTALL_DIR:-$HOME/.local/bin}"
BIN_PATH="$INSTALL_DIR/opencode"

require() {
  if command -v "$1" >/dev/null 2>&1; then
    return
  fi
  echo "error: missing required command: $1" >&2
  exit 1
}

os_name() {
  case "$(uname -s)" in
    Darwin) echo "darwin" ;;
    Linux) echo "linux" ;;
    *)
      echo "error: unsupported OS: $(uname -s)" >&2
      exit 1
      ;;
  esac
}

cpu_name() {
  case "$(uname -m)" in
    arm64|aarch64) echo "arm64" ;;
    x86_64|amd64) echo "x64" ;;
    *)
      echo "error: unsupported CPU: $(uname -m)" >&2
      exit 1
      ;;
  esac
}

require git
require bun

if [[ -d "$ROOT_DIR/.git" ]]; then
  if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]]; then
    echo "error: $ROOT_DIR has uncommitted changes. clean or stash before updating." >&2
    exit 1
  fi
  git -C "$ROOT_DIR" fetch origin
else
  mkdir -p "$(dirname "$ROOT_DIR")"
  git clone "$REPO_URL" "$ROOT_DIR"
fi

if ! git -C "$ROOT_DIR" ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "error: branch '$BRANCH' not found on origin. push it first." >&2
  exit 1
fi

git -C "$ROOT_DIR" checkout "$BRANCH"
git -C "$ROOT_DIR" pull --ff-only origin "$BRANCH"

bun install --cwd "$ROOT_DIR"
bun run --cwd "$ROOT_DIR/packages/opencode" build --single

target="opencode-$(os_name)-$(cpu_name)"
src="$ROOT_DIR/packages/opencode/dist/$target/bin/opencode"

if [[ ! -x "$src" ]]; then
  echo "error: built binary not found: $src" >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
ln -sfn "$src" "$BIN_PATH"

echo "installed: $BIN_PATH -> $src"
"$BIN_PATH" --version

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo "note: add $INSTALL_DIR to PATH"
fi
