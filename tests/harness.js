// Executa os painéis do dashboard no Node, com contexto falso e um DOM mínimo,
// alimentados por tests/fixtures/frames.json (gerado por scripts/gerar-fixture.py).
// Falha (exit 1) se algum painel lançar exceção.
// Uso: node tests/harness.js operacoes-infraestrutura.json tests/fixtures/frames.json [nó-selecionado]
const fs = require('fs');
const [, , arqDash, arqFrames, sel = 'todos'] = process.argv;
const dash = JSON.parse(fs.readFileSync(arqDash));
const frames = JSON.parse(fs.readFileSync(arqFrames));
// Os pontos da fixture terminam "agora" de quando foi gerada; desloca para o presente.
const ultimo = Math.max(...frames.filter((f) => f.fields[0].type === 'time').map((f) => f.fields[0].values.at(-1)));
const delta = Date.now() - ultimo;
frames.forEach((f) => f.fields[0].type === 'time' && (f.fields[0].values = f.fields[0].values.map((t) => t + delta)));

const reg = {};
const stub = () => {
  const o = {
    style: {}, dataset: {}, children: [], innerHTML: '', textContent: '', clientWidth: 1000, clientHeight: 700,
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute(k, v) { this[k] = v; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 700 }; },
    appendChild(c) { this.children.push(c); return c; },
    querySelector(s) { if (s === '.ops-mapa') return null; if (!reg[s]) reg[s] = stub(); return reg[s]; },
    querySelectorAll() { return []; }, addEventListener() {}, remove() {}, closest() { return null; },
  };
  return o;
};
global.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
global.document = { getElementById: () => null, createElement: stub, head: stub(), body: stub(), addEventListener() {}, removeEventListener() {} };
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { observe() {} disconnect() {} };
global.CustomEvent = class { constructor(n, o) { this.detail = o && o.detail; } };
const grafana = {
  locationService: { getSearchObject: () => ({ 'var-caminho': sel }), partial() {}, getHistory: () => ({ listen: () => () => {} }) },
  replaceVariables: (s) => s,
};

let erros = 0;
for (const p of dash.panels) {
  try {
    if (p.type === 'volkovlabs-echarts-panel') {
      const chart = { dom: stub(), getDom() { return this.dom; }, on() {}, off() {}, setOption() {} };
      const r = new Function('context', p.options.getOption)({ panel: { data: { series: frames }, chart }, grafana });
      const trilha = reg['.ops-mapa-sub'].innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log(`[painel ${p.id}] mapa OK · svg ${reg['.ops-svg'].innerHTML.length} B · ${trilha.slice(0, 90)}`);
      if (typeof r.unsubscribe !== 'function') throw new Error('mapa sem unsubscribe');
    } else {
      const el = stub();
      new Function('context', p.options.afterRender)({ element: el, panelData: { series: frames }, grafana, data: {} });
      if (!el.innerHTML.includes('ops-')) throw new Error('HTML vazio');
      console.log(`[painel ${p.id}] OK · ${el.innerHTML.length} B`);
    }
  } catch (e) {
    erros++;
    console.log(`[painel ${p.id}] ERRO`, e.stack.split('\n').slice(0, 3).join(' | '));
  }
}
process.exit(erros ? 1 : 0);
