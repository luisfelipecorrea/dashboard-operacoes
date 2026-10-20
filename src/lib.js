// ===== Biblioteca comum (o gerador injeta este arquivo no início de cada painel) =====
// Funciona tanto no Business Charts (context.panel.data) quanto no Business Text (context.panelData).
const OPS = (() => {
  const CFG = __CONFIG__;
  const H = CFG.hosts;
  const NOS = CFG.nos;

  /* ---------- CSS global (cards, mapa, modal), injetado uma vez por versão ---------- */
  const injetarCss = () => {
    let tag = document.getElementById('ops-css');
    if (tag && tag.dataset.versao === CFG.versao) {
      return;
    }
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'ops-css';
      document.head.appendChild(tag);
    }
    tag.dataset.versao = CFG.versao;
    tag.textContent = CFG.css;
  };
  injetarCss();

  /* ---------- Séries do Zabbix ---------- */
  const panelData = (context.panel && context.panel.data) || context.panelData || {};
  const frames = panelData.series || [];
  const lista = (v) => (v ? (typeof v.toArray === 'function' ? v.toArray() : Array.from(v)) : []);

  const metricas = [];
  const problemasBrutos = [];
  frames.forEach((f) => {
    const campos = f.fields || [];
    const prob = campos.find((c) => c.name === 'Problems');
    if (prob) {
      problemasBrutos.push(...lista(prob.values));
      return;
    }
    // No navegador o plugin entrega frames "wide": um campo de tempo e um campo numérico por item.
    const tempo = campos.find((c) => c.type === 'time');
    const t = lista(tempo && tempo.values);
    campos
      .filter((c) => c.type === 'number')
      .forEach((num) => {
        const lb = num.labels || {};
        const sv = (num.config && num.config.custom && num.config.custom.scopedVars) || {};
        const pv = (k) => (sv[k] && sv[k].value) || undefined;
        const pts = [];
        lista(num.values).forEach((y, i) => {
          if (y !== null && y !== undefined && !Number.isNaN(y)) {
            pts.push([t[i], y]);
          }
        });
        metricas.push({
          host: lb.host || pv('__zbx_host_name') || pv('__zbx_host'),
          hostid: pv('__zbx_host_id'),
          key: lb.item_key || pv('__zbx_item_key'),
          item: lb.item || pv('__zbx_item_name') || num.name,
          units: (num.config && num.config.custom && num.config.custom.units) || '',
          pts,
          ult: pts.length ? pts[pts.length - 1][1] : null,
          ts: pts.length ? pts[pts.length - 1][0] : null,
        });
      });
  });

  // Cache entre painéis: cada painel tem sua janela (1 h, 24 h, 30 dias); o modal aberto por
  // qualquer um deles usa o valor mais recente que algum painel já recebeu.
  const cache = (window.__opsCache = window.__opsCache || {});
  metricas.forEach((m) => {
    const k = `${m.host}|${m.key}`;
    const ant = cache[k];
    if (m.ts && (!ant || ant.ts <= m.ts)) {
      cache[k] = m;
    }
  });
  const nomeHost = (h) => (H[h] ? H[h].nome : h);
  const met = (h, key) => metricas.find((m) => m.host === nomeHost(h) && m.key === key && m.ult !== null) || cache[`${nomeHost(h)}|${key}`];
  const ult = (h, key) => {
    const m = met(h, key);
    return m ? m.ult : null;
  };
  const doHost = (h) => {
    const locais = metricas.filter((m) => m.host === nomeHost(h));
    const chaves = new Set(locais.map((m) => m.key));
    return locais.concat(Object.values(cache).filter((m) => m.host === nomeHost(h) && !chaves.has(m.key)));
  };
  const temDados = () => metricas.length > 0;

  /* ---------- Problemas (triggers) ---------- */
  const SEV = ['Não classificada', 'Informação', 'Atenção', 'Média', 'Alta', 'Desastre'];
  const SEV_COR = ['#8a9bb0', '#4ea3ff', '#ffd166', '#ffb547', '#ff7a45', '#ff5468'];
  const problemas = problemasBrutos
    .map((p) => {
      const hs = p.hosts || [];
      return {
        sev: Number(p.severity !== undefined ? p.severity : p.priority || 0),
        nome: p.name || p.description || 'Problema',
        host: p.host || (hs[0] && hs[0].name) || '',
        hostTec: p.hostTechName || (hs[0] && hs[0].host) || '',
        ts: Number(p.timestamp || p.lastchange || 0) * 1000,
        ack: p.acknowledged === '1' || p.acknowledged === 1,
        id: p.eventid || p.triggerid,
      };
    })
    .sort((a, b) => b.sev - a.sev || b.ts - a.ts);
  const problemasDo = (h) => {
    if (!H[h]) {
      return [];
    }
    return problemas.filter((p) => p.host === H[h].nome || p.hostTec === H[h].tecnico);
  };

  /* ---------- Formatação ---------- */
  const esc = (s) =>
    String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const vazio = (v) => v === null || v === undefined || Number.isNaN(v);
  const num = (v, d = 1) => (vazio(v) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const bps = (v) => {
    if (vazio(v)) {
      return '—';
    }
    if (v >= 1e9) {
      return num(v / 1e9, 2) + ' Gbps';
    }
    if (v >= 1e6) {
      return num(v / 1e6, 1) + ' Mbps';
    }
    if (v >= 1e3) {
      return num(v / 1e3, 1) + ' Kbps';
    }
    return num(v, 0) + ' bps';
  };
  const bytes = (v) => {
    if (vazio(v)) {
      return '—';
    }
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let x = Number(v);
    while (x >= 1024 && i < u.length - 1) {
      x /= 1024;
      i++;
    }
    return num(x, i >= 3 ? 1 : 0) + ' ' + u[i];
  };
  const pct = (v, d = 1) => (vazio(v) ? '—' : num(v, d) + '%');
  const duracao = (s) => {
    if (vazio(s)) {
      return '—';
    }
    s = Math.floor(s);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
  };
  const dataHora = (ms) => (ms ? new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const fmt = (m) => {
    if (!m) {
      return '—';
    }
    const u = m.units || '';
    const v = m.ult;
    if (u === 'bps') {
      return bps(v);
    }
    if (u === 'B') {
      return bytes(v);
    }
    if (u === '%') {
      return pct(v);
    }
    if (u === 'uptime') {
      return duracao(v);
    }
    if (u === 'unixtime') {
      return dataHora(v * 1000);
    }
    if (u === 's') {
      return vazio(v) ? '—' : num(v * 1000, 1) + ' ms';
    }
    if (vazio(v)) {
      return '—';
    }
    const casas = Number.isInteger(v) ? 0 : 2;
    return num(v, casas) + (u ? ' ' + u.replace(/^!/, '') : '');
  };

  /* ---------- Faixas de cor (limiares) ---------- */
  const COR = { ok: '#2ee6a6', aviso: '#ffb547', ruim: '#ff5468', info: '#4ea3ff', mudo: '#5d6f84' };
  const faixa = (v, aviso, ruim) => (vazio(v) ? COR.mudo : v >= ruim ? COR.ruim : v >= aviso ? COR.aviso : COR.ok);

  /* ---------- Sparkline SVG ---------- */
  const spark = (m, cor = COR.ok, w = 120, h = 26, area = true) => {
    const pts = m && m.pts ? m.pts : [];
    if (pts.length < 2) {
      return `<svg class="ops-spark" width="${w}" height="${h}"></svg>`;
    }
    const ys = pts.map((p) => p[1]);
    const xs = pts.map((p) => p[0]);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const x0 = xs[0];
    const x1 = xs[xs.length - 1] || x0 + 1;
    const px = (x) => ((x - x0) / (x1 - x0 || 1)) * (w - 2) + 1;
    const py = (y) => h - 2 - ((y - y0) / (y1 - y0 || 1)) * (h - 4);
    const linha = pts.map((p) => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ');
    const preench = area ? `<polygon points="1,${h - 1} ${linha} ${w - 1},${h - 1}" fill="${cor}" opacity="0.12"/>` : '';
    return `<svg class="ops-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${preench}<polyline points="${linha}" fill="none" stroke="${cor}" stroke-width="1.4"/></svg>`;
  };

  /* ---------- Cards das colunas (barra de progresso e card com KPI) ---------- */
  const barra = (rot, v, aviso, ruim) =>
    `<div class="ops-barra"><span class="ops-rot">${rot}</span><span class="ops-barra-v">${pct(v)}</span>
      <div class="ops-barra-trilho"><div style="width:${Math.max(0, Math.min(100, v || 0))}%;background:${faixa(v, aviso, ruim)}"></div></div></div>`;

  const card = (id, cor, eyebrow, titulo, icone, grande, linhas, extra = '') =>
    `<div class="ops-card ops-clicavel" data-card="${id}" style="--c:${cor}" title="Abrir detalhes">
      <span class="ops-abrir">↗</span>
      <div class="ops-eyebrow">${eyebrow}</div>
      <div class="ops-kpi">
        <span class="ops-kpi-icone">${icone}</span>
        <span class="ops-card-titulo">${titulo}</span>
        <span class="ops-kpi-v" style="color:${cor}">${grande}</span>
      </div>
      ${linhas.map((l) => `<div class="ops-linha">${l}</div>`).join('')}
      ${extra}
    </div>`;

  // Card no padrão do exemplo: eyebrow, título, ícone + número grande, linhas e "ABRIR DETALHES"
  const card2 = (id, cor, eyebrow, titulo, icone, grande, linhas, extra = '') =>
    `<div class="ops-card ops-clicavel" data-card="${id}" style="--c:${cor}">
      <div class="ops-eyebrow">${eyebrow}</div>
      <div class="ops-card-titulo">${titulo}</div>
      <div class="ops-kpi2"><span class="ops-kpi-icone">${icone}</span><span class="ops-kpi-v" style="color:${cor}">${grande}</span></div>
      ${linhas.map((l) => `<div class="ops-linha">${l}</div>`).join('')}
      ${extra}
      <div class="ops-abrir2">ABRIR DETALHES ↗</div>
    </div>`;

  /* ---------- Topologia: nós, tráfego e status ---------- */
  const no = (id) => NOS.find((n) => n.id === id);

  // Tráfego do enlace pai -> nó, a partir das interfaces coletadas no host Proxmox.
  const trafego = (n) => {
    if (!n || !n.ifc) {
      return null;
    }
    const entra = met('pve', `net.if.in["${n.ifc}"]`);
    const sai = met('pve', `net.if.out["${n.ifc}"]`);
    if (!entra && !sai) {
      return null;
    }
    // Numa tap, o que o host "envia" é o que a VM baixa.
    const desce = n.desceEhSaida ? sai : entra;
    const sobe = n.desceEhSaida ? entra : sai;
    const recente = [desce, sobe].some((m) => m && m.ts && Date.now() - m.ts < CFG.recenteMs);
    return {
      desce,
      sobe,
      vDesce: desce ? desce.ult : null,
      vSobe: sobe ? sobe.ult : null,
      total: (desce && desce.ult ? desce.ult : 0) + (sobe && sobe.ult ? sobe.ult : 0),
      recente,
    };
  };

  // Estados: ok, trigger, down (agente fora), off (sem dados recentes), semcoleta (não monitorado)
  const statusNo = (n) => {
    if (n.semColeta) {
      return { estado: 'semcoleta', cor: COR.info, texto: 'SEM COLETA' };
    }
    const probs = n.zbx ? problemasDo(n.zbx) : [];
    if (probs.length) {
      const sev = Math.max(...probs.map((p) => p.sev));
      return { estado: 'trigger', cor: SEV_COR[sev] || COR.ruim, texto: `${probs.length} TRIGGER${probs.length > 1 ? 'S' : ''}`, sev, probs };
    }
    // Hosts de ping ICMP (WAN): 1 = responde, 0 = sem resposta
    if (n.ping) {
      const p = ult(n.ping, 'icmpping');
      if (p === 1) {
        return { estado: 'ok', cor: COR.ok, texto: 'ONLINE' };
      }
      if (p === 0) {
        return { estado: 'down', cor: COR.ruim, texto: 'SEM RESPOSTA' };
      }
    }
    if (n.zbx && H[n.zbx] && H[n.zbx].agente) {
      const a = ult(n.zbx, 'zabbix[host,agent,available]');
      if (a === 1) {
        return { estado: 'ok', cor: COR.ok, texto: 'ONLINE' };
      }
      if (a === 2) {
        return { estado: 'down', cor: COR.ruim, texto: 'AGENTE FORA' };
      }
    }
    // operstate: 6 = up; taps (tun/tap) ficam em 0 = "unknown" mesmo com a VM ligada
    const t = trafego(n);
    if (n.operstate) {
      const o = ult('pve', `vfs.file.contents["/sys/class/net/${n.operstate}/operstate"]`);
      if (o === 6 || (o === 0 && t && t.recente)) {
        return { estado: 'ok', cor: COR.ok, texto: 'ONLINE' };
      }
      if (o === 2 || o === 3 || o === 7) {
        return { estado: 'down', cor: COR.ruim, texto: 'DOWN' };
      }
    }
    if (t && t.recente) {
      return { estado: 'ok', cor: COR.ok, texto: 'ONLINE' };
    }
    if (t) {
      return { estado: 'off', cor: COR.mudo, texto: 'SEM DADOS' };
    }
    return { estado: 'off', cor: COR.mudo, texto: temDados() ? 'SEM DADOS' : 'AGUARDANDO' };
  };

  // "3,1 ms · 0% perda" a partir dos itens do template ICMP Ping
  const ping = (h) => {
    const lat = ult(h, 'icmppingsec');
    const perda = ult(h, 'icmppingloss');
    return { lat, perda, texto: lat === null ? '—' : `${num(lat * 1000, 1)} ms · ${pct(perda, 0)} perda` };
  };

  /* ---------- Modal (HTML5 + CSS), compartilhado por todos os painéis ---------- */
  const fecharModal = () => {
    const m = document.getElementById('ops-modal');
    if (m) {
      m.remove();
    }
    document.removeEventListener('keydown', escListener);
  };
  const escListener = (e) => {
    if (e.key === 'Escape') {
      fecharModal();
    }
  };
  // Modal grande com abas (eyebrow, título, subtítulo, abas e corpo rolável)
  const modal = (titulo, subtitulo, corpo, cor = COR.ok, abas = null, abaInicial = null) => {
    fecharModal();
    const m = document.createElement('div');
    m.id = 'ops-modal';
    const lista = abas || [{ id: 'unica', nome: '', html: corpo }];
    let atual = abaInicial && lista.find((a) => a.id === abaInicial) ? abaInicial : lista[0].id;
    const render = () => {
      const a = lista.find((x) => x.id === atual);
      m.innerHTML = `<div class="ops-modal-caixa" style="--c:${cor}">
          <div class="ops-modal-topo">
            <div><div class="ops-eyebrow ops-eyebrow-c">INFRAESTRUTURA · DETALHES</div><div class="ops-modal-titulo">${esc(titulo)}</div>
              <div class="ops-modal-sub">${esc(subtitulo)}</div></div>
            <button class="ops-btn ops-modal-x" title="Fechar (Esc)">✕</button>
          </div>
          ${abas ? `<div class="ops-abas">${lista.map((x) => `<button class="ops-aba${x.id === atual ? ' ops-aba-on' : ''}" data-aba="${x.id}">${esc(x.nome)}</button>`).join('')}</div>` : ''}
          <div class="ops-modal-corpo">${a.html}</div>
        </div>`;
    };
    render();
    m.addEventListener('click', (e) => {
      if (e.target === m || e.target.closest('.ops-modal-x')) {
        fecharModal();
        return;
      }
      const b = e.target.closest('[data-aba]');
      if (b) {
        atual = b.dataset.aba;
        render();
        return;
      }
      const sec = e.target.closest('.ops-sec-cab');
      if (sec) {
        sec.parentElement.classList.toggle('ops-sec-fechada');
      }
    });
    document.addEventListener('keydown', escListener);
    document.body.appendChild(m);
  };

  /* ---------- Blocos do modal ---------- */
  const tiles = (itens) =>
    `<div class="ops-tiles">${itens
      .filter(Boolean)
      .map(([r, v, c]) => `<div class="ops-tile"><span class="ops-rot">${esc(r)}</span><b${c ? ` style="color:${c}"` : ''}>${v}</b></div>`)
      .join('')}</div>`;
  const secao = (titulo, subtitulo, html, opts = {}) =>
    `<section class="ops-sec${opts.alerta ? ' ops-sec-alerta' : ''}${opts.fechada ? ' ops-sec-fechada' : ''}" ${opts.cor ? `style="--c:${opts.cor}"` : ''}>
      <div class="ops-sec-cab"><div><div class="ops-sec-titulo">${opts.recolhivel ? '▾ ' : ''}${esc(titulo)}</div>${subtitulo ? `<div class="ops-sec-sub">${esc(subtitulo)}</div>` : ''}</div>${opts.selo ? `<span class="ops-pill-s" style="--c:${opts.cor || COR.ok}">${esc(opts.selo)}</span>` : ''}</div>
      <div class="ops-sec-corpo">${html}</div></section>`;
  const grade = (cards, col = 3) => `<div class="ops-grade" style="--col:${col}">${cards.join('')}</div>`;
  const barraCard = (nome, v, texto, aviso = 80, ruim = 90) => {
    const c = faixa(v, aviso, ruim);
    return `<div class="ops-bcard"><div class="ops-bcard-l1"><b>${esc(nome)}</b><span style="color:${c}">${pct(v)}</span></div>
      <div class="ops-barra-trilho"><div style="width:${Math.max(0, Math.min(100, v || 0))}%;background:${c}"></div></div>
      <div class="ops-bcard-l2">${texto}</div></div>`;
  };
  const hostCard = (nome, subt, pill, corPill, kvs, rodape = '') =>
    `<div class="ops-hcard"><div class="ops-hcard-l1"><div><b>${esc(nome)}</b><div class="ops-hcard-sub">${esc(subt)}</div></div><span class="ops-pill-s" style="--c:${corPill}">${esc(pill)}</span></div>
      <div class="ops-hcard-kv">${kvs.map(([r, v]) => `<div><span class="ops-rot">${esc(r)}</span><b>${v}</b></div>`).join('')}</div>${rodape ? `<div class="ops-hcard-sub">${rodape}</div>` : ''}</div>`;

  const linhaMetrica = (m, cor) =>
    `<div class="ops-mrow"><span class="ops-mnome" title="${esc(m.key)}">${esc(m.item)}</span>${spark(m, cor, 160, 24)}<span class="ops-mval">${esc(fmt(m))}</span></div>`;

  const listaProblemas = (probs) =>
    probs.length
      ? probs
          .map(
            (p) =>
              `<div class="ops-prob" style="--c:${SEV_COR[p.sev]}"><span class="ops-sev">${SEV[p.sev]}</span><span class="ops-prob-nome"><b>${esc(p.host)}</b> — ${esc(p.nome)}</span><span class="ops-prob-ts">${dataHora(p.ts)}${p.ack ? ' · reconhecido' : ''}</span></div>`
          )
          .join('')
      : '<div class="ops-vazio">Nenhum trigger ativo.</div>';

  const links = (n) => {
    const out = [];
    const h = n.zbx && H[n.zbx];
    if (h && h.id) {
      out.push([`${CFG.zabbixUrl}/zabbix.php?action=latest.view&hostids%5B%5D=${h.id}`, 'Dados recentes no Zabbix']);
      out.push([`${CFG.zabbixUrl}/zabbix.php?action=problem.view&hostids%5B%5D=${h.id}`, 'Problemas no Zabbix']);
    }
    (n.links || []).forEach((l) => out.push(l));
    return out.length
      ? `<div class="ops-links">${out.map(([u, t]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join('')}</div>`
      : '';
  };
  const pill = (s) => [s.texto, s.cor];

  // Detalhes de um nó (VM, LXC, equipamento): abas Visão geral / Métricas
  const abrirNo = (id) => {
    const n = no(id);
    if (!n) {
      return;
    }
    if (id === 'pve') {
      abrirProxmox('virtualizacao');
      return;
    }
    const s = statusNo(n);
    const t = trafego(n);
    const h = n.zbx && H[n.zbx] && H[n.zbx].agente ? n.zbx : null;
    let geral = tiles([
      ['STATUS', `● ${s.texto}`, s.cor],
      ['ENDEREÇO', esc(n.ip || '—')],
      ['TIPO', esc(n.tipoTexto || n.tipo)],
      ['INTERFACE', esc(n.ifc || '—')],
      t ? ['↓ DOWNLOAD', bps(t.vDesce)] : null,
      t ? ['↑ UPLOAD', bps(t.vSobe)] : null,
      h ? ['CPU', pct(ult(h, 'system.cpu.util')), faixa(ult(h, 'system.cpu.util'), 80, 90)] : null,
      h ? ['MEMÓRIA', pct(ult(h, 'vm.memory.util')), faixa(ult(h, 'vm.memory.util'), 80, 90)] : null,
      h ? ['UPTIME', duracao(ult(h, 'system.uptime'))] : null,
      n.ping ? ['LATÊNCIA', ping(n.ping).lat === null ? '—' : `${num(ping(n.ping).lat * 1000, 1)} ms`, faixa((ping(n.ping).lat || 0) * 1000, 50, 150)] : null,
      n.ping ? ['PERDA', pct(ping(n.ping).perda, 0), faixa(ping(n.ping).perda, 5, 20)] : null,
      n.ping2 ? [`LATÊNCIA ${H[n.ping2].nome.split(' ').pop()}`, ping(n.ping2).lat === null ? '—' : `${num(ping(n.ping2).lat * 1000, 1)} ms`] : null,
    ]);
    if (n.descricao) {
      geral += `<p class="ops-desc">${esc(n.descricao)}</p>`;
    }
    if (n.zbx) {
      const ps = problemasDo(n.zbx);
      geral += secao('Triggers ativos', 'Problemas abertos no Zabbix para este host.', listaProblemas(ps), ps.length ? { alerta: true, cor: s.cor, selo: `${ps.length} ativo${ps.length > 1 ? 's' : ''}` } : {});
    }
    if (t) {
      geral += secao('Tráfego do enlace', `Medido na interface ${n.ifc} do Proxmox (sentido da VM).`,
        `<div class="ops-mrow"><span class="ops-mnome">↓ Download</span>${spark(t.desce, COR.ok, 300, 40)}<span class="ops-mval">${bps(t.vDesce)}</span></div>
         <div class="ops-mrow"><span class="ops-mnome">↑ Upload</span>${spark(t.sobe, COR.info, 300, 40)}<span class="ops-mval">${bps(t.vSobe)}</span></div>`);
    }
    if (n.semColeta) {
      geral += secao('Sem coleta', '', `<div class="ops-vazio">Este nó não é monitorado pelo Zabbix hoje. ${n.tipo === 'lxc' ? 'O template do Proxmox só descobre as interfaces tap das VMs, não as veth dos contêineres; instale o agente no LXC para ter métricas.' : ''}</div>`);
    }
    geral += links(n);
    const abas = [{ id: 'geral', nome: 'Visão geral', html: geral }];
    if (n.zbx) {
      const ms = doHost(n.zbx).filter((m) => !/dropped|errors|discarded|fwbr|fwln|fwpr|^net\.if\.(in|out)\["tap|docker\.(container|networks)/.test(m.key));
      abas.push({
        id: 'metricas',
        nome: `Métricas · ${ms.length}`,
        html: ms.length
          ? secao('Itens coletados', 'Último valor e evolução no período do painel.', `<div class="ops-mlista">${ms.sort((a, b) => a.item.localeCompare(b.item)).map((m) => linhaMetrica(m, COR.ok)).join('')}</div>`)
          : '<div class="ops-vazio">Sem métricas visíveis para este host no período. Confira a permissão do usuário <b>grafana-ro</b>.</div>',
      });
    }
    modal(n.nome, `${n.tipoTexto || ''}${n.ip ? ' · ' + n.ip : ''}`, '', s.cor, abas);
  };

  // Painel completo do host Proxmox, com abas (como "Virtualização · CLUSTER / Storage / Banco" do exemplo)
  const abrirProxmox = (aba = 'virtualizacao') => {
    const P = 'pve';
    const vms = NOS.filter((x) => x.tipo === 'vm');
    const lxcs = NOS.filter((x) => x.tipo === 'lxc');
    const up = vms.filter((x) => ['ok', 'trigger'].includes(statusNo(x).estado)).length;
    const memPct = ult(P, 'vm.memory.util');
    const memTot = ult(P, 'vm.memory.size[total]');
    const memDisp = ult(P, 'vm.memory.size[available]');
    const corMem = faixa(memPct, 80, 90);

    // --- Virtualização
    let virt = tiles([
      ['VMS ATIVAS', `${up} / ${vms.length}`, up === vms.length ? COR.ok : COR.aviso],
      ['CONTÊINERES LXC', `${lxcs.length}`],
      ['vCPU', num(ult(P, 'system.cpu.num'), 0)],
      ['CPU DO HOST', pct(ult(P, 'system.cpu.util')), faixa(ult(P, 'system.cpu.util'), 80, 90)],
      ['LOAD (1 MIN)', num(ult(P, 'system.cpu.load[all,avg1]'), 2)],
      ['UPTIME', duracao(ult(P, 'system.uptime'))],
    ]);
    virt += secao(
      'Memória do host',
      `${bytes(memTot !== null && memDisp !== null ? memTot - memDisp : null)} usados de ${bytes(memTot)} · todas as VMs dividem esta RAM`,
      tiles([
        ['RAM EM USO', bytes(memTot !== null && memDisp !== null ? memTot - memDisp : null)],
        ['CAPACIDADE TOTAL', bytes(memTot)],
        ['DISPONÍVEL', bytes(memDisp)],
        ['OCUPAÇÃO', pct(memPct), corMem],
      ]) +
        `<div class="ops-barra-trilho ops-barra-grossa"><div style="width:${Math.min(100, memPct || 0)}%;background:${corMem}"></div></div>` +
        (memPct >= 80 ? `<div class="ops-aviso-txt" style="color:${corMem}">${memPct >= 90 ? 'CRÍTICO' : 'ATENÇÃO'}: a memória do host passou de ${memPct >= 90 ? 90 : 80}%; novas VMs ou picos podem forçar swap.</div>` : '') +
        `<div class="ops-hcard-sub">Swap livre ${pct(ult(P, 'system.swap.size[,pfree]'), 0)} · atualizado a cada coleta do Zabbix.</div>`,
      { alerta: memPct >= 90, cor: corMem, selo: memPct >= 90 ? 'CRÍTICO' : memPct >= 80 ? 'ATENÇÃO' : 'OK' }
    );
    virt += secao(
      `Máquinas virtuais · ${vms.length}`,
      'Status pela interface tap no Proxmox; CPU e RAM quando a VM tem agente Zabbix.',
      grade(
        vms.map((v) => {
          const s = statusNo(v);
          const t = trafego(v);
          const h = v.zbx && H[v.zbx] && H[v.zbx].agente ? v.zbx : null;
          return hostCard(v.nome, `${v.ip} · ${v.ifc}`, s.estado === 'ok' ? 'ATIVA' : s.texto, s.cor, [
            ['↓ DOWNLOAD', bps(t && t.vDesce)],
            ['↑ UPLOAD', bps(t && t.vSobe)],
            ['CPU', h ? pct(ult(h, 'system.cpu.util')) : '—'],
            ['RAM', h ? pct(ult(h, 'vm.memory.util')) : '—'],
          ], h ? 'Agente Zabbix ativo' : 'Sem agente Zabbix (só tráfego)');
        })
      )
    );
    virt += secao(
      `Contêineres LXC · ${lxcs.length}`,
      'Interfaces veth não são coletadas pelo template do Proxmox.',
      grade(lxcs.map((v) => hostCard(v.nome, v.ip, 'SEM COLETA', COR.info, [['TIPO', 'LXC'], ['REDE', 'vmbr0']], esc(v.descricao || ''))))
    );
    virt += secao(
      'Interfaces do host',
      'Placas físicas e bridge do Proxmox.',
      grade(
        CFG.interfaces.map((c) => {
          const o = ult(P, `vfs.file.contents["/sys/class/net/${c.ifc}/operstate"]`);
          const okIf = o === 6;
          return hostCard(c.titulo, c.ifc, okIf ? 'UP' : o === 2 ? 'DOWN' : '—', okIf ? COR.ok : COR.mudo, [
            ['↓ DOWNLOAD', bps(ult(P, `net.if.in["${c.ifc}"]`))],
            ['↑ UPLOAD', bps(ult(P, `net.if.out["${c.ifc}"]`))],
            ['VELOCIDADE', bps(ult(P, `vfs.file.contents["/sys/class/net/${c.ifc}/speed"]`))],
            ['ERROS', num((ult(P, `net.if.in["${c.ifc}",errors]`) || 0) + (ult(P, `net.if.out["${c.ifc}",errors]`) || 0), 0)],
          ], esc(c.nota || ''));
        })
      )
    );

    // --- Storage
    const util = ult(P, 'vfs.dev.util[nvme0n1]');
    const temps = [
      ['CPU (pacote)', ult(P, 'aiops.hwtemp[coretemp,Package id 0]'), 80, 90],
      ['Chipset (PCH)', ult(P, 'aiops.hwtemp[pch_cannonlake,temp1]'), 75, 85],
      ['NVMe', ult(P, 'aiops.hwtemp[nvme,temp1]'), 60, 70],
    ];
    let sto = tiles([
      ['UTILIZAÇÃO', pct(util), faixa(util, 80, 90)],
      ['FILA MÉDIA', num(ult(P, 'vfs.dev.queue_size[nvme0n1]'), 1)],
      ['LATÊNCIA LEITURA', num(ult(P, 'vfs.dev.read.await[nvme0n1]'), 2) + ' ms'],
      ['LATÊNCIA ESCRITA', num(ult(P, 'vfs.dev.write.await[nvme0n1]'), 2) + ' ms'],
      ['FS / USADO', pct(ult(P, 'vfs.fs.dependent.size[/,pused]')), faixa(ult(P, 'vfs.fs.dependent.size[/,pused]'), 80, 90)],
      ['TEMPERATURA NVMe', temps[2][1] === null ? '—' : num(temps[2][1], 0) + ' °C', faixa(temps[2][1], 60, 70)],
    ]);
    sto += secao(
      'Sistemas de arquivos · 3',
      'Uso, capacidade total e espaço livre.',
      grade(
        [
          ['Proxmox · /', P, 'vfs.fs.dependent.size[/,pused]', 'vfs.fs.dependent.size[/,free]', 'vfs.fs.dependent.size[/,total]'],
          ['VM 100 · /hostfs', 'vm100', 'vfs.fs.dependent.size[/hostfs,pused]', 'vfs.fs.dependent.size[/hostfs,free]', 'vfs.fs.dependent.size[/hostfs,total]'],
          ['VM 130 · /', 'vm130', 'vfs.fs.dependent.size[/,pused]', 'vfs.fs.dependent.size[/,free]', 'vfs.fs.dependent.size[/,total]'],
        ].map(([nome, h, kp, kf, kt]) => barraCard(nome, ult(h, kp), `${bytes(ult(h, kf))} livres · ${bytes(ult(h, kt))} total`)),
        2
      )
    );
    sto += secao(
      `Sensores de temperatura · ${temps.length}`,
      'lm-sensors no host Proxmox (item aiops.hwtemp).',
      grade(
        temps.map(([nome, v, a, r]) => {
          const c = faixa(v, a, r);
          return hostCard(nome, `alerta ${a} °C · crítico ${r} °C`, v === null ? '—' : v >= r ? 'CRÍTICO' : v >= a ? 'ATENÇÃO' : 'OK', c, [['ATUAL', v === null ? '—' : `${num(v, 0)} °C`]]);
        })
      )
    );
    sto += secao(
      'Desempenho do disco · nvme0n1',
      'Evolução no período consultado.',
      `<div class="ops-mlista">${['vfs.dev.util[nvme0n1]', 'vfs.dev.read.await[nvme0n1]', 'vfs.dev.write.await[nvme0n1]', 'vfs.dev.read.rate[nvme0n1]', 'vfs.dev.write.rate[nvme0n1]', 'vfs.dev.queue_size[nvme0n1]']
        .map((k) => met(P, k))
        .filter(Boolean)
        .map((m) => linhaMetrica(m, COR.ok))
        .join('')}</div>`,
      { recolhivel: true }
    );

    // --- Aplicações
    const ctrs = [...new Set(doHost('vm130').filter((m) => /^docker\.container_info\.state\.running\[/.test(m.key)).map((m) => m.key.match(/"\/([^"]+)"/)[1]))];
    const cert = ult('vm130', 'cert.not_after');
    const certDias = cert !== null ? Math.floor((cert * 1000 - Date.now()) / 86400000) : null;
    let app = tiles([
      ['CONTAINERS', ult('vm130', 'docker.containers.total') === null ? '—' : `${num(ult('vm130', 'docker.containers.running'), 0)} / ${num(ult('vm130', 'docker.containers.total'), 0)}`],
      ['REQUISIÇÕES', num(ult('vm130', 'apm.requisicoes.min'), 0) + ' /min'],
      ['LATÊNCIA P95', ult('vm130', 'apm.latencia.p95') === null ? '—' : num(ult('vm130', 'apm.latencia.p95') * 1000, 0) + ' ms'],
      ['ERROS', ult('vm130', 'apm.erros.min') === null ? '—' : num(ult('vm130', 'apm.erros.min'), 0) + ' /min', ult('vm130', 'apm.erros.min') > 0 ? COR.ruim : null],
      ['CERTIFICADO TLS', certDias === null ? '—' : `${certDias} dias`, certDias !== null && certDias < 15 ? COR.ruim : null],
    ]);
    app += secao(
      `Containers · Sistema de Metas (VM 130) · ${ctrs.length}`,
      'Template Docker do Zabbix (agent2).',
      grade(
        ctrs.map((c) => {
          const k = (p) => ult('vm130', `${p}["/${c}"]`);
          const run = k('docker.container_info.state.running') === 1;
          return hostCard(c, 'docker · VM 130', run ? 'RUNNING' : 'PARADO', run ? COR.ok : COR.ruim, [
            ['CPU', pct(k('docker.container_stats.cpu_pct_usage'), 2)],
            ['RAM', bytes(k('docker.container_stats.memory.usage_total'))],
            ['TX', bytes(k('docker.networks.tx_bytes')) + '/s'],
            ['RESTARTS', num(k('docker.container_info.restart_count'), 0)],
          ]);
        })
      )
    );
    app += secao(
      'Stack de observabilidade · VM 100',
      'Zabbix 8, Grafana, Uptime Kuma, SysPass, ClickHouse e OTel.',
      grade([
        barraCard('CPU', ult('vm100', 'system.cpu.util'), 'VM 100 · zabbixgrafana'),
        barraCard('Memória', ult('vm100', 'vm.memory.util'), `${bytes(ult('vm100', 'vm.memory.size[available]'))} disponíveis`),
        barraCard('Disco /hostfs', ult('vm100', 'vfs.fs.dependent.size[/hostfs,pused]'), `${bytes(ult('vm100', 'vfs.fs.dependent.size[/hostfs,free]'))} livres`),
      ])
    );

    // --- Segurança
    const ps = problemas.filter((p) => p.host === H.secops.nome || /secops|wazuh/i.test(p.nome));
    const tot = met('secops', 'secops.findings.total');
    let seg = tiles([
      ['FINDINGS (ÚLTIMO SCAN)', tot ? num(tot.ult, 0) : '—'],
      ['ALTA / CRÍTICA', num(ult('secops', 'secops.findings.high'), 0), ult('secops', 'secops.findings.high') > 0 ? COR.ruim : null],
      ['CONFIRMADOS', num(ult('secops', 'secops.findings.confirmados'), 0)],
      ['ALERTAS DO SCAN', num(ult('secops', 'secops.alertas.total'), 0)],
      ['ÚLTIMO SCAN', tot && tot.ts ? dataHora(tot.ts) : '—'],
    ]);
    seg += secao('Triggers de segurança', '', listaProblemas(ps), ps.length ? { alerta: true, cor: SEV_COR[ps[0].sev], selo: `${ps.length} ativo${ps.length > 1 ? 's' : ''}` } : {});
    seg += secao(
      'Serviços',
      'SIEM e laboratório de varredura.',
      grade(
        ['vm105', 'vm106'].map((id) => {
          const v = no(id);
          const s = statusNo(v);
          const t = trafego(v);
          return hostCard(v.nome, `${v.ip} · ${v.ifc}`, s.estado === 'ok' ? 'ATIVA' : s.texto, s.cor, [['↓ DOWNLOAD', bps(t && t.vDesce)], ['↑ UPLOAD', bps(t && t.vSobe)]], esc(v.descricao || ''));
        }),
        2
      ) + `<div class="ops-links"><a href="/d/secops-superficie-risco" target="_blank">Dashboard SecOps ↗</a><a href="/d/wazuh-visao-geral" target="_blank">Dashboard Wazuh ↗</a><a href="http://wazuh.lan" target="_blank">Wazuh ↗</a></div>`
    );

    const abas = [
      { id: 'virtualizacao', nome: 'Virtualização · PROXMOX', html: virt },
      { id: 'storage', nome: 'Storage · NVMe', html: sto },
      { id: 'aplicacoes', nome: 'Aplicações', html: app },
      { id: 'seguranca', nome: 'Segurança', html: seg },
    ];
    const sPve = statusNo(no('pve'));
    modal('Proxmox · luis', 'HP ZBook 17 G5 · Proxmox VE 9 · 192.168.1.100', '', aba === 'seguranca' && ps.length ? SEV_COR[ps[0].sev] : sPve.cor, abas, aba);
  };

  // Detalhes de uma lista de métricas avulsas (cards)
  const abrirMetricas = (titulo, subtitulo, ms, cor = COR.ok, extra = '') => {
    const validas = ms.filter(Boolean);
    const corpo =
      secao(titulo, 'Último valor e evolução no período.', validas.length ? `<div class="ops-mlista">${validas.map((m) => linhaMetrica(m, cor)).join('')}</div>` : '<div class="ops-vazio">Sem dados no período.</div>') + extra;
    modal(titulo, subtitulo, corpo, cor);
  };

  /* ---------- Variável de caminho (seleção de nó) ---------- */
  const ls = context.grafana.locationService;
  const caminhoAtual = () => {
    const q = ls.getSearchObject ? ls.getSearchObject() : {};
    const v = q['var-caminho'];
    return (Array.isArray(v) ? v[0] : v) || 'todos';
  };
  const selecionar = (id) => ls.partial({ 'var-caminho': id || 'todos' }, true);

  // Exposto para diagnóstico pelo console do navegador: window.__opsDebug
  window.__opsDebug = { metricas, problemas, frames };

  return {
    CFG, H, NOS, COR, SEV, SEV_COR, metricas, problemas, met, ult, doHost, temDados, problemasDo,
    esc, num, bps, bytes, pct, duracao, dataHora, fmt, faixa, spark, no, trafego, statusNo,
    modal, abrirNo, abrirProxmox, abrirMetricas, listaProblemas, caminhoAtual, selecionar, tiles, secao,
    barra, card, card2, ping,
  };
})();
