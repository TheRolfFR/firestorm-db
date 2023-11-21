#!/bin/bash

# constants
BASE_PORT=8000
INCREMENT=1
IMAGE_NAME="firestorm-db-image"
IMAGE_TAG="latest"

npm_runner=""
if command -v pnpm &> /dev/null; then
    npm_runner="pnpm"
elif command -v npm &> /dev/null; then
    npm_runner="npm"
fi

temp_dir=/tmp/php-$(echo $RANDOM)
echo "Creating $temp_dir temp file folder..."
mkdir -p $temp_dir
rm -rf $temp_dir/*

echo "Copying db test files to temp file folder..."
cp tests/*.json $temp_dir
# match group write to the files with writing authorized to the test group
chgrp www-data $temp_dir/*.json
chmod g+w $temp_dir/*.json

echo -n "Finding free port for docker HTTP port..."
port=$BASE_PORT
is_free=$(netstat -taln | grep $port)
while [[ -n "$is_free" ]]; do
    port=$[port+INCREMENT]
    is_free=$(netstat -taln | grep $port)
done
echo " [:$port]"

echo "Starting docker container..."
docker_container_id=$(docker run -d \
    -v ./tests/config.php:/var/www/html/config.php \
    -v ./tests/tokens.php:/var/www/html/tokens.php \
    -v $temp_dir/:/var/www/html/files \
    -p $port:80 $IMAGE_NAME:$IMAGE_TAG \
)

echo "Running tests..."
$npm_runner run test -- --port $port

e=$?

echo "Cleaning after me..."
docker stop $docker_container_id &>/dev/null
docker rm $docker_container_id &>/dev/null
rm -rf $temp_dir

echo "done"
exit $e
