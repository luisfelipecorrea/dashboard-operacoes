#!/usr/bin/env python3
"""Gera o dashboard "Operações · Infraestrutura" (uid ops-infraestrutura).

Visual inspirado no exemplo da Volkov Labs (Business Charts + Business Text),
adaptado ao homelab: topologia Internet → roteador → Proxmox → vmbr0 → VMs/LXCs,
com dados do Zabbix (datasource "Zabbix", usuário grafana-ro).

Uso:
    python3 gerar-dashboard.py            # grava operacoes-infraestrutura.json
    python3 gerar-dashboard.py --stdout   # imprime o JSON

O JS/CSS fica em src/; o gerador injeta lib.js no início de cada painel.
Para publicar: scripts/publicar.sh (ver docs/runbook-publicar.md).
"""
import hashlib
import json
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SRC = AQUI / "src"
SAIDA = AQUI / "operacoes-infraestrutura.json"

ZBX_DS = {"type": "alexanderzobnin-zabbix-datasource", "uid": "cfydvxwb0ri0wb"}
DASH_DS = {"type": "datasource", "uid": "-- Dashboard --"}
MAPA_ID = 3

# Nome visível (o filtro de host do plugin casa com ele), nome técnico, hostid
HOSTS = {
    "pve": {"nome": "Proxmox luis (HP ZBook 17 G5)", "tecnico": "luis", "id": 10685, "agente": True},
    "vm100": {"nome": "Ubuntu Server (Docker Host)", "tecnico": "docker-host", "id": 10683, "agente": True},
    "vm130": {"nome": "SRV130 - Sistema de Metas", "tecnico": "srv130-metas", "id": 10687, "agente": True},
    "secops": {"nome": "secops-lab", "tecnico": "secops-lab", "id": 10686, "agente": False},
    # Pings ICMP feitos pelo Zabbix server (template "ICMP Ping"), grupo Rede/WAN
    "gw": {"nome": "WAN - Gateway (roteador)", "tecnico": "wan-gateway", "id": 10688, "agente": False},
    "cf": {"nome": "WAN - Cloudflare 1.1.1.1", "tecnico": "wan-cloudflare", "id": 10689, "agente": False},
    "gg": {"nome": "WAN - Google 8.8.8.8", "tecnico": "wan-google", "id": 10690, "agente": False},
}

# Coordenadas em % da área do mapa (y cresce para baixo). "rota" = polilinha do enlace pai -> nó.
TRONCO_Y, VM_Y = 69, 84
VMS = [
    # id, nome, ip, interface tap (None = LXC sem coleta), zbx, links extras, descrição
    ("vm100", "VM 100 · zabbixgrafana", "192.168.1.200", "tap100i0", "vm100",
     [["http://grafana.lan", "Grafana"], ["http://zabbix.lan", "Zabbix"], ["http://kuma.lan", "Uptime Kuma"],
      ["/d/docker-host-vm-styled", "Dashboard da VM"]],
     "Stack Docker de observabilidade: Zabbix 8, Grafana, Uptime Kuma, SysPass, ClickHouse e OTel."),
    ("vm101", "VM 101 · aiops", "192.168.1.201", "tap101i0", None, [], "VM de automação/IA (agente Wazuh 001)."),
    ("vm104", "VM 104 · tradutor", "192.168.1.204", "tap104i0", None, [["http://tradutor.lan", "LibreTranslate"]],
     "LibreTranslate, PDFMathTranslate e Kokoro TTS, usando o Ollama do LXC 102."),
    ("vm105", "VM 105 · wazuh", "192.168.1.205", "tap105i0", None,
     [["http://wazuh.lan", "Wazuh"], ["/d/wazuh-visao-geral", "Dashboard Wazuh"]], "Wazuh all-in-one (SIEM/XDR)."),
    ("vm106", "VM 106 · secops", "192.168.1.206", "tap106i0", "secops",
     [["/d/secops-superficie-risco", "Dashboard SecOps"]], "Laboratório de scan (Nmap, Nuclei, Greenbone)."),
    ("vm107", "VM 107 · garimpo", "192.168.1.207", "tap107i0", None, [["http://garimpo.lan", "Garimpo OLX"]],
     "Radar de ofertas da OLX (Playwright + Ollama)."),
    ("vm130", "VM 130 · metas", "192.168.1.130", "tap130i0", "vm130", [],
     "Sistema de Metas restaurado de produção (nginx + php + mariadb) com APM OpenTelemetry."),
    ("lxc102", "LXC 102 · ollama", "192.168.1.202", None, None, [["http://ollama.lan", "Ollama"]],
     "Ollama em CPU. Interfaces veth de LXC não são coletadas pelo template do Proxmox."),
    ("lxc109", "LXC 109 · dns", "192.168.1.209", None, None, [["http://dns.lan", "AdGuard Home"]],
     "AdGuard Home + Caddy (nomes *.lan). Interfaces veth de LXC não são coletadas."),
]


def montar_nos():
    nos = [
        {"id": "internet", "nome": "INTERNET", "ip": "WAN", "tipo": "internet", "tipoTexto": "Internet", "x": 50, "y": 4,
         "pai": None, "rotulo": "right", "zbx": "cf", "ping": "cf", "ping2": "gg",
         "descricao": "Saída para a internet medida por ICMP a partir do Zabbix server (1.1.1.1 e 8.8.8.8)."},
        {"id": "roteador", "nome": "ROTEADOR", "ip": "192.168.1.254", "tipo": "roteador", "tipoTexto": "Gateway",
         "x": 50, "y": 22, "pai": "internet", "rota": [[50, 4], [50, 22]], "rotulo": "left", "zbx": "gw", "ping": "gw",
         "descricao": "Gateway da LAN, medido por ICMP a partir do Zabbix server; o enlace até o Proxmox é medido pela nic0."},
        {"id": "pc", "nome": "PC WINDOWS", "ip": "192.168.1.3", "tipo": "estacao", "tipoTexto": "Estação",
         "x": 84, "y": 22, "pai": "roteador", "rota": [[50, 22], [84, 22]], "semColeta": True, "rotulo": "bottom",
         "descricao": "Estação de trabalho (agente Wazuh 004). Não monitorada pelo Zabbix."},
        {"id": "pve", "nome": "PROXMOX · luis", "ip": "192.168.1.100", "tipo": "hipervisor", "tipoTexto": "Hipervisor",
         "x": 50, "y": 40, "pai": "roteador", "rota": [[50, 22], [50, 40]], "zbx": "pve", "ifc": "nic0",
         "rotulo": "left", "links": [["http://pve.lan", "Proxmox VE"]],
         "descricao": "HP ZBook 17 G5, Proxmox VE 9. Enlace medido na interface física nic0."},
        {"id": "vmbr0", "nome": "BRIDGE vmbr0", "ip": "192.168.1.0/24", "tipo": "bridge", "tipoTexto": "Bridge Linux",
         "x": 50, "y": 56, "pai": "pve", "rota": [[50, 40], [50, 56]], "ifc": "vmbr0", "operstate": "vmbr0",
         "rotulo": "left", "descricao": "Bridge das VMs e LXCs (192.168.1.0/24)."},
    ]
    passo = 100 / len(VMS)
    for i, (vid, nome, ip, tap, zbx, links, desc) in enumerate(VMS):
        x = round(passo / 2 + i * passo, 2)
        n = {"id": vid, "nome": nome, "ip": ip, "tipo": "vm" if tap else "lxc",
             "tipoTexto": "Máquina virtual" if tap else "Contêiner LXC", "x": x, "y": VM_Y, "pai": "vmbr0",
             "rota": [[50, 56], [50, TRONCO_Y], [x, TRONCO_Y], [x, VM_Y]], "links": links, "descricao": desc}
        if tap:
            n.update({"ifc": tap, "operstate": tap, "desceEhSaida": True})
        else:
            n["semColeta"] = True
        if zbx:
            n["zbx"] = zbx
        nos.append(n)
    # Rótulo do mapa em duas linhas: "VM 100" / "zabbixgrafana"
    for n in nos:
        curto, _, papel = n["nome"].partition(" · ")
        n["curto"], n["papel"] = curto, papel
    return nos


INTERFACES = [
    {"ifc": "nic0", "titulo": "Uplink cabeado", "ping": "gw",
     "nota": "Placa Intel I219 (e1000e) do host. Erros ou queda aqui derrubam toda a rede das VMs."},
    {"ifc": "vmbr0", "titulo": "Bridge vmbr0"},
    {"ifc": "wlp0s20f3", "titulo": "Wi-Fi do host", "nota": "Interface sem fio do notebook; normalmente desconectada."},
]


def zbx_alvo(ref, grupo, host, item):
    return {
        "refId": ref, "datasource": ZBX_DS, "queryType": "0",
        "group": {"filter": grupo}, "host": {"filter": host},
        "application": {"filter": ""}, "itemTag": {"filter": ""}, "item": {"filter": item},
        "functions": [], "options": {"showDisabledItems": False, "skipEmptyValues": False},
    }


ALVOS_MAPA = [
    zbx_alvo("A", "/^Hypervisors$/", "/^Proxmox luis/",
             r"/^(Interface (nic0|vmbr0|wlp0s20f3|tap\d+i0): (Bits (received|sent)|(Inbound|Outbound) packets "
             r"(discarded|with errors)|Operational status|Speed)|CPU utilization|Memory utilization|Total memory|"
             r"Available memory|Free swap space( in %)?|Load average \(1m avg\)|Number of CPUs|System uptime|"
             r"Zabbix agent availability|FS \[\/\]: Space: (Used, in %|Available|Total)|nvme0n1: .*|Temperatura .*)$/"),
    zbx_alvo("B", "/^Linux servers$/", r"/^Ubuntu Server \(Docker Host\)$/",
             r"/^(CPU utilization|Memory utilization|Total memory|Available memory|System uptime|"
             r"Zabbix agent availability|Load average \(1m avg\)|Number of CPUs|Interface ens18: Bits (received|sent)|"
             r"FS \[\/hostfs\]: Space: (Used, in %|Available|Total))$/"),
    zbx_alvo("C", r"/^Aplicações\/Sistema de Metas$/", "/^SRV130/",
             r"/^(CPU utilization|Memory utilization|Total memory|Available memory|System uptime|"
             r"Zabbix agent availability|Load average \(1m avg\)|Number of CPUs|Interface ens18: Bits (received|sent)|"
             r"FS \[\/\]: Space: (Used, in %|Available|Total)|Containers (running|total|stopped)|Expires on|"
             r"APM: (requisições por minuto|latência média das requisições|latência p95 das requisições|"
             r"spans com erro por minuto)|Container \/[^:]+: (Running|CPU percent usage|Memory usage total|"
             r"Networks bytes (received|sent) per second|Restart count))$/"),
    zbx_alvo("D", "/^SecOps Lab$/", "/^secops-lab$/", "/.*/"),
    zbx_alvo("E", r"/^Rede\/WAN$/", "/^WAN - /", "/^ICMP (ping|loss|response time)$/"),
    {
        "refId": "P", "datasource": ZBX_DS, "queryType": "5",
        "group": {"filter": r"/^(Hypervisors|Linux servers|Aplicações\/Sistema de Metas|SecOps Lab|Zabbix servers|Rede\/WAN)$/"},
        "host": {"filter": "/.*/"}, "application": {"filter": ""}, "itemTag": {"filter": ""},
        "proxy": {"filter": ""}, "trigger": {"filter": ""}, "tags": {"filter": ""}, "evaltype": "0",
        "functions": [], "showProblems": "problems",
        "options": {"showDisabledItems": False, "minSeverity": 0, "acknowledged": 2, "sortProblems": "severity",
                    "limit": 200, "hostsInMaintenance": True, "hostProxy": False, "useTimeRange": False,
                    "severities": [0, 1, 2, 3, 4, 5]},
    },
]


def ler(nome):
    return (SRC / nome).read_text(encoding="utf-8")


def codigo(painel, cfg):
    lib = ler("lib.js").replace("__CONFIG__", json.dumps(cfg, ensure_ascii=False))
    return lib + "\n" + ler(painel)


def texto(pid, grid, js, cfg):
    esqueleto = '<div class="ops-raiz"></div>'
    return {
        # Sem título/descrição: o Grafana desenharia o ícone ⓘ por cima dos cards
        "id": pid, "type": "marcusolsson-dynamictext-panel", "title": "",
        "transparent": True, "gridPos": grid, "datasource": DASH_DS,
        "targets": [{"refId": "A", "datasource": DASH_DS, "panelId": MAPA_ID, "withTransforms": False}],
        "options": {
            "renderMode": "data", "content": esqueleto, "defaultContent": esqueleto,
            "editors": ["afterRender", "default", "styles"], "editor": {"format": "auto", "language": "html"},
            "wrap": False, "helpers": "", "afterRender": codigo(js, cfg), "status": "",
            "styles": "& .dt-row { height: 100%; padding: 0; margin: 0; }",
            "externalStyles": [], "contentPartials": [],
        },
    }


def main():
    css = ler("estilos.css")
    fontes = "".join(ler(f) for f in sorted(p.name for p in SRC.iterdir()))
    versao = hashlib.sha1(fontes.encode()).hexdigest()[:10]
    nos = montar_nos()
    cfg = {"versao": versao, "hosts": HOSTS, "nos": nos, "interfaces": INTERFACES, "css": css,
           "zabbixUrl": "http://zabbix.lan", "recenteMs": 15 * 60 * 1000}

    mapa = {
        "id": MAPA_ID, "type": "volkovlabs-echarts-panel", "title": "",
        "transparent": True, "gridPos": {"x": 5, "y": 3, "w": 13, "h": 21}, "datasource": ZBX_DS,
        "maxDataPoints": 120, "interval": "1m", "targets": ALVOS_MAPA,
        "options": {
            "renderer": "canvas", "map": "none", "themeEditor": {"name": "default", "config": "{}"},
            "editorMode": "code", "editor": {"format": "auto"}, "getOption": codigo("mapa.js", cfg),
            "visualEditor": {"dataset": [], "series": [], "code": "return {}"},
            "baidu": {"key": "", "callback": "bmapReady"}, "gaode": {"key": "", "plugin": "AMap.Scale,AMap.ToolBar"},
            "google": {"key": "", "callback": "gmapReady"},
        },
    }

    # SecOps: itens trapper atualizados só quando um scan roda -> consulta própria de 30 dias
    secops = texto(6, {"x": 18, "y": 20, "w": 6, "h": 4}, "secops.js", cfg)
    alvo = {t["refId"]: t for t in ALVOS_MAPA}
    secops.update({"datasource": ZBX_DS, "timeFrom": "30d", "hideTimeOverride": True, "maxDataPoints": 60,
                   "targets": [alvo["D"], dict(alvo["P"], group={"filter": "/^SecOps Lab$/"})]})

    # Infraestrutura: consulta própria de 24 h, porque itens como "Number of CPUs" e "Expires on"
    # descartam valores repetidos e só gravam de horas em horas (não aparecem numa janela de 1 h).
    infra = texto(4, {"x": 18, "y": 3, "w": 6, "h": 17}, "infraestrutura.js", cfg)
    infra.update({"datasource": ZBX_DS, "timeFrom": "24h", "hideTimeOverride": True, "maxDataPoints": 1500,
                  "targets": [alvo["A"], alvo["B"], alvo["C"], alvo["E"], alvo["P"]]})

    paineis = [
        texto(1, {"x": 0, "y": 0, "w": 24, "h": 3}, "cabecalho.js", cfg),
        texto(2, {"x": 0, "y": 3, "w": 5, "h": 21}, "conectividade.js", cfg),
        mapa,
        infra,
        secops,
        texto(5, {"x": 0, "y": 24, "w": 24, "h": 2}, "alertas.js", cfg),
    ]

    opcoes_caminho = [("Todos", "todos")] + [(n["nome"], n["id"]) for n in nos if n.get("pai")]
    dash = {
        "uid": "ops-infraestrutura",
        "title": "Operações · Infraestrutura",
        "tags": ["homelab", "zabbix", "business-charts", "business-text"],
        "timezone": "browser", "editable": True, "graphTooltip": 0, "refresh": "30s",
        "time": {"from": "now-1h", "to": "now"},
        "description": "Mapa de conectividade e saúde do homelab (Zabbix) com Business Charts + Business Text. "
                       "Gerado por gerar-dashboard.py (repo dashboard-operacoes) — edite o gerador, não o JSON.",
        "templating": {"list": [{
            "name": "caminho", "label": "Caminho", "type": "custom", "hide": 2,
            "query": ",".join(f"{t} : {v}" for t, v in opcoes_caminho),
            "current": {"text": "Todos", "value": "todos"},
            "options": [{"text": t, "value": v, "selected": v == "todos"} for t, v in opcoes_caminho],
        }]},
        "panels": paineis,
        "schemaVersion": 41,
    }

    saida = json.dumps(dash, ensure_ascii=False, indent=2)
    if "--stdout" in sys.argv:
        print(saida)
    else:
        SAIDA.write_text(saida + "\n", encoding="utf-8")
        print(f"gravado {SAIDA.name} (versão {versao}, {len(paineis)} painéis, {len(nos)} nós)")


if __name__ == "__main__":
    main()
