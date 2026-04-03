#!/usr/bin/env bash
# Run after: full Xcode from App Store + xcode-select pointed at Xcode.app + free disk space (~15GB+).
set -euo pipefail
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export PATH="${HOME}/.gem/ruby/2.6.0/bin:${PATH}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}/ios"

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "ERROR: xcodebuild failed. Install Xcode from the App Store, open it once, then run:"
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

pod install
echo "Open: open \"${ROOT}/ios/UNROT.xcworkspace\""
