#!/bin/sh
set -eu
image=${1:-idea-sonar-web:test}
container="idea-sonar-smoke-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
# Porta livre atribuída pelo Docker; nenhum serviço backend necessário.
docker run -d --name "$container" --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges -p 127.0.0.1::8080 "$image" >/dev/null
port=$(docker port "$container" 8080/tcp | sed 's/.*://')
base="http://127.0.0.1:$port"
i=0
until curl -fsS "$base/" >/dev/null 2>&1; do
  i=$((i+1))
  if [ "$i" -ge 30 ]; then docker logs "$container"; exit 1; fi
  sleep .2
done
for route in / /map /callback /imports/example /edit/nodes/example /history/nodes/example; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$base$route")
  test "$code" = 200
  echo "OK 200 $route"
done
for route in /assets/missing.js /missing.css /unknown /map/missing.js; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$base$route")
  test "$code" = 404
  echo "OK 404 $route"
done
for route in / /map /index.html; do
  headers=$(curl -sI "$base$route")
  echo "$headers" | grep -qi '^x-content-type-options: nosniff'
  echo "$headers" | grep -qi '^referrer-policy: no-referrer'
  echo "OK headers de segurança $route"
done
test "$(docker exec "$container" id -u)" != 0
echo 'OK runtime não root, sem backend, filesystem read-only'
