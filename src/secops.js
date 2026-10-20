// ===== Card "SecOps Lab" (Business Text, painel próprio) =====
// Os itens do secops-lab são trapper e só recebem valor quando um scan roda; por isso
// este painel consulta 30 dias e mostra o resultado do último scan, não da janela do dashboard.
const el = context.element;
const u = (k) => OPS.ult('secops', k);
const total = OPS.met('secops', 'secops.findings.total');
const altas = u('secops.findings.high');
const s = OPS.statusNo(OPS.no('vm106'));
const cor = altas > 0 ? OPS.COR.ruim : s.estado === 'trigger' ? s.cor : total ? OPS.COR.ok : OPS.COR.mudo;
const quando = total && total.ts ? OPS.dataHora(total.ts) : 'sem envio em 30 dias';

el.innerHTML = `<div class="ops-col ops-col-solo">
  ${OPS.card2('sec', cor, `Segurança · SecOps Lab · último scan ${quando}`, 'FINDINGS NO ÚLTIMO SCAN', '⛨', total ? OPS.num(total.ult, 0) : '—', [
    `Alta/crítica ${OPS.num(altas, 0)} · confirmados ${OPS.num(u('secops.findings.confirmados'), 0)} · alertas ${OPS.num(u('secops.alertas.total'), 0)}`,
  ])}
</div>`;

el.querySelector('[data-card="sec"]').onclick = () => OPS.abrirProxmox('seguranca');
