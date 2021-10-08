#!/bin/sh
if ! command -v ps > /dev/null 2>&1
then
    echo "ps not found, server kill skipped"
    exit
fi
kill -9 $(ps ax | grep php | fgrep -v grep | awk '{ print $1 }') > /dev/null 2>&1