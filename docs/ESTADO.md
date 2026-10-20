# Estado do projeto (ponto de parada)

**Atualizado em:** 2026-10-20

## No ar

- Dashboard **Operações · Infraestrutura** em <http://grafana.lan/d/ops-infraestrutura>
  (uid `ops-infraestrutura`, Grafana 13.0.2 da VM 100), aprovado pelo dono.
- PRDs 001, 002 e 003 implementados. O PRD 004 (agentes nas VMs/LXCs) é rascunho.
- Plugins fixados no compose da VM 100: `volkovlabs-echarts-panel 7.2.5`,
  `marcusolsson-dynamictext-panel 6.3.0`.
- Zabbix: `grafana-ro` (grupo de usuários "Grafana Read-Only", id 14) lê
  Linux servers, Zabbix servers, Hypervisors, Aplicações/Sistema de Metas,
  SecOps Lab e Rede/WAN.
- Hosts de ping: `wan-gateway` 10688, `wan-cloudflare` 10689, `wan-google` 10690
  (grupo Rede/WAN id 25, template ICMP Ping).

## Mapa de hosts do painel

| Chave (`HOSTS`) | Host Zabbix (nome visível) | hostid |
|---|---|---|
| `pve` | Proxmox luis (HP ZBook 17 G5) | 10685 |
| `vm100` | Ubuntu Server (Docker Host) | 10683 |
| `vm130` | SRV130 - Sistema de Metas | 10687 |
| `secops` | secops-lab | 10686 |
| `gw` / `cf` / `gg` | WAN - Gateway / Cloudflare 1.1.1.1 / Google 8.8.8.8 | 10688 / 10689 / 10690 |

## Próximos passos

1. PRD 004: agente Zabbix nas VMs 101/104/105/107 e nos LXCs 102/109.
2. Revisar tokens de API do Admin no Zabbix (`mcp-iops`, `secops-lab`,
   `setup-apm` e o token temporário usado no PRD 003).

## Comandos

```bash
cd ~/dashboard-operacoes
scripts/publicar.sh "mensagem"                       # gera, testa e importa
python3 scripts/gerar-fixture.py                     # atualiza a fixture do harness
LD_LIBRARY_PATH=~/wazuh/.libs/root/usr/lib/x86_64-linux-gnu \
  ~/wazuh/.venv-shot/bin/python scripts/testar-navegador.py /tmp/ops-prints
```

## Histórico

| Data | O quê |
|---|---|
| 2026-10-19 | Plugins instalados; v1 com ECharts; permissão do `grafana-ro`; consultas 24 h/30 d |
| 2026-10-19 | Mapa refeito em SVG no padrão do vídeo; modais com abas |
| 2026-10-20 | WAN por ICMP; projeto movido para este repositório e documentado |
