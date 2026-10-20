// ===== Faixa de alertas (Business Text): triggers ativos rolando no rodapé =====
const el = context.element;
const probs = OPS.problemas;
const itens = probs.length
  ? probs
      .map(
        (p) =>
          `<span class="ops-tick" style="--c:${OPS.SEV_COR[p.sev]}"><span class="ops-sev">${OPS.SEV[p.sev]}</span><b>${OPS.esc(p.host)}</b> — ${OPS.esc(p.nome)}<em>${OPS.dataHora(p.ts)}</em></span>`
      )
      .join('<span class="ops-tick-sep">◆</span>')
  : `<span class="ops-tick" style="--c:${OPS.COR.ok}"><span class="ops-sev">OK</span>Nenhum trigger ativo nos hosts monitorados</span>`;
const pausado = !!window.__opsTickerPausado;
// Duplica o conteúdo para a rolagem contínua; a duração acompanha o tamanho do texto
const dur = Math.max(25, probs.length * 9);

el.innerHTML = `<div class="ops-ticker">
    <span class="ops-ticker-rot">ALERTAS · ${probs.length}</span>
    <div class="ops-ticker-janela"><div class="ops-ticker-faixa${probs.length ? '' : ' ops-parado'}" style="animation-duration:${dur}s;animation-play-state:${pausado ? 'paused' : 'running'}">${itens}${probs.length ? '<span class="ops-tick-sep">◆</span>' + itens : ''}</div></div>
    <button class="ops-btn ops-btn-q" data-acao="pausa" title="Pausar/continuar">${pausado ? '▶' : '❚❚'}</button>
  </div>`;

el.querySelector('[data-acao="pausa"]').onclick = (e) => {
  window.__opsTickerPausado = !window.__opsTickerPausado;
  el.querySelector('.ops-ticker-faixa').style.animationPlayState = window.__opsTickerPausado ? 'paused' : 'running';
  e.target.textContent = window.__opsTickerPausado ? '▶' : '❚❚';
};
el.querySelector('.ops-ticker-janela').onclick = () => OPS.modal('Triggers ativos', 'ALERTAS', OPS.listaProblemas(probs));
