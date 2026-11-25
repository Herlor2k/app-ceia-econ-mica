/* Produtos extras (order bumps). Pode editar os textos e os links de venda aqui.
   - url: página de vendas do produto. Enquanto estiver vazia, o botão avisa "em breve".
   - Os códigos ficam em js/codigos.js (gerado por tools/gerar_codigos.py). */
window.PRODUTOS = [
  {
    id: 'montar',
    gratis: true,   // liberado para todos, sem código
    nome: 'Monte sua Ceia',
    resumo: 'Um cardápio completo de Natal sorteado na hora: escolha quantos pratos quer e toque em "Montar ceia".',
    url: '',
  },
  {
    id: 'franca',
    nome: '27 Receitas Francesas de Natal',
    resumo: 'Coq au vin, bûche de Noël, crème brûlée, gratin dauphinois e mais.',
    bandeira: 'fr',
    url: '',
  },
  {
    id: 'eua',
    nome: '27 Receitas Americanas de Natal',
    resumo: 'Peru com manteiga de ervas, mac and cheese, torta de abóbora, cheesecake e mais.',
    bandeira: 'us',
    url: '',
  },
  {
    id: 'alemanha',
    nome: '27 Receitas Alemãs de Natal',
    resumo: 'Stollen, strudel, joelho de porco, repolho roxo com maçã, glühwein e mais.',
    bandeira: 'de',
    url: '',
  },
];
