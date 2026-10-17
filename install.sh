
#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/quickshell/rosemenu"

for file in shell.qml config.js search.js; do
    if [[ ! -f "$SOURCE_DIR/$file" ]]; then
        printf 'error: missing required file: %s\n' "$file" >&2
        exit 1
    fi
done

if ! command -v qs >/dev/null 2>&1; then
    printf 'error: quickshell (qs) is not installed.\n' >&2
    exit 1
fi

mkdir -p "$TARGET_DIR"

BACKUP_DIR="$TARGET_DIR/.backup-$(date +%Y%m%d-%H%M%S)"
BACKED_UP=0

for file in shell.qml config.js search.js; do
    if [[ -f "$TARGET_DIR/$file" ]]; then
        if (( BACKED_UP == 0 )); then
            mkdir -p "$BACKUP_DIR"
            BACKED_UP=1
        fi
        cp -a "$TARGET_DIR/$file" "$BACKUP_DIR/$file"
    fi
done

for file in shell.qml config.js search.js; do
    install -m 644 "$SOURCE_DIR/$file" "$TARGET_DIR/$file"
done

printf 'rosemenu installed to %s\n' "$TARGET_DIR"
printf 'launch with: qs -c rosemenu\n'
