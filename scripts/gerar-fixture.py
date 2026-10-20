#!/usr/bin/env python3
"""Gera tests/fixtures/frames.json a partir dos valores atuais do Zabbix.

Monta frames no formato que o plugin Zabbix entrega ao navegador (um campo de
tempo + um campo numérico com labels host/item/item_key), com 30 pontos
sintéticos em volta do último valor, e uma lista de problemas ativos.
Usa o token somente leitura do MCP (~/.config/zabbix-mcp/mcp.token).

Uso: python3 scripts/gerar-fixture.py
"""
import json
import random
import time
import urllib.request
from pathlib import Path

API = "http://192.168.1.200:8080/api_jsonrpc.php"
TOKEN = (Path.home() / ".config/zabbix-mcp/mcp.token").read_text().strip()
SAIDA = Path(__file__).resolve().parent.parent / "tests/fixtures/frames.json"
HOSTS = {"10683", "10685", "10686", "10687", "10688", "10689", "10690"}


def api(metodo, params):
    req = urllib.request.Request(API, json.dumps({"jsonrpc": "2.0", "method": metodo, "params": params, "id": 1}).encode(),
                                 {"Content-Type": "application/json-rpc", "Authorization": f"Bearer {TOKEN}"})
    return json.load(urllib.request.urlopen(req, timeout=30))["result"]


def main():
    nomes = {h["hostid"]: h["name"] for h in api("host.get", {"output": ["hostid", "name"], "hostids": sorted(HOSTS)})}
    itens = api("item.get", {"hostids": sorted(HOSTS), "output": ["hostid", "key_", "name", "lastvalue", "units", "value_type"],
                             "monitored": True})
    agora = int(time.time() * 1000)
    tempos = [agora - (29 - i) * 60000 for i in range(30)]
    frames = []
    for it in itens:
        if it["value_type"] not in ("0", "3") or it["lastvalue"] == "" or it["hostid"] not in nomes:
            continue
        v = float(it["lastvalue"])
        continuo = it["units"] == "bps" or it["value_type"] == "0"
        frames.append({"name": it["name"], "refId": "X", "length": 30, "fields": [
            {"name": "Time", "type": "time", "values": tempos, "config": {}},
            {"name": it["name"], "type": "number",
             "labels": {"host": nomes[it["hostid"]], "item": it["name"], "item_key": it["key_"]},
             "values": [v * (0.85 + random.random() * 0.3) if continuo else v for _ in tempos],
             "config": {"custom": {"units": it["units"], "scopedVars": {"__zbx_host_id": {"value": it["hostid"]}}}}}]})
    probs = api("problem.get", {"output": ["eventid", "name", "severity", "clock", "acknowledged", "objectid"]})
    trig = {t["triggerid"]: t for t in api("trigger.get", {"triggerids": [p["objectid"] for p in probs], "output": ["triggerid"],
                                                          "selectHosts": ["host", "name"]})} if probs else {}
    problemas = []
    for p in probs:
        h = (trig.get(p["objectid"], {}).get("hosts") or [{}])[0]
        problemas.append({"eventid": p["eventid"], "name": p["name"], "severity": p["severity"], "timestamp": p["clock"],
                          "acknowledged": p["acknowledged"], "host": h.get("name", ""), "hostTechName": h.get("host", "")})
    frames.append({"name": "problems", "refId": "P", "length": len(problemas),
                   "fields": [{"name": "Problems", "type": "other", "config": {}, "values": problemas}]})
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(frames, ensure_ascii=False))
    print(f"gravado {SAIDA.name}: {len(frames) - 1} séries, {len(problemas)} problemas")


if __name__ == "__main__":
    main()
