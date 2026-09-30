// Estado do Jogo
let categoriaAtual = 'geral';
let palavraSecreta = '';
let linhaAtual = 0;
let colunaAtual = 0;
let jogoFinalizado = false;
let tentativas = Array(6).fill().map(() => Array(5).fill(''));

// Normalização de Strings (Tratamento de Acentos)
function normalizarTexto(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function iniciarJogo(categoria = 'geral') {
  categoriaAtual = categoria;
  const lista = PALAVRAS[categoria] || PALAVRAS.geral;
  
  // Sorteia palavra aleatória para o modo atual
  const indice = Math.floor(Math.random() * lista.length);
  palavraSecreta = normalizarTexto(lista[indice]);

  linhaAtual = 0;
  colunaAtual = 0;
  jogoFinalizado = false;
  tentativas = Array(6).fill().map(() => Array(5).fill(''));

  limparTabuleiroUI();
}

function limparTabuleiroUI() {
  const celulas = document.querySelectorAll('.cell');
  celulas.forEach(cell => {
    cell.textContent = '';
    cell.className = 'cell';
  });

  const teclas = document.querySelectorAll('.key');
  teclas.forEach(key => {
    key.classList.remove('correct', 'present', 'absent');
  });
}

function submeterTentativa() {
  if (colunaAtual !== 5 || jogoFinalizado) return;

  const chute = tentativas[linhaAtual].join('');
  const chuteNormalizado = normalizarTexto(chute);
  
  validarLinha(chuteNormalizado);

  if (chuteNormalizado === palavraSecreta) {
    jogoFinalizado = true;
    const palavraExibicao = PALAVRAS_EXIBICAO[palavraSecreta] || palavraSecreta;
    setTimeout(() => alert(`Parabéns! Acertou a palavra: ${palavraExibicao}`), 300);
    salvarPontuacao();
  } else if (linhaAtual === 5) {
    jogoFinalizado = true;
    const palavraExibicao = PALAVRAS_EXIBICAO[palavraSecreta] || palavraSecreta;
    setTimeout(() => alert(`Fim de jogo! A palavra era: ${palavraExibicao}`), 300);
  } else {
    linhaAtual++;
    colunaAtual = 0;
  }
}

function validarLinha(chute) {
  const secretArr = palavraSecreta.split('');
  const chuteArr = chute.split('');
  const resultado = Array(5).fill('absent');

  // Primeira passada: Verdes (Corretos)
  chuteArr.forEach((letra, i) => {
    if (letra === secretArr[i]) {
      resultado[i] = 'correct';
      secretArr[i] = null;
    }
  });

  // Segunda passada: Amarelos (Presentes)
  chuteArr.forEach((letra, i) => {
    if (resultado[i] !== 'correct' && secretArr.includes(letra)) {
      resultado[i] = 'present';
      secretArr[secretArr.indexOf(letra)] = null;
    }
  });

  // Atualizar UI das Células e Teclado
  resultado.forEach((status, i) => {
    const cell = document.getElementById(`cell-${linhaAtual}-${i}`);
    if (cell) cell.classList.add(status);

    const tecla = document.querySelector(`[data-key="${chuteArr[i]}"]`);
    if (tecla) {
      if (status === 'correct') {
        tecla.className = 'key correct';
      } else if (status === 'present' && !tecla.classList.contains('correct')) {
        tecla.className = 'key present';
      } else if (status === 'absent' && !tecla.classList.contains('correct') && !tecla.classList.contains('present')) {
        tecla.className = 'key absent';
      }
    }
  });
}

// Gerar Emojis para Partilhar Resultado
function gerarGridEmojis() {
  let grid = `Termo PWA - Categoria: ${categoriaAtual.toUpperCase()}\n\n`;
  for (let r = 0; r <= linhaAtual; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = document.getElementById(`cell-${r}-${c}`);
      if (cell.classList.contains('correct')) grid += '🟩';
      else if (cell.classList.contains('present')) grid += '🟨';
      else grid += '⬛';
    }
    grid += '\n';
  }
  navigator.clipboard.writeText(grid);
  alert('Resultado copiado para a área de transferência! 🚀');
}

function salvarPontuacao() {
  const pontosPartida = (6 - linhaAtual) * 100;
  let pontosTotais = parseInt(localStorage.getItem('pontos_totais') || '0');
  pontosTotais += pontosPartida;
  localStorage.setItem('pontos_totais', pontosTotais);

  // Registar no Firebase se disponível
  if (window.salvarPontuacaoFirebase) {
    window.salvarPontuacaoFirebase(pontosTotais);
  }
}

// Inicializar Jogo
document.addEventListener('DOMContentLoaded', () => iniciarJogo('geral'));
