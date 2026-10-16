#!/usr/bin/env bash
# One-command deploy on the VPS that runs n8n:  bash scripts/deploy.sh
# Pulls the latest code, joins n8n's Docker network, builds and (re)starts reel-engine.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { sed -E 's/[[:space:]]+#.*$//' .env.example > .env; echo "Created .env from .env.example - fill in the keys, then re-run."; exit 1; }
grep -qE '^SERVICE_TOKEN=.+' .env || { sed -i "s|^SERVICE_TOKEN=.*|SERVICE_TOKEN=$(openssl rand -hex 24)|" .env; echo "Generated SERVICE_TOKEN in .env"; }
for k in OPENROUTER_API_KEY PIXABAY_API_KEY SUPABASE_SERVICE_KEY; do
  grep -qE "^$k=[^ #]+" .env && ! grep -qE "^$k=.*\.\.\.$" .env || { echo "Missing $k in .env"; exit 1; }
done

# Find the Docker network the n8n container is on, so n8n can call http://reel-engine:8080
if ! grep -qE '^N8N_NETWORK=.+' .env; then
  n8n=$(docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower($2) ~ /n8n/ {print $1; exit}')
  [ -n "$n8n" ] || { echo "No running n8n container found; set N8N_NETWORK in .env"; exit 1; }
  net=$(docker inspect "$n8n" -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
  echo "N8N_NETWORK=$net" >> .env
  echo "n8n container '$n8n' is on network '$net'"
fi

git pull --ff-only || true
docker compose up -d --build
echo "Waiting for health check..."
for i in $(seq 1 30); do
  if docker exec reel-engine curl -fs http://localhost:8080/health >/dev/null 2>&1; then
    echo "reel-engine is up."
    echo "n8n bearer token (Reel Engine Token credential): $(grep '^SERVICE_TOKEN=' .env | cut -d= -f2)"
    exit 0
  fi
  sleep 3
done
echo "reel-engine did not become healthy; recent logs:"; docker logs --tail 50 reel-engine; exit 1
