/* Sons de feedback gerados na hora com Web Audio (sem arquivos de áudio). */
(function () {
  let ctx = null;
  // na demo (?demo=1) o som e a vibração ficam desligados, a não ser com &som=1, e nada é gravado no aparelho
  const Q = new URLSearchParams(location.search);
  const DEMO = Q.get('demo') === '1';
  let ligado = DEMO ? Q.get('som') === '1' : localStorage.getItem('ceia:som') !== 'off';

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // toca uma nota com envelope curto
  function nota(freq, ini, dur, vol, tipo, freqFim) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + ini;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tipo || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (freqFim) o.frequency.exponentialRampToValueAtTime(freqFim, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // sininho: fundamental + harmônico agudo
  function sino(freq, ini, dur, vol) {
    nota(freq, ini, dur, vol, 'sine');
    nota(freq * 2.76, ini, dur * 0.5, vol * 0.25, 'sine');
  }

  const S = {
    toque()   { nota(740, 0, 0.07, 0.09, 'triangle', 980); },
    aba()     { nota(520, 0, 0.06, 0.07, 'sine', 700); nota(880, 0.04, 0.08, 0.05, 'sine'); },
    adiciona(){ nota(659, 0, 0.09, 0.1, 'triangle'); nota(988, 0.06, 0.12, 0.09, 'triangle'); },
    remove()  { nota(784, 0, 0.08, 0.08, 'triangle'); nota(523, 0.05, 0.12, 0.07, 'triangle'); },
    abre()    { sino(1047, 0, 0.35, 0.07); sino(1568, 0.07, 0.4, 0.05); },
    fecha()   { nota(880, 0, 0.09, 0.06, 'sine', 520); },
    marca()   { nota(1175, 0, 0.08, 0.08, 'sine'); },
    sucesso() { [523, 659, 784, 1047].forEach((f, i) => sino(f, i * 0.09, 0.5, 0.08)); },
    vazio()   { nota(392, 0, 0.18, 0.08, 'triangle'); nota(330, 0.12, 0.25, 0.07, 'triangle'); },
    favorito(){ sino(1319, 0, 0.3, 0.07); sino(1760, 0.06, 0.35, 0.05); },
  };

  window.Som = {
    tocar(nome) {
      if (!ligado || !S[nome]) return;
      try { S[nome](); } catch (e) { /* sem áudio */ }
      if (navigator.vibrate && nome !== 'aba') navigator.vibrate(8);
    },
    get ligado() { return ligado; },
    alternar() {
      ligado = !ligado;
      if (!DEMO) localStorage.setItem('ceia:som', ligado ? 'on' : 'off');
      if (ligado) S.toque();
      return ligado;
    },
  };
})();
