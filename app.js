let categoriaAtual = 'geral';
let palavraSecreta = '';
let linhaAtual = 0;
let colunaAtual = 0;
let jogoFinalizado = false;
let tentativas = Array(6).fill().map(() => Array(5).fill(''));

function normalizarTexto(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function iniciarJogo(categoria = 'geral') {
  categoriaAtual = categoria;
  const lista = PALAVRAS[categoria] || PALAVRAS.geral;
  
  const indice = Math.floor(Math.random() * lista.length);
  palavraSecreta = normalizarTexto(lista[indice]);

  linhaAtual = 0;
  colunaAtual = 0;
  jogoFinalizado = false;
  tentativas = Array(6).fill().map(() => Array(5).fill(''));

  document.getElementById('modal-fim').classList.remove('active');
  limparTabuleiroUI();
}

function limparTabuleiroUI() {
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = document.getElementById(`cell-${r}-${c}`);
      if (cell) {
        cell.textContent = '';
        cell.className = 'cell';
      }
    }
  }

  const teclas = document.querySelectorAll('.key');
  teclas.forEach(key => {
    key.className = key.classList.contains('wide') ? 'key wide' : 'key';
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
    exibirModal(true, `A palavra era <strong>${palavraExibicao}</strong>. Você acertou na ${linhaAtual + 1}ª tentativa!`);
  } else if (linhaAtual === 5) {
    jogoFinalizado = true;
    const palavraExibicao = PALAVRAS_EXIBICAO[palavraSecreta] || palavraSecreta;
    exibirModal(false, `A palavra era <strong>${palavraExibicao}</strong>. Tente novamente!`);
  } else {
    linhaAtual++;
    colunaAtual = 0;
  }
}

function validarLinha(chute) {
  const secretArr = palavraSecreta.split('');
  const chuteArr = chute.split('');
  const resultado = Array(5).fill('absent');

  chuteArr.forEach((letra, i) => {
    if (letra === secretArr[i]) {
      resultado[i] = 'correct';
      secretArr[i] = null;
    }
  });

  chuteArr.forEach((letra, i) => {
    if (resultado[i] !== 'correct' && secretArr.includes(letra)) {
      resultado[i] = 'present';
      secretArr[secretArr.indexOf(letra)] = null;
    }
  });

  resultado.forEach((status, i) => {
    const cell = document.getElementById(`cell-${linhaAtual}-${i}`);
    if (cell) {
      cell.classList.remove('filled');
      cell.classList.add(status);
    }

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

function exibirModal(vitoria, mensagem) {
  setTimeout(() => {
    const modal = document.getElementById('modal-fim');
    document.getElementById('modal-titulo').textContent = vitoria ? 'Parabéns! 🎉' : 'Que pena! 😅';
    document.getElementById('modal-mensagem').innerHTML = mensagem;
    modal.classList.add('active');
  }, 400);
}

function jogarNovamente() {
  iniciarJogo(categoriaAtual);
}

function gerarGridEmojis() {
  let grid = `Letrando - Categoria: ${categoriaAtual.toUpperCase()}\n\n`;
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

document.addEventListener('DOMContentLoaded', () => iniciarJogo('geral'));
