---
prd_number: "003"
status: implementado
priority: media
created: 2026-10-19
implemented: 2026-10-20
depends_on: ["001"]
---

# PRD 003: Latência e perda da WAN por ICMP

## 1. Contexto

Os cards de link da referência mostram **latência** e **perda**. O homelab não
media a WAN: os nós Internet e Roteador apareciam como "sem coleta".

## 2. Solução

Medir por ICMP a partir do próprio Zabbix server (o container já traz o
`fping` com setuid), com o template oficial **ICMP Ping** (id 10564):

| Host | Endereço | Para quê |
|---|---|---|
| `wan-gateway` (10688) | 192.168.1.254 | Latência/perda do uplink `nic0` e status do nó Roteador |
| `wan-cloudflare` (10689) | 1.1.1.1 | Card "Link internet · WAN" e status do nó Internet |
| `wan-google` (10690) | 8.8.8.8 | Segunda referência de latência no card WAN |

- Grupo novo **Rede/WAN** (id 25), tag `rede=wan`, interface com o IP do alvo.
- Itens do template: `icmpping`, `icmppingloss`, `icmppingsec` a cada 1 min.
- Triggers do template: sem resposta (Alta), perda > `{$ICMP_LOSS_WARN}` 20% e
  latência > `{$ICMP_RESPONSE_TIME_WARN}` 150 ms (Atenção).
- `grafana-ro` com leitura em Rede/WAN; Grafana reiniciado (cache).
- Dashboard: query E (grupo `Rede\/WAN`), chaves `gw`/`cf`/`gg` em `HOSTS`,
  card "Link internet · WAN" no lugar do card Wi-Fi (o Wi-Fi segue no mapa e
  no modal) e latência no rótulo dos nós Internet e Roteador.

## 3. Execução

Feito via API com um token temporário do Admin, fornecido pelo dono (o
`mcp-claude` só escreve no grupo do Sistema de Metas). Primeira coleta:
gateway 0,9 ms, Cloudflare 2,4 ms, Google 9,2 ms, 0% de perda.

## 4. Critérios de aceite

- [x] 9 itens coletando nos 3 hosts.
- [x] Card WAN e card `nic0` com latência/perda; nós Internet/Roteador com status real.
- [x] Triggers de WAN aparecem na faixa de alertas quando disparam.
