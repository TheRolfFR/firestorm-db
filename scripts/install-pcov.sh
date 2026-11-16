#!/bin/sh
# Builds the pcov extension (PHP line coverage) into <repo>/.pcov without touching the system PHP install.
# usage: sh scripts/install-pcov.sh   (or: pnpm coverage:setup)
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
DEST="$ROOT/.pcov"

if php -r 'exit(extension_loaded("pcov") ? 0 : 1);'; then
    echo "pcov is already enabled in your PHP install, nothing to do."
    exit 0
fi

for tool in php phpize curl tar make; do
    if ! command -v "$tool" > /dev/null 2>&1; then
        echo "Missing '$tool'. phpize comes with the PHP development package (e.g. 'apt install php-dev')." >&2
        exit 1
    fi
done

BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT

echo "Downloading pcov..."
curl -fsSL https://pecl.php.net/get/pcov | tar xz -C "$BUILD"
cd "$BUILD"/pcov-*

# Homebrew PHP does not expose pcre2 headers by default
CPPFLAGS=""
if command -v brew > /dev/null 2>&1 && brew --prefix pcre2 > /dev/null 2>&1; then
    CPPFLAGS="-I$(brew --prefix pcre2)/include"
fi

echo "Building pcov for PHP $(php -r 'echo PHP_VERSION;')..."
phpize > /dev/null
./configure CPPFLAGS="$CPPFLAGS" > /dev/null
make > /dev/null

mkdir -p "$DEST"
cp modules/pcov.so "$DEST/pcov.so"
echo "extension=$DEST/pcov.so" > "$DEST/pcov.ini"

echo "pcov installed in $DEST, 'pnpm coverage' will use it automatically."
