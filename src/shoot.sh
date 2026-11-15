#!/bin/zsh
# usage: shoot.sh name "query" ; waits for completion
SP=/private/tmp/claude-501/-Users-soiluong-Development-personal-coral-reef/76f7ee8d-a259-4ce2-8f93-2e90624e1c51/scratchpad/out
cd ${0:a:h} && bun build.mjs >/dev/null || exit 1
: > $SP/log.txt
open -g -a Safari "http://localhost:8787/?dev&name=$1&$2"
for i in {1..60}; do grep -q "shots done $1" $SP/log.txt && break; sleep 0.5; done
grep -v "^BIG\|^$" $SP/log.txt | head -30
