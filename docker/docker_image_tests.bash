#!/bin/bash

# constants
BASE_PORT=8000
INCREMENT=1
IMAGE_NAME="firestorm-db"
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
cp tests/files/*.json $temp_dir

echo -n "Finding free port for docker HTTP port..."
port=$BASE_PORT
while lsof -i :$port &>/dev/null || (command -v netstat &>/dev/null && netstat -taln 2>/dev/null | grep -q ":$port "); do
    port=$((port + INCREMENT))
done
echo " [:$port]"

echo "Starting docker container..."
# execute the container as the current user to avoid permission issues
# & mount the test files and the config file
# & expose the container port to the host machine so we can test it
docker_container_id=$(docker run -d \
    --user "$(id -u):$(id -g)" \
    -v "$(pwd)/tests/php/config.php:/var/www/html/config.php" \
    -v "$(pwd)/tests/php/tokens.php:/var/www/html/tokens.php" \
    -v "$temp_dir/:/var/www/html/files" \
    -p $port:80 $IMAGE_NAME:$IMAGE_TAG \
)

echo "Waiting for docker container to be ready..."
for i in {1..50}; do
    if curl -s "http://127.0.0.1:$port" &>/dev/null; then
        break
    fi
    sleep 0.1
done

echo "Running tests..."
env PORT=$port $npm_runner run ts:tests

e=$?

echo "Cleaning after me..."
docker stop $docker_container_id &>/dev/null
docker rm $docker_container_id &>/dev/null
rm -rf $temp_dir

echo "done"
exit $e
