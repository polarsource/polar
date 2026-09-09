#!/bin/bash
set -euo pipefail

REPO="polarsource/cli"
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

  if [ "$os" = "linux" ] && [ "$arch" = "arm64" ]; then
    error "Linux arm64 is not yet supported"
  fi

  echo "${os}-${arch}"
}

get_latest_version() {
  local version
  version=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
  if [ -z "$version" ]; then
    error "Failed to determine latest version"
  fi
  echo "$version"
}

get_archive_name() {
  local platform="$1"

  case "$platform" in
    darwin-*) echo "${BINARY_NAME}-${platform}.zip" ;;
    *) echo "${BINARY_NAME}-${platform}.tar.gz" ;;
  esac
}

main() {
  local platform version url

  info "Detecting platform..."
  platform="$(detect_platform)"
  info "Platform: ${platform}"

  info "Fetching latest version..."
  version="$(get_latest_version)"
  info "Version: ${version}"

  local archive
  archive="$(get_archive_name "$platform")"
  local url="https://github.com/${REPO}/releases/download/${version}/${archive}"
  local checksums_url="https://github.com/${REPO}/releases/download/${version}/checksums.txt"

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
