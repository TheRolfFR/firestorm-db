#!/bin/sh
if [ $# -eq 2 ] 
then
    ip=127.0.0.1
    port=$2
else
    ip=$2
    port=$3
fi
cd $1 && php -S $ip:$port &