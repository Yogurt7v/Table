#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1
echo "Stopping PocketBase..."

# Способ 1: По PID файлу
if [ -f pocketbase.pid ]; then
    PID=$(cat pocketbase.pid 2>/dev/null)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        kill -TERM "$PID" 2>/dev/null
        sleep 1
        kill -KILL "$PID" 2>/dev/null  # Принудительно, если не завершился
        rm -f pocketbase.pid
        echo "Stopped by PID: $PID"
        exit 0
    else
        rm -f pocketbase.pid
    fi
fi

# Способ 2: По имени процесса
PIDS=$(pgrep -f "pocketbase serve" 2>/dev/null)
if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -TERM 2>/dev/null
    sleep 1
    echo "$PIDS" | xargs kill -KILL 2>/dev/null 2>&1
    echo "Stopped by process name"
    exit 0
fi

# Способ 3: По порту (запасной вариант)
PID=$(lsof -ti :8090 2>/dev/null)
if [ -n "$PID" ]; then
    kill -KILL "$PID" 2>/dev/null
    echo "Stopped process on port 8090 (PID: $PID)"
    exit 0
fi

echo "PocketBase is not running or already stopped."
