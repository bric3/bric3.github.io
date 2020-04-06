#!/bin/sh

echo "Outdated for now, please use `hugo serve` instead"
exit 1

exec docker run --name blog --tty --rm --volume "$PWD":/usr/src/app:delegated --volume site:/usr/src/app/_site --publish "4000:4000" starefossen/github-pages jekyll serve -d /_site --watch --future --incremental --force_polling -H 0.0.0.0 -P 4000
