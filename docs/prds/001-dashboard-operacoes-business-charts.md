---
prd_number: "001"
status: implementado
priority: media
created: 2026-10-19
implemented: 2026-10-19
depends_on: []
references: ["zabbix-mcp/001", "zabbix-mcp/002"]
---

# PRD 001: Dashboard de operações com Business Charts + Business Text

## 1. Contexto

- **Referência:** um print e uma nota (`C:\Users\Luis\Documents\Exemplo`) de um
  painel "Operações · Infraestrutura" feito com os plugins **Business Charts**
  (JavaScript/ECharts) e **Business Text** (HTML/Handlebars) da Volkov Labs:
  colunas de conectividade e infraestrutura, mapa no centro, modal de detalhes
  e faixa de alertas.
- **Estado anterior:** o Grafana da VM 100 tinha dashboards por host (VM 100,
  Wazuh, SecOps), sem uma visão única de operação. Os plugins da Volkov Labs
  não estavam instalados.
- **Problema:** para saber se "está tudo bem" era preciso abrir vários
  dashboards e o Zabbix.

## 2. Solução

Um dashboard único, adaptado à estrutura real do homelab (Proxmox, bridge
`vmbr0`, VMs e LXCs), com dados do Zabbix:

| Painel | Conteúdo |
|---|---|
| Cabeçalho | Status de triggers (clique abre a lista), título, controles do mapa |
| Conectividade | Interfaces físicas do Proxmox e tráfego de cada VM pela sua `tap` |
| Mapa | Topologia com status por cor e tráfego animado |
| Infraestrutura | VMs em execução, memória, disco NVMe, temperaturas, Sistema de Metas |
| SecOps | Findings do último scan |
| Alertas | Triggers ativos rolando |

### Decisões-chave

1. **Plugins com versão fixa** no `GF_INSTALL_PLUGINS` (Business Charts 7.2.5,
   Business Text 6.3.0, ambos exigem Grafana ≥ 12.3), com backup antes
   (`backups/20261020-015600`, `docker-compose.yml.bak-pre-business`).
2. **Gerador Python + código em arquivos.** O JS/CSS fica em `src/`; o JSON
   é gerado. A lib comum (`src/lib.js`) é injetada em cada painel.
3. **Uma consulta compartilhada.** O mapa consulta o Zabbix; os painéis leves
   usam o datasource "Dashboard". Exceções: Infraestrutura (24 h) e SecOps
   (30 dias), porque seus itens gravam raramente.
4. **Import sem expor senha:** `docker exec grafana curl -u $GF_SECURITY_ADMIN_USER:...`.

## 3. Achados durante a implementação

| Achado | Tratamento |
|---|---|
| `grafana-ro` só lia "Linux servers"; Proxmox, VM 130 e secops-lab voltavam vazios, sem erro | Leitura em Hypervisors, Aplicações/Sistema de Metas e SecOps Lab (grupo de usuários id 14) + restart do Grafana (cache do plugin) |
| No navegador o plugin entrega frames "wide" (um campo de tempo + N campos numéricos), diferente do `/api/ds/query` | `lib.js` percorre todos os campos numéricos; host e chave vêm de `labels` |
| Taps do Proxmox ficam com operstate 0 ("unknown") com a VM ligada | Status da VM por tráfego recente |
| Query de Problemas (queryType 5) só roda no navegador | Validação com Playwright |
| "Number of CPUs" e "Expires on" descartam repetidos e não aparecem em 1 h | Coluna Infraestrutura com `timeFrom: 24h` |
| Itens do secops-lab são trapper (último envio em 30/09) | Card SecOps em painel próprio com `timeFrom: 30d` |

## 4. Critérios de aceite

- [x] Dashboard no ar com dados de Proxmox, VM 100, VM 130 e secops-lab.
- [x] Clique em nó destaca o caminho; modal com métricas e links.
- [x] Sem erros de console (Playwright) e cabendo em 1080p.
- [x] Documentado (README da stack, pegadinhas 19 a 22 no `zabbix-mcp`).
