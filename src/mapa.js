// ===== Mapa de conectividade (Business Charts como hospedeiro; cena em HTML5/SVG) =====
// Câmera com zoom/pan animados, cartões de enlace entre equipamentos, clusters, lista expansível
// de containers e destaque de caminho (o resto esmaece e a câmera enquadra o caminho).
const chart = context.panel.chart;
const dom = chart.getDom();
const st = (window.__opsMapa = window.__opsMapa || { detalhe: true, uplink: 'nic0', expandido: {}, vb: null, ultimoEnq: null });
const W = 1500;
const H = 980;
const NS = 'http://www.w3.org/2000/svg';
const COR = OPS.COR;
const AZUL = '#3d8bff';
const esc = OPS.esc;
const bpsC = OPS.bps;

/* ---------- Estrutura HTML (barra + palco SVG + tooltip) ---------- */
dom.style.position = 'relative';
let raiz = dom.querySelector('.ops-mapa');
if (!raiz) {
  raiz = document.createElement('div');
  raiz.className = 'ops-mapa';
  raiz.innerHTML = `<div class="ops-mapa-barra"></div><div class="ops-mapa-sub"></div>
    <div class="ops-palco"><svg class="ops-svg" xmlns="${NS}" preserveAspectRatio="xMidYMid meet"></svg></div>
    <div class="ops-tip"></div>`;
  dom.appendChild(raiz);
}
const barra = raiz.querySelector('.ops-mapa-barra');
const sub = raiz.querySelector('.ops-mapa-sub');
const palco = raiz.querySelector('.ops-palco');
const svg = raiz.querySelector('.ops-svg');
const tip = raiz.querySelector('.ops-tip');

/* ---------- Ícones (centrados em 0,0) ---------- */
const portas = (n, x0, c) =>
  Array.from({ length: n }, (_, i) => `<rect x="${x0 + i * 8}" y="-5" width="6" height="9" rx="1.6" fill="none" stroke="${c}" stroke-width="1.3"/>`).join('');
const corpo = (w, c) => `<rect x="${-w / 2}" y="-12" width="${w}" height="24" rx="5" fill="#0b1823" stroke="${c}" stroke-width="1.8" filter="url(#ops-glow)"/>`;
const ICONE = {
  equip: (c) =>
    corpo(66, c) + portas(5, -28, c) +
    `<rect x="15" y="-6" width="10" height="12" rx="2" fill="none" stroke="${c}" stroke-width="1.3"/><circle cx="20" cy="-1.5" r="1.4" fill="${c}"/><circle cx="20" cy="2.5" r="1.4" fill="${c}"/>`,
  servidor: (c) =>
    corpo(96, c) + portas(8, -43, c) +
    `<rect x="25" y="-6" width="16" height="12" rx="2" fill="none" stroke="${c}" stroke-width="1.3"/><circle cx="30" cy="0" r="1.6" fill="${c}"/><circle cx="36" cy="0" r="1.6" fill="${c}"/>`,
  roteador: (c) =>
    `<g stroke="${c}" stroke-width="1.6" fill="none"><path d="M-20,-12 V-24 M20,-12 V-24 M0,-12 V-20"/><path d="M-7,-27 a10,10 0 0 1 14,0"/><path d="M-11,-31 a16,16 0 0 1 22,0"/></g>` +
    corpo(66, c) + portas(5, -28, c) + `<circle cx="22" cy="0" r="2" fill="${c}"/>`,
  escudo: (c) =>
    corpo(70, c) +
    `<circle cx="-24" cy="0" r="4" fill="none" stroke="${c}" stroke-width="1.3"/><circle cx="24" cy="0" r="4" fill="none" stroke="${c}" stroke-width="1.3"/>` +
    `<path d="M0,-19 L13,-14 L13,-3 C13,7 6,13 0,16 C-6,13 -13,7 -13,-3 L-13,-14 Z" fill="#0b1823" stroke="${c}" stroke-width="1.8"/>` +
    `<path d="M0,-12 L7,-9 L7,-2 C7,3 3,7 0,9 C-3,7 -7,3 -7,-2 L-7,-9 Z" fill="none" stroke="${c}" stroke-width="1.3"/>`,
  nuvem: (c) =>
    `<path d="M-30,14 a15,15 0 0 1 2,-29 a20,20 0 0 1 37,-5 a14,14 0 0 1 21,12 a11,11 0 0 1 -2,22 z" fill="#0b1823" stroke="${c}" stroke-width="1.8" filter="url(#ops-glow)"/>`,
  pc: (c) =>
    `<rect x="-22" y="-17" width="44" height="28" rx="3" fill="#0b1823" stroke="${c}" stroke-width="1.8" filter="url(#ops-glow)"/>` +
    `<rect x="-17" y="-12" width="34" height="18" rx="1.5" fill="none" stroke="${c}" stroke-width="1" opacity=".7"/><path d="M-8,17 H8 M0,11 V17" stroke="${c}" stroke-width="1.6"/>`,
};

/* ---------- Cena: posições no "mundo" 1500 x 980 ---------- */
const VM_ESQ = ['vm100', 'vm101', 'vm104', 'vm107', 'vm130'];
const yVm = (i) => 340 + i * 82;
const DEV = [
  { id: 'internet', x: 750, y: 46, ic: 'nuvem', rot: 'INTERNET', sub: () => `1.1.1.1 · ${OPS.ping('cf').texto}`, pos: 'dir' },
  { id: 'roteador', x: 750, y: 158, ic: 'roteador', rot: 'ROTEADOR', sub: () => `192.168.1.254 · ${OPS.ping('gw').texto}`, pos: 'esq' },
  { id: 'pc', x: 1110, y: 158, ic: 'pc', rot: 'PC WINDOWS', sub: '192.168.1.3' },
  { id: 'pve', x: 750, y: 372, ic: 'servidor', rot: 'PROXMOX · luis', sub: '192.168.1.100' },
  ...VM_ESQ.map((id, i) => ({ id, x: 150, y: yVm(i), ic: 'equip' })),
  { id: 'vm105', x: 1285, y: 372, ic: 'escudo' },
  { id: 'vm106', x: 1285, y: 612, ic: 'escudo' },
  { id: 'lxc102', x: 470, y: 812, ic: 'equip', pos: 'dir' },
  { id: 'lxc109', x: 1030, y: 812, ic: 'equip', pos: 'esq' },
];
const GRUPOS = [
  { x: 655, y: 300, w: 190, h: 238, titulo: 'HIPERVISOR · PROXMOX VE', no: 'pve' },
  { x: 1150, y: 296, w: 300, h: 360, titulo: 'CLUSTER Segurança', no: 'seg' },
  { x: 330, y: 676, w: 840, h: 290, titulo: 'SERVIÇOS · CONTÊINERES E STORAGE', no: 'srv' },
];

// Enlaces: dono (para o caminho), cartão (origem/porta → destino/porta) e polilinhas.
const cartao = (x, y, a, pa, b, pb, ifc, inverte, cor) => ({ x, y, a, pa, b, pb, ifc, inverte, cor });
const ENL = [
  { dono: 'roteador', linhas: [[[750, 74], [750, 128]]] },
  { dono: 'pc', linhas: [[[790, 158], [1080, 158]]], semColeta: true },
  {
    dono: 'pve:nic0',
    card: cartao(640, 250, 'ROTEADOR', 'LAN', 'PROXMOX', 'nic0', 'nic0', false, COR.ok),
    linhas: [[[750, 172], [750, 196], [640, 196], [640, 219]], [[640, 281], [640, 304], [728, 304], [728, 358]]],
  },
  {
    dono: 'pve:wifi',
    card: cartao(860, 250, 'ROTEADOR', 'Wi-Fi', 'PROXMOX', 'wlp0s20f3', 'wlp0s20f3', false, AZUL),
    linhas: [[[750, 172], [750, 196], [860, 196], [860, 219]], [[860, 281], [860, 304], [772, 304], [772, 358]]],
  },
  { dono: 'vmbr0', linhas: [[[750, 386], [750, 420]]] },
];
VM_ESQ.forEach((id, i) => {
  const y = yVm(i);
  const n = OPS.no(id);
  ENL.push({ dono: id, card: cartao(420, y, 'vmbr0', n.ifc, n.curto, 'net0', n.ifc, true, COR.ok), linhas: [[[185, y], [300, y]], [[540, y], [612, y], [612, 462], [676, 462]]] });
});
[['vm105', 372], ['vm106', 612]].forEach(([id, y]) => {
  const n = OPS.no(id);
  ENL.push({ dono: id, card: cartao(1000, y, 'vmbr0', n.ifc, n.curto, 'net0', n.ifc, true, COR.ok), linhas: [[[824, 462], [868, 462], [868, y], [880, y]], [[1120, y], [1250, y]]] });
});
[['lxc102', 470], ['lxc109', 1030]].forEach(([id, x]) => {
  const n = OPS.no(id);
  ENL.push({
    dono: id,
    semColeta: true,
    card: cartao(x, 746, 'vmbr0', `veth${id.slice(3)}i0`, n.curto, 'eth0', null, true, AZUL),
    linhas: [[[750, 492], [750, 704], [x, 704], [x, 715]], [[x, 777], [x, 798]]],
  });
});

const ICONE_CHASSI = (c) =>
  `<rect width="42" height="44" rx="4" fill="none" stroke="${c}" stroke-width="1.4"/>` +
  [0, 1, 2, 3, 4, 5].map((i) => `<rect x="${6 + i * 5.4}" y="7" width="3.4" height="30" rx="1" fill="${c}" opacity=".55"/>`).join('');
const ICONE_DISCO = (c) =>
  `<rect width="42" height="44" rx="4" fill="none" stroke="${c}" stroke-width="1.4"/>` +
  [0, 1, 2].map((r) => [0, 1, 2, 3].map((k) => `<rect x="${6 + k * 8}" y="${8 + r * 11}" width="6" height="8" rx="1" fill="${c}" opacity=".55"/>`).join('')).join('');

const ctrs = [
  ...new Set(
    OPS.doHost('vm130')
      .filter((m) => /^docker\.container_info\.state\.running\[/.test(m.key))
      .map((m) => m.key.match(/"\/([^"]+)"/)[1])
  ),
];
const corEstado = (s, base) => (s.estado === 'ok' ? base : s.estado === 'semcoleta' ? AZUL : s.estado === 'off' ? COR.mudo : s.cor);
const dur = (bps) => (bps >= 1e6 ? 0.6 : bps >= 1e5 ? 1 : bps >= 1e4 ? 1.6 : bps >= 1e3 ? 2.4 : 3.4);
const linhaSvg = (pts, cor, forte, fluxo, tracejada, total) => {
  const d = 'M' + pts.map((p) => p.join(',')).join(' L');
  const brilho = !tracejada ? `<path d="${d}" fill="none" stroke="${cor}" stroke-width="${forte ? 9 : 6}" opacity="${forte ? 0.28 : 0.14}" stroke-linejoin="round"/>` : '';
  const base = `<path d="${d}" fill="none" stroke="${cor}" stroke-width="${forte ? 3 : 2}" stroke-linejoin="round" ${tracejada ? 'stroke-dasharray="7 6"' : ''}/>`;
  const pulso = fluxo
    ? `<path class="ops-pulso" d="${d}" fill="none" stroke="#eafff8" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="3 26" style="animation-duration:${dur(total)}s"/>`
    : '';
  return brilho + base + pulso;
};

/* ---------- Estado da renderização ---------- */
let sel = 'todos';
let caminho = null;
let caixas = [];

const donosDoCaminho = (id) => {
  const set = new Set();
  let n = OPS.no(id);
  while (n) {
    set.add(n.id);
    if (n.id === 'pve') {
      set.add(`pve:${st.uplink}`);
    }
    n = n.pai ? OPS.no(n.pai) : null;
  }
  if (id === 'vm105' || id === 'vm106') {
    set.add('seg');
  }
  if (id.startsWith('lxc')) {
    set.add('srv');
  }
  return set;
};
const ativo = (dono) => !caminho || caminho.has(dono);
const marca = (dono, x0, y0, x1, y1) => caixas.push({ dono, x0, y0, x1, y1 });

/* ---------- Desenho da cena ---------- */
const desenhar = () => {
  sel = OPS.caminhoAtual();
  caminho = sel !== 'todos' && OPS.no(sel) ? donosDoCaminho(sel) : null;
  caixas = [];
  let html = `<defs><filter id="ops-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="ops-grade" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40,0 H0 V40" fill="none" stroke="rgba(120,170,210,.05)" stroke-width="1"/></pattern></defs>
    <rect x="-3000" y="-3000" width="${W + 6000}" height="${H + 6000}" fill="url(#ops-grade)"/>`;

  // Grupos (clusters)
  GRUPOS.forEach((g) => {
    const on = ativo(g.no) || (g.no === 'pve' && caminho && caminho.has('vmbr0'));
    html += `<g class="ops-grupo${on ? '' : ' ops-dim'}"><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="16"/>
      <text x="${g.x + g.w / 2}" y="${g.y + 20}" text-anchor="middle">${g.titulo}</text></g>`;
    marca(g.no, g.x, g.y, g.x + g.w, g.y + g.h);
  });

  // Enlaces: linhas + cartões
  ENL.forEach((e) => {
    const no = OPS.no(e.dono.split(':')[0]);
    const s = OPS.statusNo(no);
    const t = e.card && e.card.ifc ? OPS.trafego({ ifc: e.card.ifc, desceEhSaida: e.card.inverte }) : e.card ? null : e.dono === 'roteador' ? OPS.trafego({ ifc: 'nic0' }) : OPS.trafego(no);
    const wifiDown = e.dono === 'pve:wifi' && OPS.ult('pve', 'vfs.file.contents["/sys/class/net/wlp0s20f3/operstate"]') !== 6;
    const base = e.card ? e.card.cor : COR.ok;
    let cor = e.semColeta ? AZUL : corEstado(s, base);
    if (e.dono.startsWith('pve:')) {
      cor = wifiDown ? COR.mudo : base;
    }
    const on = ativo(e.dono);
    const fluxo = on && t && t.recente && t.total > 0 && !wifiDown;
    const tracejada = e.semColeta || wifiDown || (!t && !['roteador', 'vmbr0'].includes(e.dono));
    let g = `<g class="ops-enl${on ? '' : ' ops-dim'}">`;
    e.linhas.forEach((pts) => {
      g += linhaSvg(pts, cor, on && !!caminho, fluxo, tracejada, t ? t.total : 0);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      marca(e.dono, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    });
    if (e.card) {
      const c = e.card;
      const w = 240;
      const h = 62;
      const corA = c.cor === AZUL ? '#5aa2ff' : '#3ff0b4';
      const l3 = e.semColeta
        ? 'veth não coletada pelo template'
        : wifiDown
          ? 'DESCONECTADA'
          : t
            ? `${c.inverte ? 'TX' : 'RX'} ${bpsC(t.vDesce)} · ${c.inverte ? 'RX' : 'TX'} ${bpsC(t.vSobe)}`
            : 'sem dados';
      g += `<g class="ops-cartao" data-no="${no.id}" transform="translate(${c.x - w / 2},${c.y - h / 2})">
        <rect width="${w}" height="${h}" rx="7" fill="#0a1722" stroke="${cor}" stroke-width="${on && caminho ? 2.2 : 1.4}" ${tracejada ? 'stroke-dasharray="5 4"' : ''}/>
        <text class="ops-t-nome" x="12" y="18" fill="${corA}">${esc(c.a)}</text><text class="ops-t-nome" x="${w / 2 + 8}" y="18">${esc(c.b)}</text>
        <text class="ops-t-port" x="12" y="37" fill="${corA}">${esc(c.pa)}</text><text class="ops-t-port" x="${w / 2 + 8}" y="37">${esc(c.pb)}</text>
        <text class="ops-t-tx det" x="12" y="54">${esc(l3)}</text></g>`;
      marca(e.dono, c.x - w / 2, c.y - h / 2, c.x + w / 2, c.y + h / 2);
    }
    html += g + '</g>';
  });

  // Bridge vmbr0 (caixa central, como o "VLTi" do exemplo)
  {
    const n = OPS.no('vmbr0');
    const t = OPS.trafego(n);
    const c = corEstado(OPS.statusNo(n), COR.ok);
    const taps = OPS.NOS.filter((x) => x.ifc && x.ifc.startsWith('tap')).length;
    html += `<g class="ops-no${ativo('vmbr0') ? '' : ' ops-dim'}" data-no="vmbr0" transform="translate(750,456)">
      <rect x="-74" y="-36" width="148" height="72" rx="8" fill="#0b1823" stroke="${c}" stroke-width="1.6"/>
      <text class="ops-t-port" y="-14" text-anchor="middle" fill="#e8f3fa">vmbr0 · bridge</text>
      <text class="ops-t-sub" y="4" text-anchor="middle">10 Gbps · ${taps} taps</text>
      <text class="ops-t-tx det" y="23" text-anchor="middle">↓ ${bpsC(t && t.vDesce)} · ↑ ${bpsC(t && t.vSobe)}</text></g>`;
    marca('vmbr0', 676, 420, 824, 492);
  }

  // Caixa "SOC" no cluster de segurança (como o "HA · Firewall" do exemplo)
  {
    const probs = OPS.problemasDo('secops');
    const on = ativo('seg');
    const c = probs.length ? OPS.SEV_COR[probs[0].sev] : COR.ok;
    html += `<path d="M1285,398 V438 M1285,550 V586" stroke="${c}" stroke-width="2" stroke-dasharray="4 5" fill="none" class="${on ? '' : 'ops-dim'}"/>
      <g class="ops-no${on ? '' : ' ops-dim'}" data-abrir="seguranca" transform="translate(1205,438)">
      <rect width="160" height="112" rx="8" fill="#0b1823" stroke="${c}" stroke-width="1.4"/>
      <text class="ops-t-port" x="80" y="22" text-anchor="middle" fill="${c}">SOC · Segurança</text>
      <text class="ops-t-mini" x="12" y="42">SIEM</text><text class="ops-t-nome" x="12" y="56">Wazuh 4.14 · 4 agentes</text>
      <text class="ops-t-mini" x="12" y="74">SCAN</text><text class="ops-t-nome" x="12" y="88">Nmap · Nuclei · Greenbone</text>
      <text class="ops-t-mini" x="12" y="104" fill="${c}">${probs.length ? `${probs.length} trigger${probs.length > 1 ? 's' : ''} ativo${probs.length > 1 ? 's' : ''}` : 'sem triggers'}</text></g>`;
  }

  // Recursos largos (como CHASSI-DEMO / DELL STORAGE-01 do exemplo)
  {
    const P = 'pve';
    const vms = OPS.NOS.filter((x) => x.ifc && x.ifc.startsWith('tap'));
    const up = vms.filter((x) => ['ok', 'trigger'].includes(OPS.statusNo(x).estado)).length;
    const mem = OPS.ult(P, 'vm.memory.util');
    const fs = OPS.ult(P, 'vfs.fs.dependent.size[/,pused]');
    const util = OPS.ult(P, 'vfs.dev.util[nvme0n1]');
    const tN = OPS.ult(P, 'aiops.hwtemp[nvme,temp1]');
    const tC = OPS.ult(P, 'aiops.hwtemp[coretemp,Package id 0]');
    const corMem = OPS.faixa(mem, 80, 90);
    const corSto = OPS.faixa(Math.max(fs || 0, util || 0), 80, 90) === COR.ok && tC >= 80 ? COR.aviso : OPS.faixa(Math.max(fs || 0, util || 0), 80, 90);
    const on = !caminho || caminho.has('pve');
    const recurso = (x, cor, aba, icone, titulo, l1, l2, legenda) => `
      <g class="ops-recurso${on ? '' : ' ops-dim'}" data-abrir="${aba}" transform="translate(${x},858)">
        <rect width="330" height="78" rx="8" fill="#0b1823" stroke="${cor}" stroke-width="1.6"/>
        <g transform="translate(16,16)">${icone}</g>
        <text class="ops-t-dev" x="72" y="25">${titulo}</text>
        <text class="ops-t-sub" x="72" y="43">${l1}</text>
        <text class="ops-t-mini" x="72" y="58" fill="${cor}">${l2}</text>
        <text class="ops-t-link" x="72" y="73" fill="${cor}">ABRIR DETALHES ↗</text>
        <text class="ops-t-link" x="165" y="98" text-anchor="middle" fill="#4ea3ff">↗ ${legenda}</text>
      </g>`;
    html += `<path d="M676,520 V600 H560 V858 M824,520 V600 H940 V858" fill="none" stroke="#3d6a8a" stroke-width="1.4" stroke-dasharray="5 5" class="${on ? '' : 'ops-dim'}"/>`;
    html += recurso(395, corMem, 'virtualizacao', ICONE_CHASSI(corMem), 'PROXMOX · HP ZBook 17 G5',
      `${up} VMs ativas · 2 LXC · up ${OPS.duracao(OPS.ult(P, 'system.uptime'))}`,
      `RAM do host ${OPS.pct(mem)} · CPU ${OPS.pct(OPS.ult(P, 'system.cpu.util'))}`, 'Abrir virtualização, memória e VMs');
    html += recurso(775, corSto, 'storage', ICONE_DISCO(corSto), 'NVMe · nvme0n1',
      `Utilização ${OPS.pct(util)} · FS / ${OPS.pct(fs)}`,
      `NVMe ${tN === null ? '—' : OPS.num(tN, 0) + ' °C'} · CPU ${tC === null ? '—' : OPS.num(tC, 0) + ' °C'}`, 'Abrir disco, sensores e temperatura');
  }

  // Equipamentos
  DEV.forEach((d) => {
    const n = OPS.no(d.id);
    const s = OPS.statusNo(n);
    const c = corEstado(s, d.id === 'pve' && st.uplink === 'wifi' ? AZUL : COR.ok);
    const on = ativo(d.id);
    const foco = d.id === sel;
    const rot = d.rot || n.nome;
    const subt = typeof d.sub === 'function' ? d.sub() : d.sub || n.ip;
    const alerta = s.estado === 'trigger' || s.estado === 'down' ? `<text class="ops-t-mini" y="${d.pos ? 30 : 42}" ${d.pos ? `x="${d.pos === 'dir' ? 44 : -44}" text-anchor="${d.pos === 'dir' ? 'start' : 'end'}"` : 'text-anchor="middle"'} fill="${s.cor}">${esc(s.texto)}</text>` : '';
    let rotulo;
    if (d.pos === 'dir') {
      rotulo = `<text class="ops-t-dev" x="46" y="-2">${esc(rot)}</text><text class="ops-t-sub det" x="46" y="15">${esc(subt)}</text>`;
    } else if (d.pos === 'esq') {
      rotulo = `<text class="ops-t-dev" x="-46" y="-2" text-anchor="end">${esc(rot)}</text><text class="ops-t-sub det" x="-46" y="15" text-anchor="end">${esc(subt)}</text>`;
    } else {
      rotulo = `<text class="ops-t-dev" y="${d.ic === 'roteador' ? -40 : -22}" text-anchor="middle">${esc(rot)}</text><text class="ops-t-sub det" y="${d.id === 'vm130' ? 58 : 29}" text-anchor="middle">${esc(subt)}</text>`;
    }
    html += `<g class="ops-no${on ? '' : ' ops-dim'}" data-no="${d.id}" transform="translate(${d.x},${d.y})">
      ${foco ? `<rect class="ops-anel" x="-58" y="-28" width="116" height="56" rx="10" fill="none" stroke="${c}" stroke-width="1.6"/>` : ''}
      ${ICONE[d.ic](c)}${rotulo}${alerta}</g>`;
    marca(d.id, d.x - 62, d.y - 42, d.x + 62, d.y + 42);
  });

  // Selo expansível de containers da VM 130 (como o "7 APs" do exemplo)
  {
    const y = yVm(VM_ESQ.indexOf('vm130'));
    const aberto = !!st.expandido.vm130;
    html += `<g class="ops-selo${ativo('vm130') ? '' : ' ops-dim'}" data-exp="vm130" transform="translate(150,${y + 18})">
      <rect x="-50" y="0" width="100" height="22" rx="6" fill="#0b1823" stroke="${COR.ok}" stroke-width="1.3"/>
      <text class="ops-t-mini" y="15" text-anchor="middle" fill="#e8f3fa">${ctrs.length || '—'} containers ${aberto ? '▸' : '◂'}</text></g>`;
  }

  // Painel expandido de containers (por cima da coluna de cartões)
  if (st.expandido.vm130) {
    const linhas = ctrs
      .map((nome, i) => {
        const k = (p) => OPS.ult('vm130', `${p}["/${nome}"]`);
        const run = k('docker.container_info.state.running') === 1;
        const c = run ? COR.ok : COR.ruim;
        return `<g transform="translate(14,${52 + i * 70})"><rect width="292" height="60" rx="7" fill="#0a1722" stroke="${c}" stroke-width="1.2"/>
          <g transform="translate(24,30)" stroke="${c}" fill="none" stroke-width="1.4"><rect x="-12" y="-11" width="24" height="22" rx="3"/><path d="M-12,-3 H12 M-12,4 H12"/></g>
          <text class="ops-t-port" x="48" y="20" fill="#e8f3fa">${esc(nome)}</text>
          <text class="ops-t-sub" x="48" y="37">${run ? 'running' : 'parado'} · CPU ${OPS.pct(k('docker.container_stats.cpu_pct_usage'), 2)} · RAM ${OPS.bytes(k('docker.container_stats.memory.usage_total'))}</text>
          <text class="ops-t-tx" x="48" y="52">TX ${OPS.bytes(k('docker.networks.tx_bytes'))}/s · RX ${OPS.bytes(k('docker.networks.rx_bytes'))}/s</text></g>`;
      })
      .join('');
    html += `<g class="ops-exp" transform="translate(205,${yVm(0) - 30})"><rect width="320" height="${64 + Math.max(1, ctrs.length) * 70}" rx="10" fill="rgba(8,18,27,.97)" stroke="${COR.ok}" stroke-width="1.4"/>
      <text class="ops-t-dev" x="16" y="30">VM 130 · ${ctrs.length} containers</text>
      <g data-exp="vm130" class="ops-selo"><rect x="234" y="12" width="72" height="24" rx="6" fill="#0f1d29" stroke="rgba(120,170,200,.4)"/><text class="ops-t-mini" x="270" y="28" text-anchor="middle" fill="#e8f3fa">Recolher</text></g>
      ${linhas || '<text class="ops-t-sub" x="16" y="72">Sem dados de containers.</text>'}</g>`;
  }

  svg.innerHTML = html;
  svg.classList.toggle('ops-sem-det', !st.detalhe);
  desenharBarra();
};

/* ---------- Barra: seletores e legenda / trilha do caminho ---------- */
const desenharBarra = () => {
  const opt = (rot, ids) =>
    `<optgroup label="${rot}">${ids
      .map((id) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(OPS.no(id).nome)}${OPS.no(id).ip ? ' · ' + esc(OPS.no(id).ip) : ''}</option>`)
      .join('')}</optgroup>`;
  barra.innerHTML = `<span class="ops-rot">CAMINHO</span>
    <select class="ops-select" data-acao="caminho"><option value="todos">Selecione um equipamento ou VM</option>
      ${opt('Rede', ['roteador', 'pc', 'pve', 'vmbr0'])}
      ${opt('Máquinas virtuais', OPS.NOS.filter((n) => n.tipo === 'vm').map((n) => n.id))}
      ${opt('Contêineres LXC', OPS.NOS.filter((n) => n.tipo === 'lxc').map((n) => n.id))}
    </select>
    <select class="ops-select ops-select-curto" data-acao="uplink">
      <option value="nic0" ${st.uplink === 'nic0' ? 'selected' : ''}>Uplink cabeado · nic0</option>
      <option value="wifi" ${st.uplink === 'wifi' ? 'selected' : ''}>Uplink Wi-Fi · wlp0s20f3</option>
    </select>
    <button class="ops-btn" data-acao="limpar">Limpar</button>`;
  const titulo = '<span class="ops-eyebrow ops-mapa-titulo">MAPA DE CONECTIVIDADE</span>';
  if (caminho) {
    const trilha = [];
    let n = OPS.no(sel);
    while (n) {
      trilha.push(n.curto || n.nome);
      if (n.id === 'pve') {
        trilha.push(st.uplink === 'wifi' ? 'Wi-Fi wlp0s20f3' : 'nic0');
      }
      n = n.pai ? OPS.no(n.pai) : null;
    }
    sub.innerHTML = `<span class="ops-trilha">${trilha.map(esc).join(' → ')}</span>${titulo}`;
  } else {
    sub.innerHTML = `<span class="ops-legenda"><i style="background:${COR.ok}"></i>Uplink cabeado <i style="background:${AZUL}"></i>Wi-Fi / sem coleta <i style="background:${COR.mudo}"></i>Sem dados <i style="background:${COR.ruim}"></i>Trigger</span>${titulo}`;
  }
  barra.querySelector('[data-acao="caminho"]').onchange = (e) => OPS.selecionar(e.target.value);
  barra.querySelector('[data-acao="uplink"]').onchange = (e) => {
    st.uplink = e.target.value;
    atualizar();
  };
  barra.querySelector('[data-acao="limpar"]').onclick = () => OPS.selecionar('todos');
};

/* ---------- Câmera (viewBox animado) ---------- */
const MUNDO = { x: 50, y: 0, w: 1410, h: 972 };
const proporcao = (b) => {
  const r = palco.clientWidth / Math.max(1, palco.clientHeight) || W / H;
  let { x, y, w, h } = b;
  if (w / h > r) {
    const nh = w / r;
    y -= (nh - h) / 2;
    h = nh;
  } else {
    const nw = h * r;
    x -= (nw - w) / 2;
    w = nw;
  }
  return { x, y, w, h };
};
const aplicarVb = (b) => {
  st.vb = b;
  svg.setAttribute('viewBox', `${b.x.toFixed(1)} ${b.y.toFixed(1)} ${b.w.toFixed(1)} ${b.h.toFixed(1)}`);
};
let anim = 0;
const voar = (alvo, ms = 700) => {
  cancelAnimationFrame(anim);
  const de = st.vb || proporcao(MUNDO);
  const para = proporcao(alvo);
  const t0 = performance.now();
  const passo = (agora) => {
    const k = 1 - Math.pow(1 - Math.min(1, (agora - t0) / ms), 3);
    aplicarVb({ x: de.x + (para.x - de.x) * k, y: de.y + (para.y - de.y) * k, w: de.w + (para.w - de.w) * k, h: de.h + (para.h - de.h) * k });
    if (k < 1) {
      anim = requestAnimationFrame(passo);
    }
  };
  anim = requestAnimationFrame(passo);
};
const enquadrar = () => {
  if (!caminho) {
    voar(MUNDO);
    return;
  }
  const bs = caixas.filter((b) => caminho.has(b.dono) && b.dono !== 'srv' && b.dono !== 'seg');
  const x0 = Math.min(...bs.map((b) => b.x0)) - 80;
  const y0 = Math.min(...bs.map((b) => b.y0)) - 50;
  const x1 = Math.max(...bs.map((b) => b.x1)) + 80;
  const y1 = Math.max(...bs.map((b) => b.y1)) + 50;
  voar({ x: x0, y: y0, w: Math.max(560, x1 - x0), h: Math.max(400, y1 - y0) });
};

// Redesenha e, se a seleção/uplink mudou, leva a câmera até o caminho
const atualizar = () => {
  desenhar();
  const chave = `${sel}|${st.uplink}`;
  if (st.ultimoEnq !== chave) {
    st.ultimoEnq = chave;
    enquadrar();
  }
};
aplicarVb(st.vb || proporcao(MUNDO));
atualizar();

/* ---------- Interação: clique, duplo clique, tooltip, arrastar, roda ---------- */
const alvoDe = (e) => e.target.closest('[data-no],[data-abrir],[data-exp]');
let arrasto = null;
palco.onpointerdown = (e) => {
  arrasto = { x: e.clientX, y: e.clientY, vb: { ...st.vb }, moveu: false };
};
palco.onpointermove = (e) => {
  if (arrasto && e.buttons === 1) {
    const dx = e.clientX - arrasto.x;
    const dy = e.clientY - arrasto.y;
    if (arrasto.moveu || Math.abs(dx) + Math.abs(dy) > 5) {
      arrasto.moveu = true;
      palco.classList.add('ops-arrastando');
      cancelAnimationFrame(anim);
      const k = st.vb.w / palco.clientWidth;
      aplicarVb({ ...arrasto.vb, x: arrasto.vb.x - dx * k, y: arrasto.vb.y - dy * k });
      tip.style.display = 'none';
      return;
    }
  }
  const a = alvoDe(e);
  if (!a) {
    tip.style.display = 'none';
    return;
  }
  let t;
  if (a.dataset.no) {
    const n = OPS.no(a.dataset.no);
    const s = OPS.statusNo(n);
    const tr = OPS.trafego(n);
    t =
      `<b>${esc(n.nome)}</b> <span style="color:${s.cor}">● ${s.texto}</span><br/>${esc(n.ip || '')}${n.ifc ? ' · ' + esc(n.ifc) : ''}` +
      (tr ? `<br/>↓ ${bpsC(tr.vDesce)} · ↑ ${bpsC(tr.vSobe)}` : '') +
      (n.ping ? `<br/>ICMP ${esc(OPS.ping(n.ping).texto)}` : '') +
      (s.probs ? `<br/><span style="color:${s.cor}">${esc(s.probs[0].nome)}</span>` : '') +
      '<br/><i>Clique: caminho · duplo clique: detalhes</i>';
  } else if (a.dataset.exp) {
    t = `<b>VM 130 · ${ctrs.length} containers</b><br/>Clique para expandir ou recolher no mapa.`;
  } else {
    t = '<b>Abrir detalhes</b><br/>Clique para abrir o painel completo.';
  }
  const r = raiz.getBoundingClientRect();
  tip.innerHTML = t;
  tip.style.display = 'block';
  tip.style.left = Math.min(e.clientX - r.left + 14, r.width - 270) + 'px';
  tip.style.top = Math.min(e.clientY - r.top + 14, r.height - 110) + 'px';
};
palco.onpointerleave = () => {
  tip.style.display = 'none';
};
palco.onpointerup = (e) => {
  palco.classList.remove('ops-arrastando');
  const moveu = arrasto && arrasto.moveu;
  arrasto = null;
  if (moveu) {
    return;
  }
  const a = alvoDe(e);
  if (!a) {
    return;
  }
  if (a.dataset.exp) {
    st.expandido[a.dataset.exp] = !st.expandido[a.dataset.exp];
    desenhar();
  } else if (a.dataset.abrir) {
    OPS.abrirProxmox(a.dataset.abrir);
  } else if (a.dataset.no) {
    OPS.selecionar(OPS.caminhoAtual() === a.dataset.no ? 'todos' : a.dataset.no);
  }
};
palco.ondblclick = (e) => {
  const a = alvoDe(e);
  if (a && a.dataset.no) {
    OPS.abrirNo(a.dataset.no);
  }
};
palco.onwheel = (e) => {
  e.preventDefault();
  cancelAnimationFrame(anim);
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  const b = st.vb;
  const nw = Math.min(MUNDO.w * 2.5, Math.max(260, b.w * (e.deltaY > 0 ? 1.15 : 1 / 1.15)));
  const f = nw / b.w;
  aplicarVb({ x: p.x - (p.x - b.x) * f, y: p.y - (p.y - b.y) * f, w: nw, h: b.h * f });
};

/* ---------- Eventos de outros painéis e da URL ---------- */
const aoZoom = (e) => {
  const d = e.detail;
  if (d === 'reset') {
    st.ultimoEnq = null;
    OPS.selecionar('todos');
    voar(MUNDO);
    return;
  }
  const b = st.vb;
  const nw = Math.min(MUNDO.w * 2.5, Math.max(260, b.w * (d > 0 ? 1 / 1.3 : 1.3)));
  const f = nw / b.w;
  voar({ x: b.x + (b.w - nw) / 2, y: b.y + (b.h - b.h * f) / 2, w: nw, h: b.h * f }, 300);
};
const aoDetalhe = () => {
  st.detalhe = !st.detalhe;
  svg.classList.toggle('ops-sem-det', !st.detalhe);
};
const aoRedim = () => aplicarVb(proporcao(st.vb));
window.addEventListener('ops:zoom', aoZoom);
window.addEventListener('ops:detalhe', aoDetalhe);
const obs = new ResizeObserver(aoRedim);
obs.observe(palco);
const pararHist = context.grafana.locationService.getHistory().listen(() => {
  if (OPS.caminhoAtual() !== sel) {
    atualizar();
  }
});

return {
  version: 2,
  option: {},
  unsubscribe: () => {
    cancelAnimationFrame(anim);
    window.removeEventListener('ops:zoom', aoZoom);
    window.removeEventListener('ops:detalhe', aoDetalhe);
    obs.disconnect();
    pararHist();
  },
};
