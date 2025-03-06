#!/bin/bash

docker image rm firestorm-db &>/dev/null
docker build --tag firestorm-db:latest --file dockerfile .
