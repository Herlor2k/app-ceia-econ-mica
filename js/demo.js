/* Modo demonstração: o app se usa sozinho, em loop.
   Só é carregado quando a URL tem ?demo=1 (ver o fim de js/app.js).

   Parâmetros da URL:
     demo=1      liga o modo demonstração (obrigatório)
     som=1       liga os sons e a vibração (desligados por padrão)
     moldura=0   não desenha a moldura de celular (use quando a página já desenha o celular por fora)
     passo=N     começa direto na etapa N (1 a 3), para testes
     auto=0      espera a mensagem "ceia-demo:continuar" da página antes de começar

   Mensagens aceitas via postMessage (da página que contém o iframe):
     "ceia-demo:pausar"     pausa a demonstração (ex.: iframe saiu da tela)
     "ceia-demo:continuar"  retoma
*/
(function () {
  'use strict';
  const API = window.__ceiaDemo;
  if (!API) return;

  const Q = new URLSearchParams(location.search);
  const MOLDURA = Q.get('moldura') !== '0';
  const PASSO_INICIAL = Math.min(3, Math.max(1, parseInt(Q.get('passo'), 10) || 1));
  let pausadoFora = Q.get('auto') === '0';
  const VEL = 0.84;   // ritmo geral (menor = mais rápido); a digitação continua entre 90 e 140 ms por letra

  /* ---------------------------------------------------------------- estilos da demo */
  const css = document.createElement('style');
  css.textContent = `
    body.demo{-webkit-user-select:none;user-select:none}
    body.demo #btnSom{visibility:hidden}
    body.demo #faixaExtras{display:none!important}
    .demo-toque{position:fixed;z-index:2147483000;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
      background:rgba(255,255,255,.55);border:2.5px solid rgba(255,255,255,.95);box-shadow:0 2px 12px rgba(0,0,0,.35);
      pointer-events:none;transform:scale(.6);opacity:0;transition:transform .14s ease,opacity .14s ease}
    .demo-toque.on{transform:scale(1);opacity:1}
    .demo-toque.aperta{transform:scale(.82)}
    .demo-toque::after{content:"";position:absolute;inset:-3px;border-radius:50%;border:3px solid rgba(255,255,255,.9);opacity:0}
    .demo-toque.aperta::after{animation:demoOnda .45s ease-out forwards}
    @keyframes demoOnda{from{transform:scale(1);opacity:.9}to{transform:scale(2.3);opacity:0}}
    .demo-foco{outline:3px solid rgba(30,91,63,.45)!important;outline-offset:2px}
    .demo-cortina{position:fixed;inset:0;z-index:2147482000;background:var(--creme, #FFF9F0);opacity:0;pointer-events:none;transition:opacity .35s ease}
    .demo-cortina.on{opacity:1}
    body.demo-moldura::after{content:"";position:fixed;inset:9px;z-index:2147482500;pointer-events:none;
      border-radius:40px;box-shadow:0 0 0 40px #141414,inset 0 0 0 2px #3a3a3a}
  `;
  document.head.appendChild(css);
  if (MOLDURA) document.body.classList.add('demo-moldura');

  const pino = document.createElement('div'); pino.className = 'demo-toque'; document.body.appendChild(pino);
  const cortina = document.createElement('div'); cortina.className = 'demo-cortina'; document.body.appendChild(cortina);

  /* ---------------------------------------------------------------- pausa e cancelamento */
  let volta = 0;                 // muda a cada recomeço: tudo que estava pendente é abandonado
  let tocadoAte = 0;             // a pessoa tocou na tela: pausa até 4 s depois do último toque
  const timers = new Set();
  const ABORTA = { abortou: true };

  ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(ev =>
    document.addEventListener(ev, e => { if (e.isTrusted) tocadoAte = Date.now() + 4000; }, { capture: true, passive: true }));
  window.addEventListener('message', e => {
    if (e.data === 'ceia-demo:pausar') pausadoFora = true;
    if (e.data === 'ceia-demo:continuar') pausadoFora = false;
  });

  const pausado = () => pausadoFora || document.hidden || Date.now() < tocadoAte;
  const dormir = ms => new Promise(res => { const t = setTimeout(() => { timers.delete(t); res(); }, ms); timers.add(t); });

  function checar(minhaVolta) { if (minhaVolta !== volta) throw ABORTA; }

  /* espera "ms" de tempo de demo (o tempo parado em pausa não conta) */
  async function espera(ms, v) {
    let resta = ms * VEL;
    while (resta > 0) {
      checar(v);
      const passo = Math.min(resta, 40);
      await dormir(passo);
      if (!pausado()) resta -= passo;
    }
    checar(v);
  }

  /* espera o elemento existir (e estar visível) */
  async function achar(sel, v, limite = 6000) {
    let t = 0;
    while (t < limite) {
      checar(v);
      const el = typeof sel === 'function' ? sel() : document.querySelector(sel);
      if (el && el.getClientRects().length) return el;
      await espera(80, v); t += 80;
    }
    throw new Error('demo: não achei ' + sel);
  }

  /* ---------------------------------------------------------------- rolagem suave */
  const caixaAberta = () => document.querySelector('.folha.on .folha-caixa');
  function rolador(el) { return (el && el.closest && el.closest('.folha-caixa')) || window; }
  const lerY = alvo => (alvo === window ? window.scrollY : alvo.scrollTop);
  const maxY = alvo => (alvo === window ? document.documentElement.scrollHeight - window.innerHeight : alvo.scrollHeight - alvo.clientHeight);
  const porY = (alvo, y) => (alvo === window ? window.scrollTo(0, y) : (alvo.scrollTop = y));

  async function rolar(alvo, y, v, dur = 900) {
    y = Math.max(0, Math.min(maxY(alvo), y));
    const y0 = lerY(alvo);
    if (Math.abs(y - y0) < 2) return;
    let t = 0;
    while (t < dur) {
      await espera(16, v); t += 16;
      const p = Math.min(1, t / dur);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      porY(alvo, y0 + (y - y0) * e);
    }
    porY(alvo, y);
  }
  const rolarPor = (dy, v, dur) => { const a = caixaAberta() || window; return rolar(a, lerY(a) + dy, v, dur); };

  /* rola até o elemento ficar na posição "onde" (fração da altura visível, 0 = topo) */
  async function rolarAte(el, v, onde = 0.3, dur = 900) {
    const alvo = rolador(el);
    const r = el.getBoundingClientRect();
    const topo = alvo === window ? 0 : alvo.getBoundingClientRect().top;
    const alto = alvo === window ? window.innerHeight : alvo.clientHeight;
    await rolar(alvo, lerY(alvo) + (r.top - topo) - alto * onde, v, dur);
  }

  function fixo(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const p = getComputedStyle(n).position;
      if (p === 'fixed' || p === 'sticky') return true;
    }
    return false;
  }

  /* ---------------------------------------------------------------- toque visível + clique de verdade */
  async function tocar(sel, v, pausaDepois = 380) {
    const el = await achar(sel, v);
    if (!fixo(el)) {
      const r = el.getBoundingClientRect();
      const baixo = window.innerHeight - 150;   // deixa espaço para as abas e o botão fixo
      if (r.top < 90 || r.bottom > baixo) await rolarAte(el, v, 0.4, 650);
    }
    const r = el.getBoundingClientRect();
    pino.style.left = (r.left + r.width / 2) + 'px';
    pino.style.top = (r.top + r.height / 2) + 'px';
    pino.className = 'demo-toque on';
    await espera(230, v);
    pino.className = 'demo-toque on aperta';
    await espera(120, v);
    el.click();
    await espera(160, v);
    pino.className = 'demo-toque';
    await espera(pausaDepois, v);
    return el;
  }

  /* ---------------------------------------------------------------- digitação humana */
  const ritmo = () => (90 + Math.random() * 50) / VEL;
  async function digitar(sel, texto, v) {
    const el = await achar(sel, v);
    el.classList.add('demo-foco');
    for (const ch of texto) {
      el.value += ch;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await espera(ritmo(), v);
    }
    el.classList.remove('demo-foco');
    return el;
  }
  async function apagar(sel, v) {
    const el = await achar(sel, v);
    el.classList.add('demo-foco');
    while (el.value) {
      el.value = el.value.slice(0, -1);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await espera(45, v);
    }
    el.classList.remove('demo-foco');
  }

  /* ---------------------------------------------------------------- o roteiro */
  const ING_DEMO = ['frango-inteiro', 'batata', 'cebola', 'alho', 'leite-condensado', 'creme-de-leite', 'ovos', 'arroz'];

  async function etapa1(v) {   // Despensa Mágica
    await espera(900, v);
    await tocar('#buscaIng', v, 100);
    await digitar('#buscaIng', 'frango', v);
    await espera(350, v);
    await tocar('#dmLista [data-ing="frango-inteiro"]', v, 250);
    await apagar('#buscaIng', v);
    await digitar('#buscaIng', 'batata', v);
    await espera(250, v);
    await tocar('#dmLista [data-ing="batata"]', v, 200);
    await apagar('#buscaIng', v);
    const sec = await achar('[data-secao="Mais usados"]', v);
    if (sec.getAttribute('aria-expanded') !== 'true') await tocar('[data-secao="Mais usados"]', v, 200);
    for (const k of ['cebola', 'alho', 'leite-condensado', 'creme-de-leite', 'ovos']) {
      await tocar(`#dmLista [data-ing="${k}"]`, v, 140);
    }
    await tocar('#buscaIng', v, 80);
    await digitar('#buscaIng', 'arroz', v);
    await espera(250, v);
    await tocar('#dmLista [data-ing="arroz"]', v, 200);
    await apagar('#buscaIng', v);
    await rolarPor(260, v, 700);
    await espera(700, v);
    await tocar('#verReceitas', v, 300);
  }

  async function etapa2(v) {   // Resultados
    await espera(1700, v);
    for (const n of [1, 2, 3]) {
      const el = await achar('#nivel' + n, v);
      await rolarAte(el, v, 0.12, 1000);
      await espera(n === 3 ? 900 : 1300, v);
    }
  }

  async function etapa3(v) {   // Receita aberta
    const nivel2 = await achar('#nivel2', v);
    await rolarAte(nivel2, v, 0.12, 700);
    await tocar('#nivel2 [data-receita]', v, 900);
    const caixa = await achar('.folha.on .folha-caixa', v);
    const status = caixa.querySelector('.status-despensa');
    if (status) {
      await rolarAte(status, v, 0.25, 900);
      await espera(900, v);
      if (caixa.querySelector('#compartilhar')) { await tocar('#compartilhar', v, 1100); }
    }
    const ings = caixa.querySelector('.ingredientes');
    if (ings) { await rolarAte(ings, v, 0.18, 900); await espera(1300, v); }
    const passos = caixa.querySelectorAll('[data-passo]');
    if (passos.length) {
      await rolarAte(passos[0], v, 0.3, 900);
      await tocar('.folha.on [data-passo="0"]', v, 250);
      if (passos.length > 1) await tocar('.folha.on [data-passo="1"]', v, 500);
    }
    await rolar(caixa, 0, v, 800);
    await tocar('#btnFav', v, 1000);
    await tocar('.folha.on [data-fechar].fechar', v, 500);
  }

  const ETAPAS = [etapa1, etapa2, etapa3];

  /* prepara o estado para começar no meio do roteiro (&passo=N) */
  function preparar(n) {
    if (n >= 2) { API.encherDespensa(ING_DEMO); API.mostrarResultados(); }
  }

  async function rodar() {
    let inicio = PASSO_INICIAL;
    let primeira = true;
    for (;;) {
      const v = ++volta;
      window.__demoVolta = v;
      timers.forEach(clearTimeout); timers.clear();
      try {
        // a cortina só aparece entre uma volta e outra (na primeira o app já começa pronto)
        if (!primeira) { cortina.classList.add('on'); await dormir(380); }
        API.resetar();
        preparar(inicio);
        await dormir(80);
        cortina.classList.remove('on');
        if (primeira) {
          primeira = false;
          // avisa a página que a demo já está desenhada (ela só mostra o iframe depois disso)
          requestAnimationFrame(() => requestAnimationFrame(() => { try { parent.postMessage('ceia-demo:pronto', '*'); } catch (e) {} }));
        }
        while (pausado()) await dormir(200);
        for (let i = inicio - 1; i < ETAPAS.length; i++) await ETAPAS[i](v);
        await espera(600, v);
      } catch (e) {
        if (e !== ABORTA) { console.warn(e && e.message ? e.message : e); await dormir(800); }
      }
      pino.className = 'demo-toque';
      inicio = 1;
    }
  }

  rodar();
})();
