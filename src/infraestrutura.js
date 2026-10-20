// ===== Coluna "Infraestrutura" (Business Text): virtualização, memória, storage, hardware e serviços =====
const el = context.element;
const P = 'pve';
const m = (h, k) => OPS.met(h, k);
const u = (h, k) => OPS.ult(h, k);

// VMs em execução = taps ativas no Proxmox (status do nó no mapa)
const vms = OPS.NOS.filter((n) => n.ifc && n.ifc.startsWith('tap'));
const vmsUp = vms.filter((n) => ['ok', 'trigger'].includes(OPS.statusNo(n).estado)).length;

const memTot = u(P, 'vm.memory.size[total]');
const memDisp = u(P, 'vm.memory.size[available]');
const memPct = u(P, 'vm.memory.util');
const fsPct = u(P, 'vfs.fs.dependent.size[/,pused]');
const nvme = u(P, 'vfs.dev.util[nvme0n1]');
const tCpu = u(P, 'aiops.hwtemp[coretemp,Package id 0]');
const tPch = u(P, 'aiops.hwtemp[pch_cannonlake,temp1]');
const tNvme = u(P, 'aiops.hwtemp[nvme,temp1]');
const certDias = u('vm130', 'cert.not_after') !== null ? Math.floor((u('vm130', 'cert.not_after') * 1000 - Date.now()) / 86400000) : null;
const ctrRun = u('vm130', 'docker.containers.running');
const ctrTot = u('vm130', 'docker.containers.total');

const barra = OPS.barra;
const card = OPS.card2;

const sPve = OPS.statusNo(OPS.no('pve'));
const corMem = OPS.faixa(memPct, 80, 90);
const corDisco = OPS.faixa(Math.max(fsPct || 0, nvme || 0), 80, 90);
const corTemp = OPS.faixa(tCpu, 80, 90);
const s130 = OPS.statusNo(OPS.no('vm130'));
const corApp = s130.estado === 'ok' && ctrRun === ctrTot ? OPS.COR.ok : s130.cor === OPS.COR.ok ? OPS.COR.aviso : s130.cor;

el.innerHTML = `<div class="ops-col">
  <div class="ops-col-titulo ops-eyebrow">INFRAESTRUTURA</div>
  ${card('pve', sPve.cor, 'Virtualização · Proxmox VE', 'VMs EM EXECUÇÃO', '▦', `${vmsUp} de ${vms.length}`, [
    `PROXMOX · luis · ${OPS.num(u(P, 'system.cpu.num'), 0)} vCPU`,
    `CPU ${OPS.pct(u(P, 'system.cpu.util'))} · up ${OPS.duracao(u(P, 'system.uptime'))}`,
  ])}
  ${card('mem', corMem, 'Virtualização · Host', 'MEMÓRIA DO HOST', memPct >= 90 ? '⚠' : '◧', OPS.pct(memPct), [
    `Em uso ${OPS.bytes(memTot !== null && memDisp !== null ? memTot - memDisp : null)} de ${OPS.bytes(memTot)}`,
    `Livre ${OPS.bytes(memDisp)} · swap livre ${OPS.pct(u(P, 'system.swap.size[,pfree]'), 0)}`,
  ])}
  ${card('disco', corDisco === OPS.COR.ok && corTemp !== OPS.COR.ok ? corTemp : corDisco, 'Storage · NVMe', 'ESPAÇO OCUPADO', '⇄', OPS.pct(fsPct), [
    `Disco ${OPS.pct(nvme)} em uso · fila ${OPS.num(u(P, 'vfs.dev.queue_size[nvme0n1]'), 1)}`,
    `CPU ${tCpu === null ? '—' : OPS.num(tCpu, 0) + ' °C'} · NVMe ${tNvme === null ? '—' : OPS.num(tNvme, 0) + ' °C'} · PCH ${tPch === null ? '—' : OPS.num(tPch, 0) + ' °C'}`,
  ])}
  ${card('app', corApp, 'Aplicação · VM 130', 'SISTEMA DE METAS', '◈', ctrTot === null ? '—' : `${OPS.num(ctrRun, 0)}/${OPS.num(ctrTot, 0)}`, [
    `CONTAINERS · ${OPS.num(u('vm130', 'apm.requisicoes.min'), 0)} req/min · TLS ${certDias === null ? '—' : certDias + ' dias'}`,
  ], barra('CPU', u('vm130', 'system.cpu.util'), 80, 90) + barra('MEMÓRIA', u('vm130', 'vm.memory.util'), 80, 90))}
</div>`;

const abrir = {
  pve: () => OPS.abrirProxmox('virtualizacao'),
  mem: () => OPS.abrirProxmox('virtualizacao'),
  disco: () => OPS.abrirProxmox('storage'),
  temp: () => OPS.abrirProxmox('storage'),
  app: () => OPS.abrirProxmox('aplicacoes'),
  mon: () => OPS.abrirProxmox('aplicacoes'),
};
el.querySelectorAll('[data-card]').forEach((c) => {
  c.onclick = () => abrir[c.dataset.card]();
});
