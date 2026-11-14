#!/usr/bin/env bash
# Commit one machine's source, push dfl/bonepede, copy its built film page into the Pages repo, push gh-pages.
# Usage: tools/publish.sh <name> "<commit message>"   (name: the sims/<name>-film entry; build it first)
set -e
NAME="$1"; MSG="$2"
cd "$(dirname "$0")/.."
git add "sims/$NAME-shared" "sims/$NAME-film" tools
git commit -q -m "$MSG

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin dfl/bonepede
cp "teardown-out/dist/$NAME-film.html" ../teardown-pages/
cd ../teardown-pages
git add "$NAME-film.html"
git commit -q -m "$NAME film

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin gh-pages
echo "live: https://deep-forest-labs.github.io/teardown/$NAME-film.html"
