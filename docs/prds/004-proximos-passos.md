---
prd_number: "004"
status: rascunho
priority: baixa
created: 2026-10-20
depends_on: ["001", "002", "003"]
---

# PRD 004: Cobertura completa (agentes nas VMs e LXCs)

## 1. Contexto

Hoje o painel mostra CPU e RAM só das VMs 100 e 130 (as únicas com agente
Zabbix). As VMs 101, 104, 105 e 107 aparecem apenas com tráfego (pela tap no
Proxmox), e os LXCs 102 (Ollama) e 109 (DNS) aparecem como "sem coleta",
porque o template do Proxmox não descobre interfaces `veth`.

## 2. Proposta

1. **Zabbix agent 2** nas VMs 101, 104, 105 e 107 e nos LXCs 102 e 109, com o
   template "Linux by Zabbix agent", num grupo que o `grafana-ro` já lê (ou
   num grupo novo com leitura).
2. No gerador: `zbx` e `agente: True` para esses nós; queries novas por grupo.
3. No mapa: LXCs deixam de ser "sem coleta"; cartões das LXCs com tráfego da
   `eth0` do próprio contêiner.
4. Modal Virtualização: CPU e RAM em todos os cards de VM.

## 3. Cuidados

- **LXC 102 (Ollama):** o dono usa no dia a dia; instalar o agente só com
  autorização explícita e sem reiniciar o serviço.
- **LXC 109 (DNS):** ponto único de falha da rede da casa; mudança rápida e
  testada, fora de horário de uso.
- **VM 105 (Wazuh):** checar consumo de RAM antes.

## 4. Também pendente

- Revisar tokens de API antigos do Admin no Zabbix (`mcp-iops`, `secops-lab`,
  `setup-apm`) e o token temporário usado no PRD 003.
