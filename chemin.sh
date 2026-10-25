#!/bin/sh
cd "$(dirname "$0")" && exec node .claude/chemin.mjs --hote 0.0.0.0 --sans-navigateur "$@"
