#!/bin/bash
# Installs Mouse's auto-updater (com.livingtown.updater): every 5 minutes it
# deploys new commits on the watched GitHub branch, testing them first and
# rolling back if a restart fails. See deploy/auto-update.js.
# Remove it with:  launchctl bootout gui/$(id -u)/com.livingtown.updater && rm ~/Library/LaunchAgents/com.livingtown.updater.plist
set -euo pipefail
APP="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.livingtown.updater"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE="$(command -v node || echo /opt/homebrew/bin/node)"
git -C "$APP/.." fetch --quiet origin || { echo "Can't reach GitHub from here. Sign in first: gh auth login"; exit 1; }
sed -e "s#/ABSOLUTE/PATH/TO/node#$NODE#" -e "s#/ABSOLUTE/PATH/TO/living-town#$APP#g" "$APP/deploy/$LABEL.plist" > "$PLIST"
launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Auto-updater installed. It checks every 5 minutes; its log is /tmp/living-town-updater.log"
