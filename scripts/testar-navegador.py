#!/usr/bin/env python3
"""Abre o dashboard no Chromium (Playwright), percorre as interações e salva prints.

Passos: visão geral → clique na VM 130 (caminho + câmera) → expande os
containers → limpa → abre o modal do Proxmox → abas Storage e Aplicações.
Falha se houver erro de console/página.

Requer o Playwright do ambiente ~/wazuh/.venv-shot e as libs do Chromium
extraídas em ~/wazuh/.libs (o sudo do WSL pede senha). Uso:
  LD_LIBRARY_PATH=~/wazuh/.libs/root/usr/lib/x86_64-linux-gnu \\
    ~/wazuh/.venv-shot/bin/python scripts/testar-navegador.py [pasta-de-saida]
O token Viewer do Grafana é lido de ~/wazuh/credenciais.env (GRAFANA_VIEWER_TOKEN).
"""
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "http://192.168.1.200:3000/d/ops-infraestrutura?kiosk"
SAIDA = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/ops-prints")
SAIDA.mkdir(parents=True, exist_ok=True)
TOKEN = next(l.split("=", 1)[1].strip() for l in open(os.path.expanduser("~/wazuh/credenciais.env"))
             if l.startswith("GRAFANA_VIEWER_TOKEN="))


def clicar_svg(pg, seletor):
    # Os nós do mapa respondem a pointerdown/pointerup (o palco também faz arrastar)
    pg.dispatch_event(seletor, "pointerdown")
    pg.dispatch_event(seletor, "pointerup")


with sync_playwright() as p:
    nav = p.chromium.launch()
    ctx = nav.new_context(viewport={"width": 1920, "height": 1080}, extra_http_headers={"Authorization": f"Bearer {TOKEN}"})
    pg = ctx.new_page()
    erros = []
    pg.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: erros.append(f"pageerror: {e}"))
    pg.goto(URL, wait_until="networkidle", timeout=90000)
    pg.wait_for_timeout(5000)
    aviso = pg.locator("#grafana-portal-container [role=dialog] button").first  # promo "Grafana Assistant"
    if aviso.count():
        aviso.click()
    passos = [
        ("01-visao-geral", None),
        ("02-caminho-vm130", lambda: pg.click(".ops-vm[data-no='vm130']")),
        ("03-containers", lambda: clicar_svg(pg, "[data-exp='vm130']")),
        ("04-limpar", lambda: pg.click("[data-acao='limpar']")),
        ("05-modal-virtualizacao", lambda: clicar_svg(pg, "[data-abrir='virtualizacao']")),
        ("06-modal-storage", lambda: pg.click("[data-aba='storage']")),
        ("07-modal-aplicacoes", lambda: pg.click("[data-aba='aplicacoes']")),
    ]
    for nome, acao in passos:
        if acao:
            acao()
            pg.wait_for_timeout(1200)
        pg.screenshot(path=str(SAIDA / f"{nome}.png"))
        print("ok", nome)
    nav.close()
    print("prints em", SAIDA)
    if erros:
        print("ERROS:", erros[:8])
        sys.exit(1)
