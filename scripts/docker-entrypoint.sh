#!/bin/sh
set -eu

node scripts/write-runtime-config.cjs
exec node dist/Beatovic/server/server.mjs
