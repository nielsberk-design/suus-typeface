#!/bin/bash
# Installs the Suus Typeface CEP panel for Illustrator on macOS.
# Usage: bash install-mac.sh   (run again after every update)
set -euo pipefail

EXT_ID="com.nielsberk.suustypeface"
SRC="$(cd "$(dirname "$0")" && pwd)/panel"
EXT_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
DEST="$EXT_DIR/$EXT_ID"

if [ ! -f "$SRC/CSXS/manifest.xml" ]; then
    echo "Fout: $SRC/CSXS/manifest.xml niet gevonden. Start dit script vanuit de projectmap." >&2
    exit 1
fi

# Unsigned extensions only load with PlayerDebugMode on. 13 is included in
# case a newer Illustrator moves to CSXS 13; an unused key is harmless.
echo "PlayerDebugMode aanzetten voor CSXS 9 t/m 13..."
for v in 9 10 11 12 13; do
    defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1
done
# Make sure the preference daemon picks up the new values right away.
killall cfprefsd 2>/dev/null || true

mkdir -p "$EXT_DIR"
if [ -e "$DEST" ] || [ -L "$DEST" ]; then
    echo "Oude installatie verwijderen: $DEST"
    rm -rf "$DEST"
fi

cp -R "$SRC" "$DEST"
echo "Gekopieerd naar: $DEST"

# Files from a downloaded ZIP can carry a quarantine flag that blocks loading.
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

echo
echo "Klaar. Herstart Illustrator en open Venster > Extensies > Suus Typeface."
