#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1
./pocketbase serve --http=0.0.0.0:8090
