#!/bin/bash

docker image rm firestorm-db-image &>/dev/null
docker build -t firestorm-db-image .
