#!/usr/bin/env bash
set -Eeuo pipefail

key=/data/replica-key/keyfile
if [ ! -s "$key" ]; then
  if [ -e /data/db/WiredTiger ]; then
    echo 'No se encontró la clave de una réplica existente; restaure su volumen de claves.' >&2
    exit 1
  fi
  umask 077
  head -c 756 /dev/urandom | base64 | tr -d '\n' > "${key}.tmp"
  mv "${key}.tmp" "$key"
fi
chown mongodb:mongodb "$key"
chmod 400 "$key"
exec /usr/local/bin/docker-entrypoint.sh "$@"
