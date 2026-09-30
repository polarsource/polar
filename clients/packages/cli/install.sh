#!/bin/bash
set -euo pipefail

REPO="polarsource/polar"
TAG_PREFIX="@polar-sh/cli@"
INSTALL_DIR="/usr/local/bin"
BINARY_NAME="polar"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

info() { echo -e "${BOLD}${GREEN}==>${NC} ${BOLD}$1${NC}"; }
warn() { echo -e "${YELLOW}warning:${NC} $1"; }
error() { echo -e "${RED}error:${NC} $1" >&2; exit 1; }

detect_platform() {
  local os arch

  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin) os="darwin" ;;
    Linux)  os="linux" ;;
    *)      error "Unsupported OS: $os" ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)             error "Unsupported architecture: $arch" ;;
  esac

  echo "${os}-${arch}"
}

# Prints each object of a JSON array on its own line, so a release's
# tag_name stays on the same line as its draft and prerelease flags.
split_json_array_objects() {
  awk '
    {
      start = 1
      n = length($0)
      for (i = 1; i <= n; i++) {
        c = substr($0, i, 1)
        if (in_string) {
          if (escaped) escaped = 0
          else if (c == "\\") escaped = 1
          else if (c == "\"") in_string = 0
        } else if (c == "\"") {
          in_string = 1
        } else if (c == "{" || c == "[") {
          if (++depth == 2) start = i
        } else if (c == "}" || c == "]") {
          if (--depth == 1) {
            print record substr($0, start, i - start + 1)
            record = ""
          }
        }
      }
      if (depth >= 2) record = record substr($0, start) " "
    }
  '
}

select_latest_cli_version() {
  awk '/"draft":[ \t]*false/ && /"prerelease":[ \t]*false/' \
    | sed -nE "s|.*\"tag_name\":[[:space:]]*\"${TAG_PREFIX}([0-9]+\.[0-9]+\.[0-9]+)\".*|\1|p" \
    | sort -t. -k1,1n -k2,2n -k3,3n \
    | tail -n 1
}

get_latest_tag() {
  local page=1 releases count all_releases="" version

  while :; do
    releases="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}" | split_json_array_objects)" \
      || error "Failed to fetch releases from ${REPO}"
    all_releases+="${releases}"$'\n'
    count="$(printf '%s' "$releases" | awk 'END { print NR }')"
    if [ "$count" -lt 100 ]; then
      break
    fi
    page=$((page + 1))
  done

  version="$(printf '%s' "$all_releases" | select_latest_cli_version)"
  if [ -z "$version" ]; then
    error "No Polar CLI release found in ${REPO}"
  fi
  echo "${TAG_PREFIX}${version}"
}

get_archive_name() {
  local platform="$1"

  case "$platform" in
    darwin-*) echo "${BINARY_NAME}-${platform}.zip" ;;
    *) echo "${BINARY_NAME}-${platform}.tar.gz" ;;
  esac
}

main() {
  local platform tag version url

  info "Detecting platform..."
  platform="$(detect_platform)"
  info "Platform: ${platform}"

  info "Fetching latest version..."
  tag="$(get_latest_tag)"
  version="${tag#"$TAG_PREFIX"}"
  info "Version: ${version}"

  local archive
  archive="$(get_archive_name "$platform")"
  local url="https://github.com/${REPO}/releases/download/${tag}/${archive}"
  local checksums_url="https://github.com/${REPO}/releases/download/${tag}/checksums.txt"

  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT

  info "Downloading ${BINARY_NAME} ${version}..."
  curl -fsSL "$url" -o "${tmpdir}/${archive}" || error "Download failed. Check if a release exists for your platform: ${platform}"

  info "Verifying checksum..."
  curl -fsSL "$checksums_url" -o "${tmpdir}/checksums.txt" || error "Failed to download checksums"

  local expected actual
  expected="$(grep "${archive}" "${tmpdir}/checksums.txt" | awk '{print $1}')"
  if [ -z "$expected" ]; then
    error "No checksum found for ${archive}"
  fi

  if command -v sha256sum &> /dev/null; then
    actual="$(sha256sum "${tmpdir}/${archive}" | awk '{print $1}')"
  elif command -v shasum &> /dev/null; then
    actual="$(shasum -a 256 "${tmpdir}/${archive}" | awk '{print $1}')"
  else
    error "No SHA-256 utility found (need sha256sum or shasum)"
  fi

  if [ "$expected" != "$actual" ]; then
    error "Checksum mismatch!\n  Expected: ${expected}\n  Got:      ${actual}"
  fi
  info "Checksum verified"

  info "Extracting..."
  case "$archive" in
    *.zip) ditto -x -k "${tmpdir}/${archive}" "$tmpdir" ;;
    *.tar.gz) tar -xzf "${tmpdir}/${archive}" -C "$tmpdir" ;;
    *) error "Unsupported archive format: ${archive}" ;;
  esac

  info "Installing to ${INSTALL_DIR}..."
  if [ -w "$INSTALL_DIR" ]; then
    mv "${tmpdir}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
  else
    sudo mv "${tmpdir}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
  fi
  chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

  local tokens_file="${HOME}/.polar/tokens.json"
  if [ -f "$tokens_file" ]; then
    rm -f "$tokens_file"
  fi

  info "Polar CLI ${version} installed successfully!"
  echo ""
  echo "  Run 'polar --help' to get started."
  echo ""
}

main
