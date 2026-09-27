#!/bin/bash
# Double-click in Finder to install or update the Blacksteel Pirates game on this Mac.
cd "$(dirname "$0")" && ./deploy/install.sh
echo; read -n 1 -s -r -p "Press any key to close."
