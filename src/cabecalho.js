// ===== Cabeçalho (Business Text): status de triggers, título e controles do mapa =====
const el = context.element;
const probs = OPS.problemas;
const carregando = !OPS.temDados() && !probs.length;
const pior = probs.length ? Math.max(...probs.map((p) => p.sev)) : -1;
const cor = pior >= 0 ? OPS.SEV_COR[pior] : OPS.COR.ok;
const textoStatus = carregando
  ? 'AGUARDANDO DADOS'
  : probs.length
    ? `${probs.length} TRIGGER${probs.length > 1 ? 'S' : ''} ATIVO${probs.length > 1 ? 'S' : ''}`
    : 'SEM TRIGGERS ATIVAS';
const detalhe = (window.__opsMapa || { detalhe: true }).detalhe;

el.innerHTML = `<div class="ops-cab">
    <div class="ops-cab-esq">
      <button class="ops-pill" data-acao="alertas" style="--c:${carregando ? OPS.COR.mudo : cor}"><i></i>${textoStatus}</button>
      <span class="ops-cab-hora">${OPS.dataHora(Date.now())}</span>
    </div>
    <div class="ops-cab-centro">
      <div class="ops-eyebrow">OPERAÇÕES</div>
      <div class="ops-cab-titulo">Infraestrutura</div>
      <div class="ops-cab-sub">Rede, virtualização, storage e serviços · homelab Proxmox</div>
    </div>
    <div class="ops-cab-dir">
      <button class="ops-btn" data-acao="detalhe">${detalhe ? 'Menos detalhes' : 'Mais detalhes'}</button>
      <button class="ops-btn ops-btn-q" data-acao="menos" title="Afastar">−</button>
      <button class="ops-btn ops-btn-q" data-acao="mais" title="Aproximar">+</button>
      <button class="ops-btn" data-acao="reset">Reset</button>
    </div>
  </div>`;

const disparar = (nome, detail) => window.dispatchEvent(new CustomEvent(nome, { detail }));
el.querySelector('[data-acao="detalhe"]').onclick = (e) => {
  disparar('ops:detalhe');
  const agora = (window.__opsMapa || {}).detalhe;
  e.target.textContent = agora ? 'Menos detalhes' : 'Mais detalhes';
};
el.querySelector('[data-acao="menos"]').onclick = () => disparar('ops:zoom', -0.5);
el.querySelector('[data-acao="mais"]').onclick = () => disparar('ops:zoom', 0.5);
el.querySelector('[data-acao="reset"]').onclick = () => disparar('ops:zoom', 'reset');
el.querySelector('[data-acao="alertas"]').onclick = () =>
  OPS.modal('Triggers ativos', 'ALERTAS', OPS.listaProblemas(probs), probs.length ? cor : OPS.COR.ok);
