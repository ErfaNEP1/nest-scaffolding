#!/bin/sh
# Picks the process to run from the first argument: api (default) or worker.
# `exec` replaces the shell, so Node receives SIGTERM directly and shuts down gracefully.
set -e
case "${1:-api}" in
  api) exec node --import ./dist/instrumentation.js dist/main.js ;;
  worker) exec node --import ./dist/instrumentation.js dist/worker.js ;;
  *) exec "$@" ;;
esac
