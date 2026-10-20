#!/usr/bin/env bash
# Gera o JSON e importa o dashboard no Grafana da VM 100.
# A senha de admin do Grafana não sai da VM: o import roda dentro do container,
# usando as variáveis de ambiente do próprio container.
# Uso: scripts/publicar.sh ["mensagem da versão"]
set -euo pipefail
cd "$(dirname "$0")/.."
VM=luis@192.168.1.200
CHAVE=~/.ssh/mcp_docker_vmstack
MSG=${1:-"publicado por scripts/publicar.sh"}

python3 gerar-dashboard.py
node tests/harness.js operacoes-infraestrutura.json tests/fixtures/frames.json

python3 - "$MSG" > /tmp/ops-import.json <<'PY'
import json, sys
d = json.load(open("operacoes-infraestrutura.json"))
print(json.dumps({"dashboard": d, "overwrite": True, "folderUid": "", "message": sys.argv[1]}, ensure_ascii=False))
PY

scp -q -i "$CHAVE" /tmp/ops-import.json "$VM":/tmp/ops-import.json
scp -q -i "$CHAVE" operacoes-infraestrutura.json "$VM":projetos/monitoramento/grafana/dashboards/
ssh -i "$CHAVE" "$VM" '
  docker cp /tmp/ops-import.json grafana:/tmp/ops-import.json >/dev/null &&
  docker exec grafana sh -c "curl -s -X POST -H \"Content-Type: application/json\" -u \"\$GF_SECURITY_ADMIN_USER:\$GF_SECURITY_ADMIN_PASSWORD\" --data @/tmp/ops-import.json http://127.0.0.1:3000/api/dashboards/db";
  echo;
  docker exec -u root grafana rm -f /tmp/ops-import.json; rm -f /tmp/ops-import.json'
rm -f /tmp/ops-import.json
