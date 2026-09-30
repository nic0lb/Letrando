/* multiplayer.js — 1v1 em tempo real com Firebase Realtime Database (SDK modular via CDN).
   Carregado sob demanda por app.js (import dinâmico), então o jogo solo funciona offline. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getDatabase, ref, get, set, update, onValue, runTransaction, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

/* ===== Configuração — cole aqui os dados do seu projeto (Console Firebase > Configurações) ===== */
const firebaseConfig = {
  apiKey: 'SUA_API_KEY',
  authDomain: 'SEU_PROJETO.firebaseapp.com',
  databaseURL: 'https://SEU_PROJETO-default-rtdb.firebaseio.com',
  projectId: 'SEU_PROJETO',
  appId: 'SEU_APP_ID'
};

/* Estrutura no banco:
   salas/{CODIGO} = {
     wordIndex: 12,             // índice da palavra em words.js (mesma para os dois)
     status: 'waiting' | 'playing',
     winner: '<uid>',           // definido via transação: o primeiro a acertar
     createdAt: <timestamp>,
     players: { '<uid>': { rows: 'PACCA,CCCCC', done: false } }  // P=presente C=correto A=ausente
   } */
const ROOMS = 'salas';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0/I/1 para não confundir

const db = getDatabase(initializeApp(firebaseConfig));

/* Identidade anônima e persistente (sem login) */
const uid = localStorage.getItem('termo:uid') ||
  (() => { const id = crypto.randomUUID().slice(0, 12); localStorage.setItem('termo:uid', id); return id; })();
export const getUid = () => uid;

const roomRef = code => ref(db, `${ROOMS}/${code}`);
const fail = (code, msg) => Object.assign(new Error(msg), { code });
const randomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

/** Jogador 1: cria a sala com um código livre. Retorna { code, wordIndex }. */
export async function createRoom(wordCount) {
  for (let i = 0; i < 6; i++) {           // tenta alguns códigos até achar um livre
    const code = randomCode();
    try {
      if ((await get(roomRef(code))).exists()) continue;
      const wordIndex = Math.floor(Math.random() * wordCount);
      await set(roomRef(code), {
        wordIndex, status: 'waiting', createdAt: serverTimestamp(),
        players: { [uid]: { rows: '', done: false } }
      });
      return { code, wordIndex };
    } catch (e) { throw fail('REDE', 'Sem conexão com o servidor.'); }
  }
  throw fail('SEM_CODIGO', 'Não foi possível gerar uma sala. Tente de novo.');
}

/** Jogador 2: entra pelo código. Também permite o jogador 1 reentrar na própria sala. */
export async function joinRoom(code) {
  let snap;
  try { snap = await get(roomRef(code)); } catch { throw fail('REDE', 'Sem conexão com o servidor.'); }
  if (!snap.exists()) throw fail('SALA_INEXISTENTE', 'Sala não encontrada.');
  const room = snap.val();
  const players = room.players || {};
  if (!players[uid] && Object.keys(players).length >= 2) throw fail('SALA_CHEIA', 'Essa sala já está cheia.');
  if (!players[uid]) {
    await update(roomRef(code), { [`players/${uid}`]: { rows: '', done: false }, status: 'playing' });
  }
  return { code, wordIndex: room.wordIndex };
}

/** Escuta a sala em tempo real. cb(null) = sala apagada. Retorna função para cancelar. */
export const subscribeRoom = (code, cb) => onValue(roomRef(code), s => cb(s.val()), () => cb(undefined));

/** Escuta o estado da conexão (o SDK reconecta sozinho). cb(true|false). */
export const subscribeConnection = cb => onValue(ref(db, '.info/connected'), s => cb(!!s.val()));

/** Publica o progresso: rows = ['PACCA', 'CCCCC'] (só cores, sem revelar letras). */
export const publishProgress = (code, rows, done) =>
  update(ref(db, `${ROOMS}/${code}/players/${uid}`), { rows: rows.join(','), done });

/** Tenta ser o vencedor. A transação garante que só o primeiro a chegar ganha. */
export async function claimVictory(code) {
  const res = await runTransaction(ref(db, `${ROOMS}/${code}/winner`), cur => cur ?? uid);
  return res.snapshot.val() === uid;
}
