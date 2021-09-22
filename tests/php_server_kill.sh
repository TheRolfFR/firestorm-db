#!/bin/sh
if ! command -v pkill &> /dev/null
then
    echo "pkill not found, server kill skipped"
    exit
fi
pkill -e php