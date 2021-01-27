#!/bin/sh

# slow but use the same build as used on Github Actions
#exec docker run --rm --volume $PWD:/src --publish "0.0.0.0:1313:1313" bric3/hugo-builder hugo serve --bind=0.0.0.0 --baseUrl=blog.local --buildDrafts --destination ./public

exec env PATH=$PWD/bin:$PATH hugo serve --verbose --baseUrl=blog.local --bind=0.0.0.0 --buildDrafts --buildFuture --destination ./resources/_gen/diagram
rm -rf .asciidoctor/ public/
#exec hugo serve --verbose --baseUrl=blog.local --bind=0.0.0.0 --buildDrafts --buildFuture --destination ./public
