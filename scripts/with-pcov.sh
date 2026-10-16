#!/bin/sh
# Runs a command with pcov available to PHP: the system one if enabled, otherwise the local build from install-pcov.sh.
# usage: sh scripts/with-pcov.sh <command...>
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"

if ! php -r 'exit(extension_loaded("pcov") ? 0 : 1);'; then
    if [ -f "$ROOT/.pcov/pcov.ini" ]; then
        SYSTEM_DIR="$(php -r 'echo PHP_CONFIG_FILE_SCAN_DIR;')"
        export PHP_INI_SCAN_DIR="$ROOT/.pcov${PHP_INI_SCAN_DIR:+:$PHP_INI_SCAN_DIR}${SYSTEM_DIR:+:$SYSTEM_DIR}"
    else
        echo "pcov is not installed, it is needed for PHP server coverage." >&2
        echo "Run 'pnpm coverage:setup' to build it locally, or install it system-wide (pecl install pcov)." >&2
        exit 1
    fi
fi

exec "$@"
