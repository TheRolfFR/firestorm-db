#!/bin/bash

# constants
BASE_PORT=8000
INCREMENT=1
IMAGE_NAME="firestorm-db-php"
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
    # execute the container as the current user to avoid permission issues
    --user "$(id -u):$(id -g)" \
    # mount the test files and the config file
    -v ./tests/config.php:/var/www/html/config.php \
    -v ./tests/tokens.php:/var/www/html/tokens.php \
    -v $temp_dir/:/var/www/html/files \
    # expose the container port to the host machine so we can test it
    -p $port:80 $IMAGE_NAME:$IMAGE_TAG \
)

echo "Running tests..."
env PORT=$port $npm_runner run test

e=$?

echo "Cleaning after me..."
docker stop $docker_container_id &>/dev/null
docker rm $docker_container_id &>/dev/null
rm -rf $temp_dir

echo "done"
exit $e
