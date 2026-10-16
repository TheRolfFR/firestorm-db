#!/bin/sh
# usage: php_server_start.sh <directory> <port>
# when PHP_COVERAGE_DIR is set, every request is recorded with pcov (see coverage_prepend.php)
if [ -n "$PHP_COVERAGE_DIR" ]
then
    SRC="$(cd "$(dirname "$0")/../../src/server" && pwd -P)"
    PREPEND="$(cd "$(dirname "$0")" && pwd -P)/coverage_prepend.php"
    cd $1 && php -d auto_prepend_file="$PREPEND" -d pcov.enabled=1 -d pcov.directory="$SRC" -S 127.0.0.1:$2 &
else
    cd $1 && php -S 127.0.0.1:$2 &
fi
