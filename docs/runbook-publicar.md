# Runbook: editar, publicar e validar o dashboard

## Pré-requisitos (WSL)

| O quê | Onde |
|---|---|
| Chave SSH da VM 100 | `~/.ssh/mcp_docker_vmstack` (usuário `luis`) |
| Token somente leitura do Zabbix (fixture) | `~/.config/zabbix-mcp/mcp.token` |
| Node.js (harness) | `node` ≥ 18 |
| Playwright + Chromium (teste visual) | `~/wazuh/.venv-shot` e libs em `~/wazuh/.libs` |
| Token Viewer do Grafana (teste visual) | `GRAFANA_VIEWER_TOKEN` em `~/wazuh/credenciais.env` |

## Fluxo

1. Edite `src/*.js`, `src/estilos.css` ou `gerar-dashboard.py`.
2. (Opcional) Atualize a fixture com dados reais: `python3 scripts/gerar-fixture.py`.
3. Publique: `scripts/publicar.sh "o que mudou"`. O script:
   - gera `operacoes-infraestrutura.json`;
   - roda `tests/harness.js` (para se algum painel lançar exceção);
   - copia o JSON para `~/projetos/monitoramento/grafana/dashboards/` na VM 100;
   - importa via `POST /api/dashboards/db` **de dentro do container** `grafana`,
     usando `GF_SECURITY_ADMIN_USER/PASSWORD` do próprio container.
   A resposta esperada termina com `"status":"success", ... "version":N`.
4. Valide no navegador:
   ```bash
   LD_LIBRARY_PATH=~/wazuh/.libs/root/usr/lib/x86_64-linux-gnu \
     ~/wazuh/.venv-shot/bin/python scripts/testar-navegador.py /tmp/ops-prints
   ```
   Saem 7 prints (visão geral, caminho, containers, modais). O script falha se
   houver erro de console.
5. Commit e push.

## Adicionar uma VM ao mapa

1. `gerar-dashboard.py` → lista `VMS`: id, nome, IP, interface `tapNNNi0`,
   host Zabbix (se tiver agente), links e descrição.
2. `src/mapa.js` → posicione o nó em `DEV`/`VM_ESQ` (coluna esquerda) ou crie
   um enlace em `ENL` com o cartão (`cartao(x, y, 'vmbr0', tap, nome, 'net0', ...)`).
3. Se a VM tiver agente, inclua o host em `HOSTS` e uma query em `ALVOS_MAPA`
   com o **grupo exato** (o plugin Zabbix não resolve `/.*/` no filtro de grupo).

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| Nó/card "SEM DADOS" e query volta 0 frames | `grafana-ro` sem leitura no grupo | Dar Read no grupo de usuários "Grafana Read-Only" e `docker compose restart grafana` |
| Valor "—" em item que existe no Zabbix | O item descarta valores repetidos e não gravou na janela | Consultar com janela maior (`timeFrom`) ou usar o cache entre painéis |
| Painel com "ECharts Execution Error" | Exceção no `src/mapa.js` | Rodar o harness; ver `window.__opsDebug` no console do navegador |
| Problemas não aparecem no harness/curl | A query de problemas (queryType 5) só roda no navegador | Validar com `scripts/testar-navegador.py` |
| Cliques bloqueados no teste | Aviso "Grafana Assistant is now available" | O script fecha o diálogo; feche à mão na UI |
| Taps com operstate 0 | Normal em tun/tap ("unknown") | O status usa tráfego recente, não `operstate == up` |
