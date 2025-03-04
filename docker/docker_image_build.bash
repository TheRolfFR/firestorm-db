#!/bin/bash

docker image rm firestorm-db-php &>/dev/null
docker build -t firestorm-db-php .
