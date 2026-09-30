/* app.js — lógica principal do jogo (JS puro, módulo ES).
   Seções: 1) constantes  2) utilitários  3) algoritmo  4) UI  5) persistência
           6) fluxo do jogo  7) entrada  8) modo 1v1  9) inicialização */
import { WORDS } from './words.js';

/* ========== 1. Constantes ========== */
const ROWS = 6, COLS = 5;
const KEY_LAYOUT = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const PRIORITY = { absent: 1, present: 2, correct: 3 };   // Verde > Amarelo > Cinza
const CODE_OF = { correct: 'C', present: 'P', absent: 'A' }; // formato enviado ao Firebase
const STORAGE_KEY = 'termo:daily:v1';
const FLIP_MS = 250;

/* ========== 2. Utilitários ========== */
const $ = sel => document.querySelector(sel);
/** Remove acentos e Ç e põe em maiúsculas: "FOGÃO" -> "FOGAO". */
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const sleep = ms => new Promise(r => setTimeout(r, ms));
/** Número do dia local (muda à meia-noite do fuso do usuário). */
const dayNumber = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
const dailySecret = () => norm(WORDS[dayNumber() % WORDS.length]);

/* ========== 3. Algoritmo de avaliação ========== */
/** Compara chute e segredo (ambos normalizados). Trata letras repetidas em 2 passadas:
 *  1ª marca os verdes e conta as letras restantes do segredo; 2ª só dá amarelo
 *  enquanto ainda sobrar aquela letra. Ex.: segredo MAMAO, chute CANTO -> só o A da posição 2 e o O são verdes. */
export function evaluate(guess, secret) {
  const result = Array(COLS).fill('absent');
  const remaining = {};
  for (let i = 0; i < COLS; i++) {
    if (guess[i] === secret[i]) result[i] = 'correct';
    else remaining[secret[i]] = (remaining[secret[i]] || 0) + 1;
  }
  for (let i = 0; i < COLS; i++) {
    if (result[i] !== 'correct' && remaining[guess[i]] > 0) { result[i] = 'present'; remaining[guess[i]]--; }
  }
  return result;
}

/* ========== 4. UI ========== */
const cells = [];          // cells[linha][coluna] -> elemento
const keyEls = {};         // keyEls['A'] -> botão
let toastTimer;

function buildBoard() {
  const board = $('#board');
  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement('div'); row.className = 'row'; cells[r] = [];
    for (let c = 0; c < COLS; c++) { const el = document.createElement('div'); el.className = 'cell'; row.append(el); cells[r][c] = el; }
    board.append(row);
  }
}

function buildKeyboard() {
  const kb = $('#keyboard');
  KEY_LAYOUT.forEach((letters, i) => {
    const row = document.createElement('div'); row.className = 'krow' + (i === 1 ? ' pad' : '');
    if (i === 2) row.append(makeKey('ENTER', 'ENTER', true));
    for (const ch of letters) { const k = makeKey(ch, ch); keyEls[ch] = k; row.append(k); }
    if (i === 2) row.append(makeKey('⌫', 'DELETE', true));
    kb.append(row);
  });
  // pointerdown responde mais rápido que click no celular
  kb.addEventListener('pointerdown', e => { const k = e.target.closest('.key'); if (k) { e.preventDefault(); handleKey(k.dataset.key); } });
}
function makeKey(label, value, wide) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
  b.dataset.key = value; b.className = 'key' + (wide ? ' wide' : ''); return b;
}

function toast(msg, ms = 1800) {
  const el = $('#message'); el.textContent = msg; clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => (el.textContent = ''), ms);
}

/** Pinta a tecla respeitando a prioridade (nunca "rebaixa" uma cor). */
function paintKey(letter, status) {
  const el = keyEls[letter]; if (!el) return;
  const cur = ['correct', 'present', 'absent'].find(s => el.classList.contains(s));
  if (cur && PRIORITY[cur] >= PRIORITY[status]) return;
  if (cur) el.classList.remove(cur);
  el.classList.add(status);
}

function clearUI() {
  cells.flat().forEach(el => { el.textContent = ''; el.className = 'cell'; el.style.animationDelay = ''; });
  Object.values(keyEls).forEach(k => k.classList.remove('correct', 'present', 'absent'));
  toast('', 0);
}

/** Revela uma linha (com animação de flip opcional). */
async function reveal(r, guess, result, animate) {
  result.forEach((status, i) => {
    const cell = cells[r][i];
    const apply = () => { cell.classList.add(status); paintKey(guess[i], status); };
    if (animate) { cell.style.animationDelay = `${i * FLIP_MS}ms`; cell.classList.add('flip'); setTimeout(apply, i * FLIP_MS + 250); }
    else apply();
  });
  if (animate) await sleep((COLS - 1) * FLIP_MS + 550);
}

function shakeRow(r) {
  const row = $('#board').children[r]; row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
}

/* ========== 5. Persistência (estado diário) ========== */
function saveDaily() {
  if (state.mode !== 'daily') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ day: dayNumber(), rows: state.rows, status: state.status }));
}
function loadDaily() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return data && data.day === dayNumber() ? data : null;   // outro dia => começa do zero
  } catch { return null; }
}

/* ========== 6. Fluxo do jogo ========== */
const state = { mode: 'daily', secret: '', rows: [], current: '', status: 'playing', busy: false };

/** Inicia (ou restaura) uma partida. savedRows são reexibidos sem animação. */
function startGame(mode, secret, savedRows = [], status = 'playing') {
  Object.assign(state, { mode, secret, rows: [], current: '', status: 'playing', busy: false });
  clearUI();
  savedRows.forEach((guess, r) => {
    state.rows.push(guess);
    guess.split('').forEach((ch, i) => (cells[r][i].textContent = ch));
    reveal(r, guess, evaluate(guess, secret), false);
  });
  state.status = status;
  if (status === 'won') toast('Você acertou! 🎉', 0);
  if (status === 'lost') toast(`A palavra era ${secret}`, 0);
}

function typeLetter(ch) {
  if (state.current.length >= COLS) return;
  const cell = cells[state.rows.length][state.current.length];
  cell.textContent = ch; cell.classList.add('filled'); state.current += ch;
}
function deleteLetter() {
  if (!state.current.length) return;
  state.current = state.current.slice(0, -1);
  const cell = cells[state.rows.length][state.current.length];
  cell.textContent = ''; cell.classList.remove('filled');
}

async function submit() {
  const r = state.rows.length;
  if (state.current.length < COLS) { shakeRow(r); return toast('Faltam letras'); }

  const guess = state.current, result = evaluate(guess, state.secret);
  state.rows.push(guess); state.current = ''; state.busy = true;
  await reveal(r, guess, result, true);

  const won = result.every(s => s === 'correct');
  if (won) state.status = 'won';
  else if (state.rows.length >= ROWS) state.status = 'lost';
  state.busy = false;

  if (state.status === 'won') toast('Você acertou! 🎉', 0);
  if (state.status === 'lost') toast(`A palavra era ${state.secret}`, 0);
  saveDaily();
  if (state.mode === 'versus') await syncVersus(result, won);
}

/* ========== 7. Entrada (teclado virtual + físico) ========== */
function handleKey(key) {
  if (state.status !== 'playing' || state.busy) return;
  if (key === 'ENTER') submit();
  else if (key === 'DELETE') deleteLetter();
  else typeLetter(key);
}
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || $('#dlg').open) return;
  if (e.key === 'Enter') handleKey('ENTER');
  else if (e.key === 'Backspace') handleKey('DELETE');
  else if (e.key.length === 1) {                       // aceita Ã, Ç, etc. e normaliza
    const ch = norm(e.key);
    if (/^[A-Z]$/.test(ch)) handleKey(ch);
  }
});

/* ========== 8. Modo 1v1 ========== */
const vs = { mp: null, code: null, unsub: [], patterns: [] };
const dlgMsg = t => ($('#dlg-msg').textContent = t);
const ERRORS = { SALA_INEXISTENTE: 'Sala não encontrada. Confira o código.', SALA_CHEIA: 'Essa sala já está cheia.', REDE: 'Sem conexão com o servidor.' };
const friendly = e => ERRORS[e.code] || 'Multiplayer indisponível (verifique a internet e a configuração do Firebase).';

/** Import dinâmico: o solo continua funcionando offline mesmo se o SDK não carregar. */
async function loadMP() {
  if (!vs.mp) {
    try { vs.mp = await import('./multiplayer.js'); }
    catch { throw Object.assign(new Error(), { code: 'REDE' }); }
  }
  return vs.mp;
}

async function createRoom() {
  try {
    dlgMsg('Criando sala...');
    const mp = await loadMP();
    const { code, wordIndex } = await mp.createRoom(WORDS.length);
    enterRoom(code, wordIndex, false);
    const link = `${location.origin}${location.pathname}?sala=${code}`;
    dlgMsg(`Sala ${code} criada. Envie o link: ${link}`);
    const share = $('#btn-share'); share.hidden = false;
    share.onclick = () => navigator.share ? navigator.share({ title: 'Termo 1v1', url: link }).catch(() => {})
      : navigator.clipboard.writeText(link).then(() => dlgMsg('Link copiado!'));
  } catch (e) { dlgMsg(friendly(e)); }
}

async function joinRoom(code) {
  code = code.trim().toUpperCase();
  if (code.length !== 4) return dlgMsg('O código tem 4 caracteres.');
  try {
    dlgMsg('Entrando...');
    const mp = await loadMP();
    const { wordIndex } = await mp.joinRoom(code);
    enterRoom(code, wordIndex, true);
    $('#dlg').close();
  } catch (e) { dlgMsg(friendly(e)); if (!$('#dlg').open) { toast(friendly(e), 3500); } }
}

/** Assina a sala. O jogo só começa quando status === 'playing' (2 jogadores). */
function enterRoom(code, wordIndex, isGuest) {
  leaveRoom(false);
  Object.assign(vs, { code, patterns: [], secret: norm(WORDS[wordIndex]) });
  state.status = 'waiting'; state.mode = 'versus'; state.secret = vs.secret;
  clearUI(); toast(isGuest ? 'Entrando na partida...' : 'Aguardando o oponente...', 0);
  $('#opponent').hidden = false; renderOpponent('');
  vs.unsub = [
    vs.mp.subscribeRoom(code, onRoom),
    vs.mp.subscribeConnection(ok => { if (!ok) toast('Reconectando...', 0); else if (state.status === 'playing') toast('', 0); })
  ];
}

function leaveRoom(backToDaily = true) {
  vs.unsub.forEach(fn => fn && fn()); vs.unsub = []; vs.code = null;
  if (!backToDaily) return;
  $('#opponent').hidden = true; $('#btn-share').hidden = true;
  const d = loadDaily();
  startGame('daily', dailySecret(), d?.rows || [], d?.status || 'playing');
}

/** Callback em tempo real da sala. */
function onRoom(room) {
  if (room === null) { toast('A sala foi encerrada.', 0); return; }
  if (room === undefined) { toast('Erro de conexão com a sala.', 3000); return; }
  const me = vs.mp.getUid(), players = room.players || {};
  const oppId = Object.keys(players).find(id => id !== me);
  renderOpponent(oppId ? players[oppId].rows : '');

  if (room.status === 'playing' && state.status === 'waiting') {
    state.status = 'playing'; toast('Valendo! Descubra primeiro.', 2500); $('#dlg').open && $('#dlg').close();
  }
  if (room.winner && state.status === 'playing') {                 // oponente acertou antes
    if (room.winner !== me) { state.status = 'lost'; toast(`Oponente venceu! Palavra: ${state.secret}`, 0); }
  } else if (!room.winner && oppId && players[oppId].done && players[me]?.done) {
    toast(`Empate! Ninguém acertou. Palavra: ${state.secret}`, 0);
  }
}

/** Envia progresso; se acertou, tenta reivindicar a vitória (transação atômica). */
async function syncVersus(result, won) {
  vs.patterns.push(result.map(s => CODE_OF[s]).join(''));
  const done = won || state.status === 'lost';
  try {
    await vs.mp.publishProgress(vs.code, vs.patterns, done);
    if (won) {
      const first = await vs.mp.claimVictory(vs.code);
      if (first) toast('Você venceu! 🏆', 0);
      else { state.status = 'lost'; toast(`Oponente foi mais rápido. Palavra: ${state.secret}`, 0); }
    }
  } catch { toast('Falha ao sincronizar. Verifique a conexão.', 3000); }
}

/** Desenha o mini-grid (6x5) do oponente a partir de "PACCA,CCCCC". */
function renderOpponent(rowsStr) {
  const grid = $('#opp-grid'), rows = rowsStr ? rowsStr.split(',') : [];
  const COLORS = { C: 'var(--correct)', P: 'var(--present)', A: 'var(--absent)' };
  grid.innerHTML = '';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = document.createElement('i'); const code = rows[r]?.[c];
    if (code) i.style.background = COLORS[code]; grid.append(i);
  }
  $('#opp-label').textContent = `Oponente: ${rows.length}/${ROWS}`;
}

/* ========== 9. Inicialização ========== */
function init() {
  buildBoard(); buildKeyboard();
  const d = loadDaily();
  startGame('daily', dailySecret(), d?.rows || [], d?.status || 'playing');

  const dlg = $('#dlg');
  $('#btn-versus').onclick = () => { dlgMsg(''); dlg.showModal(); };
  $('#btn-close').onclick = () => dlg.close();
  $('#btn-create').onclick = createRoom;
  $('#btn-join').onclick = () => joinRoom($('#in-code').value);
  $('#btn-leave').onclick = () => leaveRoom(true);

  // Entrada por link: ?sala=A3K9
  const code = new URLSearchParams(location.search).get('sala');
  if (code) { history.replaceState(null, '', location.pathname); joinRoom(code); }
}
init();
