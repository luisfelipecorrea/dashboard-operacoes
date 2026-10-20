---
prd_number: "002"
status: implementado
priority: media
created: 2026-10-19
implemented: 2026-10-19
depends_on: ["001"]
---

# PRD 002: Mapa HTML5/SVG e modais com abas no padrão do vídeo de referência

## 1. Contexto

O dono enviou um vídeo (LinkedIn, 1min50s) do painel de referência em uso e
pediu o dashboard "exatamente como este". O vídeo mostrou recursos que o
print não mostrava. Os quadros foram extraídos com o ffmpeg estático do
pacote `imageio-ffmpeg` (via `uvx`) para estudo.

O que o vídeo mostra:

- **Mapa em HTML5** com câmera: ao escolher um caminho, o zoom anima até ele
  e o resto esmaece; arrastar/rolar dá pan e zoom.
- **Cartões de enlace** entre equipamentos (origem/porta → destino/porta,
  TX/RX).
- **Clusters** desenhados como áreas (VLT, Firewall com caixa de HA,
  "Virtualização e Storage") e **nós largos** de recurso com "ABRIR DETALHES".
- **Itens expansíveis** ("7 APs ◂" abre uma lista lateral).
- **Seletor agrupado** + segundo seletor de rota + **trilha** do caminho.
- **Modal grande com abas**, blocos de KPI, seções com grades de cards,
  barras e alerta vermelho (reserva N+1).

## 2. Solução

Mantendo o Business Charts como hospedeiro (exigência da referência), a cena
passou a ser **SVG desenhado pelo JS** (`src/mapa.js`), com a topologia do
homelab no lugar da rede corporativa do vídeo:

| No vídeo | No homelab |
|---|---|
| Links de internet → SW-WAN | Internet → roteador (ICMP, PRD 003) |
| Cartões SW-WAN ↔ SW-CORE | Cartões roteador ↔ Proxmox por `nic0` (verde) e Wi-Fi (azul) |
| Cluster VLT + caixa VLTi | Área "Hipervisor · Proxmox VE" + caixa da bridge `vmbr0` |
| Switches de acesso com cartões | VMs 100/101/104/107/130 com cartões `vmbr0 tapNNNi0 → VM net0` |
| Cluster Firewall + caixa HA | "Cluster Segurança" (VM 105 Wazuh, VM 106 SecOps) + caixa SOC |
| Fabric + CHASSI/STORAGE | Área de serviços: LXCs 102/109 + nós largos Proxmox e NVMe |
| "7 APs ◂" | "4 containers ◂" da VM 130 (estado, CPU, RAM, rede de cada container) |
| Core(s) / Cluster firewall | Seletor de uplink: cabo `nic0` ou Wi-Fi `wlp0s20f3` |
| Abas Virtualização / Storage / Banco | Abas Virtualização · PROXMOX / Storage · NVMe / Aplicações / Segurança |

### Decisões-chave

1. **`render()` independente da consulta.** Seleção, uplink, expansão e
   "menos detalhes" redesenham na hora, sem esperar o refresh.
2. **Câmera por `viewBox`** com animação (easing cúbico) e enquadramento pelo
   bbox dos elementos do caminho.
3. **Cache de métricas entre painéis** para os modais abertos pelo mapa verem
   valores de 24 h/30 dias.
4. **Colunas laterais** no padrão do vídeo (cards de link com latência/perda;
   cards com ícone, número grande e "ABRIR DETALHES"), cabendo em 1080p.

## 3. Critérios de aceite

- [x] Visão geral com cartões, clusters, nós de recurso e trilha.
- [x] Caminho com câmera animada; containers expansíveis; modal com 4 abas.
- [x] Teste automatizado (`scripts/testar-navegador.py`) sem erros de console.
