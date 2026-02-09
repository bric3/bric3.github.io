#!/bin/sh

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


rm -rf .asciidoctor/ public/
# slow but use the same build as used on Github Actions
exec docker run --rm --volume $PWD:/src --publish "0.0.0.0:1313:1313" bric3/hugo-builder hugo serve --bind=0.0.0.0 --baseUrl=blog.local --buildDrafts --destination ./public

#exec hugo serve --verbose --baseUrl=blog.local --bind=0.0.0.0 --buildDrafts --buildFuture --destination ./resources/_gen/diagram
#exec hugo serve --verbose --baseUrl=blog.local --bind=0.0.0.0 --buildDrafts --buildFuture --destination ./public
