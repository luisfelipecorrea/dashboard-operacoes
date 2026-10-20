// ===== Coluna "Conectividade" (Business Text): interfaces físicas do Proxmox e tráfego por VM =====
const el = context.element;

const statusIfc = (ifc) => {
  const o = OPS.ult('pve', `vfs.file.contents["/sys/class/net/${ifc}/operstate"]`);
  if (o === 6) {
    return { cor: OPS.COR.ok, texto: 'ONLINE' };
  }
  if (o === 2) {
    return { cor: OPS.COR.mudo, texto: 'DESCONECTADA' };
  }
  if (o === null) {
    return { cor: OPS.COR.mudo, texto: OPS.temDados() ? 'SEM DADOS' : 'AGUARDANDO' };
  }
  return { cor: OPS.COR.aviso, texto: 'DEGRADADA' };
};

const cardIfc = (c) => {
  const s = statusIfc(c.ifc);
  const dn = OPS.met('pve', `net.if.in["${c.ifc}"]`);
  const up = OPS.met('pve', `net.if.out["${c.ifc}"]`);
  const err = ['in', 'out'].reduce((a, d) => a + (OPS.ult('pve', `net.if.${d}["${c.ifc}",errors]`) || 0), 0);
  const drop = ['in', 'out'].reduce((a, d) => a + (OPS.ult('pve', `net.if.${d}["${c.ifc}",dropped]`) || 0), 0);
  // Latência/perda vêm dos itens ICMP do host de ping configurado para a interface (se existir)
  const lat = c.ping ? OPS.ult(c.ping, 'icmppingsec') : null;
  const perda = c.ping ? OPS.ult(c.ping, 'icmppingloss') : null;
  const q = c.ping
    ? [['LATÊNCIA', lat === null ? '—' : `${OPS.num(lat * 1000, 1)} ms`, lat > 0.1], ['PERDA', perda === null ? '—' : OPS.pct(perda, 2), perda > 0]]
    : [['ERROS', OPS.num(err, 0), err > 0], ['DESCARTES', OPS.num(drop, 0), drop > 0]];
  return `<div class="ops-card ops-clicavel" data-ifc="${c.ifc}" style="--c:${s.cor}">
      <div class="ops-card-topo"><span class="ops-card-titulo">${c.titulo}</span><span class="ops-porta">${c.ifc}</span></div>
      <div class="ops-status" style="color:${s.cor}">● ${s.texto}</div>
      <div class="ops-grade2">
        <div><span class="ops-rot">↓ DOWNLOAD</span><b>${OPS.bps(dn && dn.ult)}</b></div>
        <div><span class="ops-rot">↑ UPLOAD</span><b>${OPS.bps(up && up.ult)}</b></div>
        ${q.map(([r, v, mal]) => `<div><span class="ops-rot">${r}</span><b class="${mal ? 'ops-aviso' : ''}">${v}</b></div>`).join('')}
      </div>
    </div>`;
};

const vms = OPS.NOS.filter((n) => n.ifc && n.ifc.startsWith('tap'));
const linhasVm = vms
  .map((n) => {
    const s = OPS.statusNo(n);
    const t = OPS.trafego(n);
    const sel = OPS.caminhoAtual() === n.id ? ' ops-sel' : '';
    return `<div class="ops-vm${sel}" data-no="${n.id}" title="${OPS.esc(n.nome)} — clique: caminho no mapa · duplo clique: detalhes">
        <span class="ops-vm-nome"><i style="background:${s.cor}"></i>${OPS.esc(n.nome)}</span>
        <span class="ops-vm-tx"><em>↓</em>${OPS.bps(t && t.vDesce)}</span><span class="ops-vm-tx"><em>↑</em>${OPS.bps(t && t.vSobe)}</span>
      </div>`;
  })
  .join('');

// Card da internet (como os "LINK INTERNET" do exemplo): tráfego da nic0 + ICMP para 1.1.1.1 e 8.8.8.8
const cardWan = () => {
  const p1 = OPS.ping('cf');
  const p2 = OPS.ping('gg');
  const ok = OPS.ult('cf', 'icmpping');
  const cor = ok === 1 ? (p1.perda > 0 ? OPS.COR.aviso : OPS.COR.ok) : ok === 0 ? OPS.COR.ruim : OPS.COR.mudo;
  const txt = ok === 1 ? 'ONLINE' : ok === 0 ? 'SEM RESPOSTA' : OPS.temDados() ? 'SEM DADOS' : 'AGUARDANDO';
  const lat = (p) => (p.lat === null ? '—' : `${OPS.num(p.lat * 1000, 1)} ms`);
  return `<div class="ops-card ops-clicavel" data-wan="1" style="--c:${cor}">
      <div class="ops-card-topo"><span class="ops-card-titulo">Link internet · WAN</span><span class="ops-porta">1.1.1.1</span></div>
      <div class="ops-status" style="color:${cor}">● ${txt}</div>
      <div class="ops-grade2">
        <div><span class="ops-rot">↓ DOWNLOAD</span><b>${OPS.bps(OPS.ult('pve', 'net.if.in["nic0"]'))}</b></div>
        <div><span class="ops-rot">↑ UPLOAD</span><b>${OPS.bps(OPS.ult('pve', 'net.if.out["nic0"]'))}</b></div>
        <div><span class="ops-rot">LATÊNCIA</span><b class="${p1.lat > 0.15 ? 'ops-aviso' : ''}">${lat(p1)}</b></div>
        <div><span class="ops-rot">PERDA</span><b class="${p1.perda > 0 ? 'ops-aviso' : ''}">${OPS.pct(p1.perda, 2)}</b></div>
        <div><span class="ops-rot">8.8.8.8</span><b>${lat(p2)}</b></div>
        <div><span class="ops-rot">PERDA</span><b class="${p2.perda > 0 ? 'ops-aviso' : ''}">${OPS.pct(p2.perda, 2)}</b></div>
      </div>
    </div>`;
};

el.innerHTML = `<div class="ops-col">
    <div class="ops-col-titulo ops-eyebrow">CONECTIVIDADE</div>
    ${cardWan()}
    ${OPS.CFG.interfaces.filter((c) => c.ifc !== 'wlp0s20f3').map(cardIfc).join('')}
    <div class="ops-card" style="--c:${OPS.COR.ok}">
      <div class="ops-card-topo"><span class="ops-card-titulo">VMs · vmbr0</span><span class="ops-porta">${vms.length} taps</span></div>
      <div class="ops-vm ops-vm-cab"><span class="ops-rot">VM</span><span class="ops-rot">↓ DOWNLOAD</span><span class="ops-rot">↑ UPLOAD</span></div>
      ${linhasVm}
    </div>
  </div>`;

el.querySelectorAll('[data-ifc]').forEach((card) => {
  card.onclick = () => {
    const ifc = card.dataset.ifc;
    const c = OPS.CFG.interfaces.find((x) => x.ifc === ifc);
    const ms = [
      OPS.met('pve', `net.if.in["${ifc}"]`),
      OPS.met('pve', `net.if.out["${ifc}"]`),
      OPS.met('pve', `net.if.in["${ifc}",errors]`),
      OPS.met('pve', `net.if.out["${ifc}",errors]`),
      OPS.met('pve', `net.if.in["${ifc}",dropped]`),
      OPS.met('pve', `net.if.out["${ifc}",dropped]`),
    ];
    OPS.abrirMetricas(c.titulo, `INTERFACE ${ifc} · PROXMOX`, ms, statusIfc(ifc).cor, c.nota ? `<p class="ops-desc">${OPS.esc(c.nota)}</p>` : '');
  };
});
el.querySelector('[data-wan]').onclick = () => OPS.abrirNo('internet');
el.querySelectorAll('[data-no]').forEach((linha) => {
  linha.onclick = () => OPS.selecionar(OPS.caminhoAtual() === linha.dataset.no ? 'todos' : linha.dataset.no);
  linha.ondblclick = () => OPS.abrirNo(linha.dataset.no);
});

// Mantém o destaque da VM selecionada em sincronia com o mapa
const marcar = () =>
  el.querySelectorAll('[data-no]').forEach((l) => l.classList.toggle('ops-sel', l.dataset.no === OPS.caminhoAtual()));
return context.grafana.locationService.getHistory().listen(marcar);
