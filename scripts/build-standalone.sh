#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm build:portable

APP=TableApp
rm -rf "$APP"
mkdir -p "$APP"

cp -R pb_public "$APP/pb_public"
rm -f "$APP/pb_public/mockServiceWorker.js"

mkdir -p "$APP/pb_hooks"
for f in pb_hooks/*.pb.js; do
  name=$(basename "$f")
  if [ "$name" != "encryption.pb.js" ]; then
    cp "$f" "$APP/pb_hooks/"
  fi
done

cp -R pb_migrations "$APP/pb_migrations"
cp pocketbase "$APP/pocketbase"
cp standalone/start.command "$APP/start.command"
cp standalone/start.bat "$APP/start.bat"
cp standalone/README.txt "$APP/README.txt"

TOOLS=${PB_TOOLS:-tools}
if [ -f "$TOOLS/pocketbase.exe" ]; then
  cp "$TOOLS/pocketbase.exe" "$APP/"
else
  echo "ВНИМАНИЕ: $TOOLS/pocketbase.exe не найден — комплект не будет работать на Windows" >&2
fi
if [ -f "$TOOLS/pocketbase_intel" ]; then
  cp "$TOOLS/pocketbase_intel" "$APP/"
else
  echo "ВНИМАНИЕ: $TOOLS/pocketbase_intel не найден — macOS на Intel не поддержан" >&2
fi

chmod +x "$APP/start.command" "$APP"/pocketbase*

echo ""
echo "Готово: $APP/"
