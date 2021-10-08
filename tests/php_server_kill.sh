#!/bin/sh
if ! command -v killall > /dev/null 2>&1
then
    echo "killall not found, server kill skipped"
    exit
fi
killall php > /dev/null 2>&1