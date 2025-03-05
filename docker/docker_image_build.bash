#!/bin/bash

docker image rm firestorm-db-php &>/dev/null
docker build --tag firestorm-db-php:latest --file dockerfile .
