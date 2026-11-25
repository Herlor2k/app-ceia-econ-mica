/* Ceia Econômica de Natal — app principal (sem dependências). */
(function () {
  'use strict';

  const TODAS = window.RECEITAS || [];
  const ING = window.INGREDIENTES || {};
  const SECOES = window.SECOES || [];
  const BASICOS = window.BASICOS || [];
  const PRODUTOS = window.PRODUTOS || [];
  const POR_ID = Object.fromEntries(TODAS.map(r => [r.id, r]));
  const NOME_PK = { franca: 'Francesa', eua: 'Americana', alemanha: 'Alemã' };
  let R = [];   // receitas visíveis (grátis + pacotes liberados)
  const $tela = document.getElementById('tela');
  const $folha = document.getElementById('receita');

  const CATS = {
    principais:      { c: ['principal'], titulo: 'Pratos principais', sub: 'Assados, aves, peixes e carnes para o centro da mesa.', emoji: 'coxa' },
    acompanhamentos: { c: ['acompanhamento'], titulo: 'Acompanhamentos', sub: 'Arrozes, farofas, saladas e salpicões.', emoji: 'salada' },
    sobremesas:      { c: ['sobremesa'], titulo: 'Sobremesas', sub: 'Pavês, rabanadas, pudins, panetones e mais.', emoji: 'bolo' },
    entradas:        { c: ['entrada', 'bebida'], titulo: 'Entradas e Drinks', sub: 'Petiscos para receber e bebidas para brindar.', emoji: 'tacas' },
  };
  const NOME_CAT = { principal: 'Prato principal', acompanhamento: 'Acompanhamento', sobremesa: 'Sobremesa', entrada: 'Entrada', bebida: 'Drink' };
  const EMOJI_CAT = { principal: 'coxa', acompanhamento: 'salada', sobremesa: 'bolo', entrada: 'queijo', bebida: 'coquetel' };
  // ícones da interface (img/ui-web/<nome>.webp)
  const IC = (n, cls) => `<img class="ic${cls ? ' ' + cls : ''}" src="img/ui-web/${n}.webp" alt="" aria-hidden="true" draggable="false">`;

  // ------------------------------------------------------------------ modo demonstração (?demo=1)
  // Na demo nada é gravado no aparelho: o estado fica só na memória e some a cada volta do roteiro.
  const DEMO = new URLSearchParams(location.search).get('demo') === '1';
  const MEMORIA_DEMO = new Map();

  // ------------------------------------------------------------------ estado salvo
  const guardar = (k, v) => {
    if (DEMO) MEMORIA_DEMO.set(k, JSON.stringify(v));
    else localStorage.setItem('ceia:' + k, JSON.stringify(v));
  };
  const ler = (k, d) => {
    try {
      const bruto = DEMO ? MEMORIA_DEMO.get(k) : localStorage.getItem('ceia:' + k);
      if (bruto == null) return d;
      const v = JSON.parse(bruto); return v ?? d;
    } catch (e) { return d; }
  };
  const despensa = new Set(ler('despensa', []).filter(k => ING[k]));
  const favoritos = new Set(ler('favoritos', []));
  const salvarDespensa = () => guardar('despensa', [...despensa]);

  // extras liberados por código
  const liberados = new Set(ler('liberados', []));
  const GRATIS = new Set(PRODUTOS.filter(p => p.gratis).map(p => p.id));   // produtos sem código (gratis: true em produtos.js)
  const liberado = id => GRATIS.has(id) || liberados.has(id);

  // uso de cada ingrediente (para "mais usados" e para esconder os que só aparecem em pacotes bloqueados)
  let USO = {};
  function atualizarVisiveis() {
    R = TODAS.filter(r => !r.pk || liberados.has(r.pk));
    USO = {};
    R.forEach(r => r.req.concat(r.opt).forEach(k => k.split('|').forEach(x => { USO[x] = (USO[x] || 0) + 1; })));
  }
  atualizarVisiveis();

  // ------------------------------------------------------------------ utilitários
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const nomeIng = k => k.split('|').map(x => (ING[x] ? ING[x].nome : x)).join(' ou ');
  const tem = k => k.split('|').some(x => despensa.has(x));

  function analisar(r) {
    const falta = r.req.filter(k => !tem(k));
    const tenho = r.req.length - falta.length;
    let nivel = 0;
    if (tenho >= 1 && falta.length === 0) nivel = 1;
    else if (tenho >= 1 && falta.length <= 3) nivel = 2;
    else if (tenho >= 2 && falta.length <= 7) nivel = 3;
    return { falta, tenho, nivel };
  }

  function aviso(txt) {
    const a = document.getElementById('aviso');
    a.textContent = txt; a.classList.add('on');
    clearTimeout(aviso._t); aviso._t = setTimeout(() => a.classList.remove('on'), 2200);
  }

  function foto(r, cls) {
    if (r.img) return `<img class="${cls}" src="${r.img}" alt="${esc(r.t)}" loading="lazy" decoding="async">`;
    return `<div class="${cls} sem-foto" aria-label="Foto em breve">${IC(EMOJI_CAT[r.c] || 'arvore', 'ic-foto')}<small>foto em breve</small></div>`;
  }

  function cartao(r, extra) {
    const fav = favoritos.has(r.id);
    const tempo = r.prep ? `<span>${IC('cronometro')} ${esc(r.prep)}</span>` : '';
    return `<button class="cartao" data-receita="${r.id}">
      <div class="cartao-foto">${foto(r, 'cf-img')}${fav ? `<span class="cartao-fav">${IC('coracao')}</span>` : ''}</div>
      <div class="cartao-corpo">
        <span class="etiqueta et-${r.c}">${NOME_CAT[r.c]}</span>${r.pk ? `<span class="etiqueta et-pk">${NOME_PK[r.pk]}</span>` : ''}
        <h3>${esc(r.t)}</h3>
        <div class="cartao-meta">${tempo}${r.y ? `<span>${IC('prato')} ${esc(r.y)}</span>` : ''}</div>
        ${extra || ''}
      </div>
    </button>`;
  }

  // ------------------------------------------------------------------ listas por categoria
  const filtroLista = { busca: '', sub: 'todas', fav: false };

  function telaCategoria(chave) {
    const cfg = CATS[chave];
    const sub = chave === 'entradas'
      ? `<div class="segmento" role="tablist">
          ${[['todas', 'Tudo'], ['entrada', IC('queijo') + ' Entradas'], ['bebida', IC('coquetel') + ' Drinks']].map(([v, l]) =>
            `<button role="tab" data-sub="${v}" class="${filtroLista.sub === v ? 'on' : ''}">${l}</button>`).join('')}
        </div>` : '';
    $tela.innerHTML = `
      <section class="cabeca-cat cat-${chave}">
        <div class="cc-emoji">${IC(cfg.emoji)}</div>
        <div><h2>${cfg.titulo}</h2><p>${cfg.sub}</p></div>
      </section>
      <div class="barra-busca">
        <label class="busca">${IC('lupa')}
          <input type="search" id="buscaLista" placeholder="Buscar receita ou ingrediente" value="${esc(filtroLista.busca)}" autocomplete="off"></label>
        <button class="chip-fav ${filtroLista.fav ? 'on' : ''}" id="soFav" aria-pressed="${filtroLista.fav}">${IC('coracao')} Favoritas</button>
      </div>
      ${sub}
      <p class="contagem" id="contagem"></p>
      <div class="grade" id="grade"></div>`;
    const desenhar = () => {
      const q = norm(filtroLista.busca.trim());
      let lista = R.filter(r => cfg.c.includes(r.c));
      if (chave === 'entradas' && filtroLista.sub !== 'todas') lista = lista.filter(r => r.c === filtroLista.sub);
      if (filtroLista.fav) lista = lista.filter(r => favoritos.has(r.id));
      if (q) lista = lista.filter(r => norm(r.t + ' ' + r.ing.map(g => g.it.map(i => i[0]).join(' ')).join(' ')).includes(q));
      lista.sort((a, b) => a.t.localeCompare(b.t, 'pt'));
      document.getElementById('contagem').textContent = `${lista.length} receita${lista.length === 1 ? '' : 's'}`;
      document.getElementById('grade').innerHTML = lista.length ? lista.map(r => cartao(r)).join('')
        : `<div class="vazio">${IC('lupa', 'ic-grande')}<p>Nenhuma receita encontrada.</p></div>`;
    };
    desenhar();
    const inp = document.getElementById('buscaLista');
    inp.addEventListener('input', () => { filtroLista.busca = inp.value; desenhar(); });
    document.getElementById('soFav').addEventListener('click', e => {
      filtroLista.fav = !filtroLista.fav; Som.tocar('toque');
      e.currentTarget.classList.toggle('on', filtroLista.fav); e.currentTarget.setAttribute('aria-pressed', filtroLista.fav);
      desenhar();
    });
    $tela.querySelectorAll('[data-sub]').forEach(b => b.addEventListener('click', () => {
      filtroLista.sub = b.dataset.sub; Som.tocar('toque');
      $tela.querySelectorAll('[data-sub]').forEach(x => x.classList.toggle('on', x === b));
      desenhar();
    }));
  }

  // ------------------------------------------------------------------ Despensa Mágica
  const dm = { modo: 'escolher', busca: '', aberta: ler('secaoAberta', 'Mais usados'), filtroCat: 'todas' };

  function contarResultados() {
    const n = [0, 0, 0, 0];
    R.forEach(r => { n[analisar(r).nivel]++; });
    return n;
  }

  function telaDespensa() {
    if (dm.modo === 'resultados' && despensa.size) return telaResultados();
    dm.modo = 'escolher';
    $tela.innerHTML = `
      <section class="dm-hero">
        <div class="dm-brilho" aria-hidden="true">${IC('brilho')}</div>
        <h2>Despensa Mágica</h2>
        <p>Marque o que você <b>já tem em casa</b> e a gente mostra o que dá para fazer na ceia, gastando o mínimo.</p>
      </section>
      <div class="dm-busca">
        <label class="busca grande">${IC('lupa')}
          <input type="search" id="buscaIng" placeholder="Digite um ingrediente: frango, batata, leite..." value="${esc(dm.busca)}" autocomplete="off" enterkeyhint="done"></label>
      </div>
      <div id="dmSelecionados"></div>
      <div id="dmLista"></div>
      <p class="dm-basicos">Já consideramos que você tem: <b>${BASICOS.map(k => (ING[k] ? ING[k].nome : k)).filter(Boolean).join(', ')}</b>.</p>
      <div class="dm-rodape-espaco"></div>
      <div class="dm-acao" id="dmAcao"></div>`;
    const inp = document.getElementById('buscaIng');
    inp.addEventListener('input', () => { dm.busca = inp.value; desenharLista(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const primeiro = $tela.querySelector('#dmLista .chip-ing:not(.on)');
        if (primeiro && dm.busca.trim()) { primeiro.click(); inp.value = ''; dm.busca = ''; desenharLista(); }
        inp.blur();
      }
    });
    desenharSelecionados(); desenharLista(); desenharAcao();
  }

  function chipIng(k) {
    const i = ING[k]; if (!i) return '';
    const on = despensa.has(k);
    return `<button class="chip-ing ${on ? 'on' : ''}" data-ing="${k}" aria-pressed="${on}"><span class="ci-em">${i.emoji}</span>${esc(i.nome)}${on ? `<span class="ci-x">${IC('check')}</span>` : ''}</button>`;
  }

  function desenharSelecionados() {
    const el = document.getElementById('dmSelecionados'); if (!el) return;
    if (!despensa.size) { el.innerHTML = ''; return; }
    const ks = [...despensa].sort((a, b) => ING[a].nome.localeCompare(ING[b].nome, 'pt'));
    el.innerHTML = `<div class="dm-sel">
      <div class="dm-sel-topo"><h3>Na sua despensa <span class="bolha">${despensa.size}</span></h3>
        <button class="link" id="limpar">Limpar tudo</button></div>
      <div class="chips">${ks.map(k => `<button class="chip-sel" data-tirar="${k}">${ING[k].emoji} ${esc(ING[k].nome)} <span aria-hidden="true">×</span></button>`).join('')}</div>
    </div>`;
  }

  function desenharLista() {
    const el = document.getElementById('dmLista'); if (!el) return;
    const q = norm(dm.busca.trim());
    const todas = Object.keys(ING).filter(k => !BASICOS.includes(k) && USO[k]);
    if (q) {
      const achados = todas.filter(k => norm(ING[k].nome).includes(q) || k.includes(q))
        .sort((a, b) => (norm(ING[a].nome).startsWith(q) ? 0 : 1) - (norm(ING[b].nome).startsWith(q) ? 0 : 1) || (USO[b] - USO[a]));
      el.innerHTML = achados.length
        ? `<div class="chips chips-busca">${achados.map(chipIng).join('')}</div>`
        : `<div class="vazio pequeno"><p>Não encontramos “${esc(dm.busca)}”. Tente outro nome.</p></div>`;
      return;
    }
    const grupos = [['Mais usados', todas.slice().sort((a, b) => USO[b] - USO[a]).slice(0, 18)]];
    SECOES.forEach(s => {
      const ks = todas.filter(k => ING[k].secao === s).sort((a, b) => ING[a].nome.localeCompare(ING[b].nome, 'pt'));
      if (ks.length) grupos.push([s, ks]);
    });
    el.innerHTML = grupos.map(([nome, ks]) => {
      const aberta = dm.aberta === nome;
      const qtd = ks.filter(k => despensa.has(k)).length;
      return `<div class="secao ${aberta ? 'aberta' : ''}">
        <button class="secao-topo" data-secao="${esc(nome)}" aria-expanded="${aberta}">
          <span>${esc(nome)}</span>${qtd ? `<span class="bolha">${qtd}</span>` : ''}<span class="seta" aria-hidden="true">▾</span>
        </button>
        ${aberta ? `<div class="chips">${ks.map(chipIng).join('')}</div>` : ''}
      </div>`;
    }).join('');
  }

  function desenharAcao() {
    const el = document.getElementById('dmAcao'); if (!el) return;
    if (!despensa.size) { el.innerHTML = `<div class="dm-dica">${IC('mao')} Toque nos ingredientes que você tem</div>`; return; }
    const n = contarResultados();
    const total = n[1] + n[2] + n[3];
    el.innerHTML = `<button class="btn-principal" id="verReceitas">
      <span>Ver ${total} receita${total === 1 ? '' : 's'}</span>
      <small>${n[1]} sem comprar nada · ${n[2]} com 1 a 3 itens</small>
    </button>`;
  }

  $tela.addEventListener('click', e => {
    const chip = e.target.closest('[data-ing]');
    if (chip) {
      const k = chip.dataset.ing;
      if (despensa.has(k)) { despensa.delete(k); Som.tocar('remove'); } else { despensa.add(k); Som.tocar('adiciona'); }
      salvarDespensa();
      chip.classList.add('pulo'); setTimeout(() => chip.classList.remove('pulo'), 250);
      desenharSelecionados(); desenharLista(); desenharAcao();
      return;
    }
    const tirar = e.target.closest('[data-tirar]');
    if (tirar) { despensa.delete(tirar.dataset.tirar); salvarDespensa(); Som.tocar('remove'); desenharSelecionados(); desenharLista(); desenharAcao(); return; }
    if (e.target.closest('#limpar')) {
      if (DEMO || confirm('Limpar todos os ingredientes da sua despensa?')) { despensa.clear(); salvarDespensa(); Som.tocar('remove'); telaDespensa(); }
      return;
    }
    const sec = e.target.closest('[data-secao]');
    if (sec) { dm.aberta = dm.aberta === sec.dataset.secao ? '' : sec.dataset.secao; guardar('secaoAberta', dm.aberta); Som.tocar('toque'); desenharLista(); return; }
    if (e.target.closest('#verReceitas')) { dm.modo = 'resultados'; telaResultados(true); window.scrollTo(0, 0); return; }
    if (e.target.closest('#editarDespensa')) { dm.modo = 'escolher'; Som.tocar('toque'); telaDespensa(); window.scrollTo(0, 0); return; }
    const card = e.target.closest('[data-receita]');
    if (card) { location.hash = '#/receita/' + card.dataset.receita; }
  });

  const NIVEIS = {
    1: { nome: 'Faça agora', sub: 'Você já tem tudo. Não precisa comprar nada!', cls: 'n1', ic: 'presente' },
    2: { nome: 'Falta pouquinho', sub: 'Compre só de 1 a 3 ingredientes.', cls: 'n2', ic: 'carrinho' },
    3: { nome: 'Vale a comprinha', sub: 'Compre de 4 a 7 ingredientes.', cls: 'n3', ic: 'sacolas' },
  };

  function telaResultados(comSom) {
    const grupos = { 1: [], 2: [], 3: [] };
    R.forEach(r => {
      const a = analisar(r);
      if (!a.nivel) return;
      if (dm.filtroCat !== 'todas' && r.c !== dm.filtroCat) return;
      grupos[a.nivel].push([r, a]);
    });
    Object.values(grupos).forEach(g => g.sort((x, y) => x[1].falta.length - y[1].falta.length || y[1].tenho - x[1].tenho || x[0].t.localeCompare(y[0].t, 'pt')));
    const total = grupos[1].length + grupos[2].length + grupos[3].length;
    if (comSom) Som.tocar(total ? 'sucesso' : 'vazio');
    const filtros = [['todas', 'Todas'], ['principal', IC('coxa') + ' Principais'], ['acompanhamento', IC('salada') + ' Acompanham.'], ['sobremesa', IC('bolo') + ' Sobremesas'], ['entrada', IC('queijo') + ' Entradas'], ['bebida', IC('coquetel') + ' Drinks']];
    $tela.innerHTML = `
      <section class="res-topo">
        <button class="voltar" id="editarDespensa">‹ Editar ingredientes</button>
        <h2>Com o que você tem…</h2>
        <p>${despensa.size} ingrediente${despensa.size === 1 ? '' : 's'} na despensa · <b>${total}</b> receita${total === 1 ? '' : 's'} possíve${total === 1 ? 'l' : 'is'}</p>
        <div class="res-resumo">
          ${[1, 2, 3].map(n => `<a href="#nivel${n}" class="rr ${NIVEIS[n].cls}" data-pular="${n}"><b>${grupos[n].length}</b><span>${NIVEIS[n].nome}</span></a>`).join('')}
        </div>
      </section>
      <div class="filtros-rolagem">${filtros.map(([v, l]) => `<button class="filtro ${dm.filtroCat === v ? 'on' : ''}" data-fcat="${v}">${l}</button>`).join('')}</div>
      ${[1, 2, 3].map(n => {
        const nv = NIVEIS[n], g = grupos[n];
        return `<section class="nivel ${nv.cls}" id="nivel${n}">
          <div class="nivel-topo"><span class="nivel-ic">${IC(nv.ic)}</span><div><h3>${nv.nome} <span class="bolha">${g.length}</span></h3><p>${nv.sub}</p></div></div>
          ${g.length ? `<div class="grade">${g.map(([r, a]) => cartao(r, faltaHtml(a))).join('')}</div>`
            : `<div class="vazio pequeno"><p>${n === 1 ? 'Ainda nenhuma. Adicione mais ingredientes que você tem!' : 'Nenhuma receita neste grupo.'}</p></div>`}
        </section>`;
      }).join('')}
      ${total ? '' : `<div class="vazio">${IC('cesta', 'ic-grande')}<p>Adicione mais ingredientes para encontrar receitas.</p></div>`}`;
    $tela.querySelectorAll('[data-fcat]').forEach(b => b.addEventListener('click', () => { dm.filtroCat = b.dataset.fcat; Som.tocar('toque'); telaResultados(); }));
    $tela.querySelectorAll('[data-pular]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault(); Som.tocar('toque');
      document.getElementById('nivel' + a.dataset.pular).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function faltaHtml(a) {
    if (!a.falta.length) return `<div class="falta ok">${IC('check')} Você tem tudo</div>`;
    return `<div class="falta"><b>Falta:</b> ${a.falta.map(k => esc(nomeIng(k))).join(', ')}</div>`;
  }

  // ------------------------------------------------------------------ detalhe da receita
  function abrirReceita(id) {
    const r = POR_ID[id];
    if (!r) { location.hash = '#/despensa'; return; }
    if (r.pk && !liberado(r.pk)) { location.replace('#/extras/' + r.pk); return; }
    const a = analisar(r);
    const usarDespensa = despensa.size > 0;
    const feitos = new Set(ler('passos:' + id, []));
    const fav = favoritos.has(id);
    const meta = [['cronometro', 'Preparo', r.prep], ['chama', 'Cozimento', r.cook], ['prato', 'Rende', r.y], ['tachinha', '', r.n]]
      .filter(x => x[2]).map(([i, l, v]) => `<div class="meta-item"><span>${IC(i)}</span><div>${l ? `<small>${l}</small>` : ''}<b>${esc(v)}</b></div></div>`).join('');
    const linhaIng = ([txt, ks]) => {
      let st = '';
      const opcional = /opcional|a gosto|para decorar|para servir|para finalizar|para polvilhar|para untar|se (já )?tiver/i.test(txt);
      if (usarDespensa && ks.length && !(opcional && !ks.every(k => despensa.has(k)))) {
        const ok = ks.every(k => despensa.has(k)) || (/\bou\b/i.test(txt) && ks.some(k => despensa.has(k)));
        st = ok ? 'tem' : 'falta';
      }
      return `<li class="${st}"><span class="marca" aria-hidden="true">${st === 'tem' ? '✓' : st === 'falta' ? '•' : '•'}</span><span>${esc(txt)}</span>${st === 'tem' ? '<em>tenho</em>' : ''}</li>`;
    };
    $folha.innerHTML = `
      <div class="folha-fundo" data-fechar></div>
      <article class="folha-caixa">
        <div class="folha-foto">
          ${foto(r, 'ff-img')}
          <button class="btn-redondo fechar" data-fechar aria-label="Fechar">${IC('fechar')}</button>
          <button class="btn-redondo fav ${fav ? 'on' : ''}" id="btnFav" aria-label="Favoritar" aria-pressed="${fav}">${IC(fav ? 'coracao' : 'coracao-vazio')}</button>
        </div>
        <div class="folha-corpo">
          <span class="etiqueta et-${r.c}">${NOME_CAT[r.c]}</span>
          <h2>${esc(r.t)}</h2>
          ${r.d ? `<p class="desc">${esc(r.d)}</p>` : ''}
          ${meta ? `<div class="meta">${meta}</div>` : ''}
          ${usarDespensa && r.req.length ? `<div class="status-despensa ${a.falta.length ? 'parcial' : 'completo'}">
              ${a.falta.length ? `${IC('carrinho')} Falta${a.falta.length > 1 ? 'm' : ''} <b>${a.falta.length}</b> ingrediente${a.falta.length > 1 ? 's' : ''}: ${a.falta.map(k => esc(nomeIng(k))).join(', ')}
                <button class="btn-sec" id="compartilhar">Copiar lista de compras</button>`
              : `${IC('presente')} Você já tem todos os ingredientes principais!`}
            </div>` : ''}
          <h3 class="secao-titulo">${IC('cesta')} Ingredientes</h3>
          <div class="ingredientes">${r.ing.map(g => `${g.g ? `<h4>${esc(g.g)}</h4>` : ''}<ul>${g.it.map(linhaIng).join('')}</ul>`).join('')}</div>
          <h3 class="secao-titulo">${IC('cozinheira')} Modo de preparo</h3>
          <p class="dica-toque">Toque em cada passo para marcar como feito.</p>
          <ol class="passos">${r.st.map((s, i) => `<li class="${feitos.has(i) ? 'feito' : ''}" data-passo="${i}"><span class="num">${i + 1}</span><span class="txt">${esc(s)}</span></li>`).join('')}</ol>
          ${r.tips.length ? `<div class="dicas">${r.tips.map(t => `<div class="dica"><h4>${IC('lampada')} ${esc(t.label)}</h4><p>${esc(t.text)}</p></div>`).join('')}</div>` : ''}
          <p class="rodape-receita">Bom apetite e Feliz Natal! ${IC('arvore')}</p>
        </div>
      </article>`;
    document.body.classList.add('sem-rolagem');
    $folha.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => $folha.classList.add('on'));
    $folha.querySelector('.folha-caixa').scrollTop = 0;
    Som.tocar('abre');

    $folha.querySelectorAll('[data-passo]').forEach(li => li.addEventListener('click', () => {
      const i = +li.dataset.passo;
      if (feitos.has(i)) feitos.delete(i); else { feitos.add(i); Som.tocar('marca'); }
      li.classList.toggle('feito', feitos.has(i));
      guardar('passos:' + id, [...feitos]);
    }));
    $folha.querySelector('#btnFav').addEventListener('click', e => {
      const b = e.currentTarget;
      if (favoritos.has(id)) { favoritos.delete(id); Som.tocar('remove'); aviso('Removida das favoritas'); }
      else { favoritos.add(id); Som.tocar('favorito'); aviso('Salva nas favoritas ♥'); }
      guardar('favoritos', [...favoritos]);
      const on = favoritos.has(id); b.classList.toggle('on', on); b.innerHTML = IC(on ? 'coracao' : 'coracao-vazio'); b.setAttribute('aria-pressed', on);
    });
    const comp = $folha.querySelector('#compartilhar');
    if (comp) comp.addEventListener('click', async () => {
      Som.tocar('toque');
      if (DEMO) { aviso('Lista copiada!'); return; }
      const txt = `🛒 Lista de compras — ${r.t}\n` + a.falta.map(k => `• ${nomeIng(k)}`).join('\n') + '\n\nCeia Econômica de Natal';
      try {
        if (navigator.share) await navigator.share({ title: 'Lista de compras', text: txt });
        else { await navigator.clipboard.writeText(txt); aviso('Lista copiada!'); }
      } catch (e) { /* cancelado */ }
    });
  }

  function fecharReceita() {
    if (!$folha.classList.contains('on')) return;
    $folha.classList.remove('on');
    $folha.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sem-rolagem');
    Som.tocar('fecha');
  }

  $folha.addEventListener('click', e => {
    if (e.target.closest('[data-fechar]')) { voltarDaReceita(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $folha.classList.contains('on')) voltarDaReceita(); });

  // ------------------------------------------------------------------ rotas
  let abaAtual = null;
  let veioDeDentro = false;
  function voltarDaReceita() {
    if (veioDeDentro) history.back(); else location.hash = '#/' + (abaAtual || 'despensa');
  }

  function rota() {
    const h = location.hash.replace(/^#\/?/, '') || 'despensa';
    const [p, id] = h.split('/');
    if (p === 'receita' && id) {
      if (!abaAtual) mostrarAba('despensa', false);
      abrirReceita(decodeURIComponent(id));
      return;
    }
    fecharReceita();
    veioDeDentro = false;
    let aba = 'despensa';
    if (CATS[p] || p === 'despensa' || p === 'extras' || p === 'montar') aba = p;
    if ((p === 'extras' || p === 'pacote') && id) aba = p + '/' + id;
    if (aba !== abaAtual) { mostrarAba(aba, true); }
  }

  function mostrarAba(aba, comSom) {
    if (abaAtual && comSom) Som.tocar('aba');
    if (aba !== abaAtual) { filtroLista.busca = ''; filtroLista.sub = 'todas'; filtroLista.fav = false; }
    abaAtual = aba;
    document.querySelectorAll('.abas a').forEach(a => a.classList.toggle('on', a.dataset.aba === aba));
    document.getElementById('faixaExtras').hidden = /^(extras|montar|pacote)/.test(aba);
    const [p, id] = aba.split('/');
    if (p === 'despensa') telaDespensa();
    else if (p === 'extras') telaExtras(id);
    else if (p === 'montar') telaMontar();
    else if (p === 'pacote') telaPacote(id);
    else telaCategoria(p);
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ extras (order bumps)
  function fnv1a(s) {
    let h = 0x811c9dc5;
    for (const b of new TextEncoder().encode(s)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function conferirCodigo(txt) {
    const cod = String(txt).replace(/\D/g, '');
    if (cod.length !== 7 || !window.CODIGOS) return null;
    const h = fnv1a(window.CODIGOS.sal + cod);
    return Object.keys(window.CODIGOS.hash).find(pid => window.CODIGOS.hash[pid] === h) || null;
  }
  const produto = id => PRODUTOS.find(p => p.id === id);
  const destinoProduto = id => (id === 'montar' ? '#/montar' : '#/pacote/' + id);
  const iconeProduto = p => p.bandeira ? `<span class="bandeira b-${p.bandeira}" aria-hidden="true"></span>` : IC('prato');

  function pintarFaixa() {
    const el = document.getElementById('faixaExtras');
    const todos = PRODUTOS.every(p => liberado(p.id));
    el.innerHTML = `${IC('presente')}<span><b>${todos ? 'Seus extras' : 'Mais receitas e o Monte sua Ceia'}</b>
      <small>${todos ? 'Receitas internacionais e Monte sua Ceia' : 'Receitas francesas, americanas, alemãs e mais'}</small></span><i aria-hidden="true">›</i>`;
  }

  function telaExtras(foco) {
    $tela.innerHTML = `
      <section class="cabeca-cat cat-extras">
        <div class="cc-emoji">${IC('presente')}</div>
        <div><h2>Extras para sua ceia</h2><p>O Monte sua Ceia já é seu. Comprou um pacote de receitas? Coloque o código que você recebeu.</p></div>
      </section>
      <div class="extras-lista">${PRODUTOS.map(p => cartaoProduto(p, foco === p.id)).join('')}</div>
      <p class="extras-nota">O código dos pacotes chega depois da compra. Ele libera as receitas neste celular.</p>`;
    if (foco && !liberado(foco)) {
      const inp = $tela.querySelector(`[data-prod="${foco}"] input`);
      if (inp) setTimeout(() => { inp.closest('.produto').scrollIntoView({ block: 'center' }); }, 50);
    }
  }

  function cartaoProduto(p, aberto) {
    const ok = liberado(p.id);
    const qtd = p.id === 'montar' ? '' : `<small class="prod-qtd">${TODAS.filter(r => r.pk === p.id).length} receitas</small>`;
    return `<article class="produto ${ok ? 'liberado' : ''} ${aberto && !ok ? 'aberto' : ''}" data-prod="${p.id}">
      <div class="prod-topo">
        <div class="prod-ic">${iconeProduto(p)}</div>
        <div class="prod-txt"><h3>${esc(p.nome)}</h3><p>${esc(p.resumo)}</p>${qtd}</div>
        ${ok ? `<span class="prod-selo">${IC('check')} Liberado</span>` : '<span class="prod-selo bloq" aria-label="Bloqueado">🔒</span>'}
      </div>
      ${ok
        ? `<a class="btn-principal btn-prod" href="${destinoProduto(p.id)}">Abrir</a>`
        : `<div class="prod-acoes">
            <button class="btn-sec" data-tenho="${p.id}">Tenho o código</button>
            <button class="btn-principal btn-prod" data-comprar="${p.id}">Quero adquirir</button>
          </div>
          <form class="prod-codigo" data-codigo="${p.id}" autocomplete="off">
            <label for="cod-${p.id}">Digite o código de 7 números</label>
            <div class="prod-linha">
              <input id="cod-${p.id}" inputmode="numeric" pattern="[0-9 ]*" maxlength="9" placeholder="0000000" enterkeyhint="go">
              <button class="btn-principal" type="submit">Liberar</button>
            </div>
          </form>`}
    </article>`;
  }

  $tela.addEventListener('click', e => {
    const tenho = e.target.closest('[data-tenho]');
    if (tenho) {
      const card = tenho.closest('.produto');
      card.classList.toggle('aberto'); Som.tocar('toque');
      if (card.classList.contains('aberto')) card.querySelector('input').focus();
      return;
    }
    const comp = e.target.closest('[data-comprar]');
    if (comp) {
      const p = produto(comp.dataset.comprar); Som.tocar('toque');
      if (p && p.url && !DEMO) window.open(p.url, '_blank', 'noopener');
      else aviso('Página de vendas em breve');
    }
  });

  $tela.addEventListener('submit', e => {
    const form = e.target.closest('[data-codigo]');
    if (!form) return;
    e.preventDefault();
    const inp = form.querySelector('input');
    // na demo os códigos reais nunca são usados: qualquer código de 7 números libera o produto do próprio formulário (só na memória)
    const pid = DEMO ? (inp.value.replace(/\D/g, '').length === 7 ? form.dataset.codigo : null) : conferirCodigo(inp.value);
    if (!pid) {
      Som.tocar('vazio'); aviso('Código inválido. Confira os 7 números.');
      form.classList.remove('erro'); void form.offsetWidth; form.classList.add('erro');
      return;
    }
    const jaTinha = liberado(pid);
    liberados.add(pid); guardar('liberados', [...liberados]);
    atualizarVisiveis(); pintarFaixa();
    Som.tocar('sucesso');
    const p = produto(pid);
    const nome = p ? p.nome : 'Conteúdo';
    aviso(jaTinha ? 'Esse código já estava liberado'
      : pid !== form.dataset.codigo ? `Esse código é de "${nome}", que foi liberado!` : `${nome} liberado!`);
    inp.blur();
    telaExtras();
    const card = $tela.querySelector(`[data-prod="${pid}"]`);
    if (card) { card.classList.add('acabou-de-liberar'); card.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  });

  function telaPacote(pk) {
    const p = produto(pk);
    if (!p) { location.replace('#/extras'); return; }
    if (!liberado(pk)) { location.replace('#/extras/' + pk); return; }
    const lista = TODAS.filter(r => r.pk === pk);
    const ordem = [['principal', 'Pratos principais'], ['acompanhamento', 'Acompanhamentos'], ['sobremesa', 'Sobremesas'], ['bebida', 'Bebidas'], ['entrada', 'Entradas']];
    $tela.innerHTML = `
      <a class="voltar" href="#/extras">‹ Extras</a>
      <section class="cabeca-cat cat-pacote">
        <div class="cc-emoji">${iconeProduto(p)}</div>
        <div><h2>${esc(p.nome)}</h2><p>Estas receitas também aparecem nas abas e na Despensa Mágica.</p></div>
      </section>
      ${ordem.map(([c, nome]) => {
        const g = lista.filter(r => r.c === c).sort((a, b) => a.t.localeCompare(b.t, 'pt'));
        return g.length ? `<h3 class="grupo-titulo">${nome} <span class="bolha">${g.length}</span></h3><div class="grade">${g.map(r => cartao(r)).join('')}</div>` : '';
      }).join('')}`;
  }

  // ------------------------------------------------------------------ Monte sua Ceia
  const MONTAR_CATS = [
    { c: 'principal', nome: 'Pratos principais', ic: 'coxa', max: 4 },
    { c: 'acompanhamento', nome: 'Acompanhamentos', ic: 'salada', max: 5 },
    { c: 'sobremesa', nome: 'Sobremesas', ic: 'bolo', max: 4 },
    { c: 'bebida', nome: 'Bebidas', ic: 'coquetel', max: 3 },
  ];
  const qtdMontar = Object.assign({ principal: 1, acompanhamento: 2, sobremesa: 1, bebida: 1 }, ler('montarQtd', {}));
  let ceiaMontada = ler('ceiaMontada', null);

  function combinacoes(n, k) {
    if (k < 0 || k > n) return 0n;
    let r = 1n;
    for (let i = 0; i < k; i++) r = r * BigInt(n - i) / BigInt(i + 1);
    return r;
  }
  function sortear(lista, k) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, k);
  }

  function telaMontar() {
    if (!liberado('montar')) { location.replace('#/extras/montar'); return; }
    const pool = c => R.filter(r => r.c === c);
    const total = MONTAR_CATS.reduce((acc, m) => acc * (qtdMontar[m.c] ? combinacoes(pool(m.c).length, qtdMontar[m.c]) : 1n), 1n);
    const algum = MONTAR_CATS.some(m => qtdMontar[m.c] > 0);
    $tela.innerHTML = `
      <section class="montar-hero">
        <div class="mh-ic">${IC('prato')}</div>
        <h2>Monte sua Ceia</h2>
        <p class="mh-num" aria-live="polite">${algum ? total.toLocaleString('pt-BR') : '0'}</p>
        <p class="mh-sub">combinações de ceia possíveis com as receitas do app</p>
      </section>
      <div class="montar-qtds">
        ${MONTAR_CATS.map(m => `<div class="mq">
          ${IC(m.ic)}<span class="mq-nome">${m.nome}<small>${pool(m.c).length} receitas</small></span>
          <div class="passo-qtd">
            <button data-qtd="${m.c}" data-d="-1" aria-label="Menos ${m.nome}" ${qtdMontar[m.c] <= 0 ? 'disabled' : ''}>−</button>
            <b>${qtdMontar[m.c]}</b>
            <button data-qtd="${m.c}" data-d="1" aria-label="Mais ${m.nome}" ${qtdMontar[m.c] >= Math.min(m.max, pool(m.c).length) ? 'disabled' : ''}>+</button>
          </div>
        </div>`).join('')}
      </div>
      <button class="btn-principal btn-montar" id="btnMontar" ${algum ? '' : 'disabled'}>${IC('brilho')} ${ceiaMontada ? 'Montar outra ceia' : 'Montar ceia'}</button>
      <div id="ceiaResultado">${desenharCeia()}</div>`;
    $tela.querySelectorAll('[data-qtd]').forEach(b => b.addEventListener('click', () => {
      const c = b.dataset.qtd, m = MONTAR_CATS.find(x => x.c === c);
      qtdMontar[c] = Math.max(0, Math.min(m.max, qtdMontar[c] + +b.dataset.d));
      guardar('montarQtd', qtdMontar); Som.tocar('toque'); telaMontarManterRolagem();
    }));
    document.getElementById('btnMontar').addEventListener('click', () => {
      ceiaMontada = {};
      MONTAR_CATS.forEach(m => { ceiaMontada[m.c] = sortear(pool(m.c), qtdMontar[m.c]).map(r => r.id); });
      guardar('ceiaMontada', ceiaMontada);
      Som.tocar('sucesso');
      telaMontarManterRolagem();
      const res = document.getElementById('ceiaResultado');
      res.classList.add('sorteou');
      res.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  function telaMontarManterRolagem() { const y = window.scrollY; telaMontar(); window.scrollTo(0, y); }

  function desenharCeia() {
    if (!ceiaMontada) return `<div class="vazio pequeno"><p>Escolha as quantidades e toque em <b>Montar ceia</b>. Cada toque sorteia um cardápio novo.</p></div>`;
    return `<h3 class="grupo-titulo">Sua ceia</h3>` + MONTAR_CATS.map(m => {
      const rs = (ceiaMontada[m.c] || []).map(id => POR_ID[id]).filter(r => r && (!r.pk || liberado(r.pk)));
      return rs.length ? `<h4 class="ceia-cat">${IC(m.ic)} ${m.nome}</h4><div class="grade">${rs.map(r => cartao(r)).join('')}</div>` : '';
    }).join('');
  }

  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#/receita/')) veioDeDentro = true;
    rota();
  });
  // toque na aba já ativa: volta ao topo / reinicia a Despensa
  document.querySelectorAll('.abas a').forEach(a => a.addEventListener('click', () => {
    if (a.dataset.aba === abaAtual && !$folha.classList.contains('on')) {
      Som.tocar('aba');
      if (abaAtual === 'despensa' && dm.modo === 'resultados') { dm.modo = 'escolher'; telaDespensa(); }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }));

  // botão de som
  const btnSom = document.getElementById('btnSom');
  const pintarSom = () => { btnSom.textContent = Som.ligado ? '🔊' : '🔇'; btnSom.setAttribute('aria-label', Som.ligado ? 'Desligar sons' : 'Ligar sons'); };
  btnSom.addEventListener('click', () => { Som.alternar(); pintarSom(); aviso(Som.ligado ? 'Sons ligados' : 'Sons desligados'); });
  pintarSom();
  pintarFaixa();
  document.getElementById('faixaExtras').addEventListener('click', () => Som.tocar('toque'));

  // som de toque genérico em botões sem som próprio
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.cartao');
    if (b) Som.tocar('toque');
  }, { passive: true });

  rota();

  // ------------------------------------------------------------------ PWA
  if (DEMO) {
    window.__ceiaDemo = {
      resetar() {
        MEMORIA_DEMO.clear();
        despensa.clear(); favoritos.clear(); liberados.clear();
        atualizarVisiveis(); pintarFaixa();
        Object.assign(qtdMontar, { principal: 1, acompanhamento: 2, sobremesa: 1, bebida: 1 });
        ceiaMontada = null;
        Object.assign(dm, { modo: 'escolher', busca: '', aberta: 'Mais usados', filtroCat: 'todas' });
        Object.assign(filtroLista, { busca: '', sub: 'todas', fav: false });
        fecharReceita(); abaAtual = null; veioDeDentro = false;
        if (location.hash !== '#/despensa') history.replaceState(null, '', '#/despensa');
        rota(); window.scrollTo(0, 0);
      },
      liberar(pid) { liberados.add(pid); guardar('liberados', [...liberados]); atualizarVisiveis(); pintarFaixa(); },
      encherDespensa(ks) { ks.forEach(k => ING[k] && despensa.add(k)); salvarDespensa(); },
      mostrarResultados() { dm.modo = 'resultados'; abaAtual = null; if (location.hash !== '#/despensa') history.replaceState(null, '', '#/despensa'); rota(); },
    };
    document.body.classList.add('demo');
    const s = document.createElement('script'); s.src = 'js/demo.js'; document.body.appendChild(s);
  }

  // na demo o service worker não é registrado (não baixa as fotos no aparelho de quem só está vendo a página de vendas)
  if (!DEMO && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
