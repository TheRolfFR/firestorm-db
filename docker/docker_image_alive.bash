#!/bin/bash

echo "Checking if docker image is alive..."

# Send a request with no body and capture the response
RESPONSE=$(curl -s http://localhost:8000)
EXPECTED_RESPONSE='{"error":"No JSON body provided"}'

if [[ "$RESPONSE" == "$EXPECTED_RESPONSE" ]]; then
	echo "Docker image is alive!"
	exit 0
else
	echo "Docker image is not alive!"
	echo "Expected: $EXPECTED_RESPONSE"
	echo "Received: $RESPONSE"
	docker logs firestorm-db-php
	exit 1
fi