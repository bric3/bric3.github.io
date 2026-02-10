#!/bin/sh

# Parse arguments
USE_LOCAL=false
if [ "$1" = "--local" ] || [ "$1" = "-l" ]; then
  USE_LOCAL=true
fi

if ! grep -E "127.0.0.1.*blog.local" /etc/hosts 2>&1 >/dev/null; then
  >&2 echo "add to /etc/hosts
  127.0.0.1 blog.local"
  exit 1
fi

if ! curl -s --unix-socket /var/run/docker.sock http/_ping 2>&1 >/dev/null && \
   ! curl -s --unix-socket "$HOME/.orbstack/run/docker.sock" http/_ping 2>&1 >/dev/null; then
  >&2 echo "Docker not running"
  exit 1
fi

# Build local image if requested
if [ "$USE_LOCAL" = true ]; then
  ARCH=$(uname -m)
  echo "Building local Docker image from builder/Dockerfile for architecture: $ARCH..."
  docker build -t bric3/hugo-builder:local builder/ || exit 1
  echo "Local Docker image built successfully."
  IMAGE_TAG="bric3/hugo-builder:local"
else
  IMAGE_TAG="bric3/hugo-builder"
fi

rm -rf .asciidoctor/ public/
# slow but use the same build as used on Github Actions
exec docker run --rm --volume $PWD:/src --publish "0.0.0.0:1313:1313" "$IMAGE_TAG" hugo serve --bind=0.0.0.0 --baseURL=blog.local --buildDrafts --destination ./public

#exec hugo serve --verbose --baseURL=blog.local --bind=0.0.0.0 --buildDrafts --buildFuture --destination ./resources/_gen/diagram
#exec hugo serve --verbose --baseURL=blog.local --bind=0.0.0.0 --buildDrafts --buildFuture --destination ./public
