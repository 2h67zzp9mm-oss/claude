#!/bin/bash
# Installs (or updates) the Blacksteel Pirates game as a background service on this Mac (Mouse).
# Fills in the launchd template with this Mac's Node, this folder, and its Tailscale address,
# then starts it on port 4320 (Living Town stays on 4310). Safe to run again after an update.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.blacksteel.game"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PORT=4320

NODE="$(command -v node || true)"
[ -z "$NODE" ] && for n in /opt/homebrew/bin/node /usr/local/bin/node; do [ -x "$n" ] && NODE="$n" && break; done
[ -z "$NODE" ] && { echo "Node isn't installed. Living Town's Node should be here; try: brew install node"; exit 1; }

TS="$(command -v tailscale || true)"
[ -z "$TS" ] && [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ] && TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale
[ -z "$TS" ] && { echo "Tailscale isn't installed or isn't on the PATH."; exit 1; }
IP="$("$TS" ip -4 | head -1)"
[ -z "$IP" ] && { echo "Tailscale isn't connected. Open Tailscale, sign in, and run this again."; exit 1; }

if lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1 && ! launchctl list | grep -q "$LABEL"; then
  echo "Something else is already using port $PORT:"; lsof -iTCP:$PORT -sTCP:LISTEN; exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"
sed -e "s#/ABSOLUTE/PATH/TO/node#$NODE#" \
    -e "s#/ABSOLUTE/PATH/TO/blacksteel#$DIR#" \
    -e "s#MOUSE_TAILSCALE_IP#$IP#" \
    "$DIR/deploy/$LABEL.plist" > "$PLIST"

launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load "$PLIST"

echo "Waiting for the game to start..."
for i in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://$IP:$PORT/" || true)"
  [ "$code" = "200" ] && break
  sleep 1
done
if [ "$code" = "200" ]; then
  echo
  echo "Blacksteel Pirates is running."
  echo "  On your phones (Tailscale on):  http://$IP:$PORT"
  echo "  Living Town is still at:        http://$IP:4310"
  echo
  lsof -iTCP:$PORT -sTCP:LISTEN
else
  echo "The game didn't start. The log says:"; tail -20 /tmp/blacksteel.log 2>/dev/null || true; exit 1
fi
