#!/usr/bin/env bash
set -euo pipefail

# Falla con un mensaje claro si falta el token
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "ERROR: falta la variable de entorno GITHUB_TOKEN en Vercel" >&2
  exit 1
fi

AUTH_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/"

# Cambia cualquier forma de URL de GitHub (HTTPS o SSH) a HTTPS con el token
git config --global url."${AUTH_URL}".insteadOf "https://github.com/"
git config --global --add url."${AUTH_URL}".insteadOf "git@github.com:"
git config --global --add url."${AUTH_URL}".insteadOf "ssh://git@github.com/"

pnpm install