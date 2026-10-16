// Compact chess engine: legal move generation (castling, en passant, promotion) + alpha-beta search.
// Board: 64 squares, index = row*8 + col, row 0 = rank 8 (black's back rank). White pieces uppercase.

const N = -8, S = 8, E = 1, W = -1;
const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]], ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
export const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const isW = (p) => p && p === p.toUpperCase();
const side = (p) => (p ? (isW(p) ? "w" : "b") : null);
const rc = (i) => [i >> 3, i & 7];
const on = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function initial() {
  const b = Array(64).fill("");
  const back = "rnbqkbnr";
  for (let c = 0; c < 8; c++) { b[c] = back[c]; b[8 + c] = "p"; b[48 + c] = "P"; b[56 + c] = back[c].toUpperCase(); }
  return { b, turn: "w", castle: { K: true, Q: true, k: true, q: true }, ep: -1, half: 0, full: 1 };
}

export function attacked(st, sq, by) {
  const b = st.b; const [r, c] = rc(sq);
  const pawnDir = by === "w" ? 1 : -1; // attacker pawns sit "below" (white) or "above" (black)
  for (const dc of [-1, 1]) { const rr = r + pawnDir, cc = c + dc; if (on(rr, cc)) { const p = b[rr * 8 + cc]; if (p && side(p) === by && p.toLowerCase() === "p") return true; } }
  for (const [dr, dc] of KN) { const rr = r + dr, cc = c + dc; if (on(rr, cc)) { const p = b[rr * 8 + cc]; if (p && side(p) === by && p.toLowerCase() === "n") return true; } }
  for (const [dr, dc] of KG) { const rr = r + dr, cc = c + dc; if (on(rr, cc)) { const p = b[rr * 8 + cc]; if (p && side(p) === by && p.toLowerCase() === "k") return true; } }
  for (const [dirs, kinds] of [[DIAG, "bq"], [ORTH, "rq"]]) {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (on(rr, cc)) { const p = b[rr * 8 + cc]; if (p) { if (side(p) === by && kinds.includes(p.toLowerCase())) return true; break; } rr += dr; cc += dc; }
    }
  }
  return false;
}
export function kingSq(st, s) { const k = s === "w" ? "K" : "k"; return st.b.indexOf(k); }
export function inCheck(st, s = st.turn) { return attacked(st, kingSq(st, s), s === "w" ? "b" : "w"); }

function pseudo(st) {
  const b = st.b, me = st.turn, moves = [];
  const add = (from, to, extra = {}) => moves.push({ from, to, piece: b[from], cap: b[to], ...extra });
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (!p || side(p) !== me) continue;
    const t = p.toLowerCase(); const [r, c] = rc(i);
    if (t === "p") {
      const dir = me === "w" ? -1 : 1, start = me === "w" ? 6 : 1, last = me === "w" ? 0 : 7;
      const r1 = r + dir;
      if (on(r1, c) && !b[r1 * 8 + c]) {
        add(i, r1 * 8 + c, r1 === last ? { promo: me === "w" ? "Q" : "q" } : {});
        const r2 = r + 2 * dir;
        if (r === start && !b[r2 * 8 + c]) add(i, r2 * 8 + c, { dbl: true });
      }
      for (const dc of [-1, 1]) {
        const cc = c + dc; if (!on(r1, cc)) continue;
        const to = r1 * 8 + cc;
        if (b[to] && side(b[to]) !== me) add(i, to, r1 === last ? { promo: me === "w" ? "Q" : "q" } : {});
        else if (to === st.ep) add(i, to, { ep: true, cap: me === "w" ? "p" : "P" });
      }
    } else if (t === "n" || t === "k") {
      for (const [dr, dc] of t === "n" ? KN : KG) { const rr = r + dr, cc = c + dc; if (!on(rr, cc)) continue; const to = rr * 8 + cc; if (!b[to] || side(b[to]) !== me) add(i, to); }
      if (t === "k") {
        const opp = me === "w" ? "b" : "w", row = me === "w" ? 7 : 0;
        if (i === row * 8 + 4 && !attacked(st, i, opp)) {
          const K = me === "w" ? "K" : "k", Q = me === "w" ? "Q" : "q";
          if (st.castle[K] && !b[row * 8 + 5] && !b[row * 8 + 6] && !attacked(st, row * 8 + 5, opp) && !attacked(st, row * 8 + 6, opp)) add(i, row * 8 + 6, { castle: "K" });
          if (st.castle[Q] && !b[row * 8 + 3] && !b[row * 8 + 2] && !b[row * 8 + 1] && !attacked(st, row * 8 + 3, opp) && !attacked(st, row * 8 + 2, opp)) add(i, row * 8 + 2, { castle: "Q" });
        }
      }
    } else {
      const dirs = t === "b" ? DIAG : t === "r" ? ORTH : [...DIAG, ...ORTH];
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (on(rr, cc)) { const to = rr * 8 + cc; if (b[to]) { if (side(b[to]) !== me) add(i, to); break; } add(i, to); rr += dr; cc += dc; }
      }
    }
  }
  return moves;
}

export function make(st, m) {
  const b = st.b;
  const undo = { castle: { ...st.castle }, ep: st.ep, half: st.half, full: st.full, capSq: m.to, capPiece: b[m.to] };
  b[m.to] = m.promo || b[m.from]; b[m.from] = "";
  if (m.ep) { const capSq = m.to + (st.turn === "w" ? S : N); undo.capSq = capSq; undo.capPiece = b[capSq]; b[capSq] = ""; }
  if (m.castle) {
    const row = st.turn === "w" ? 7 : 0;
    if (m.castle === "K") { b[row * 8 + 5] = b[row * 8 + 7]; b[row * 8 + 7] = ""; } else { b[row * 8 + 3] = b[row * 8 + 0]; b[row * 8 + 0] = ""; }
  }
  const t = m.piece.toLowerCase();
  if (t === "k") { if (st.turn === "w") st.castle.K = st.castle.Q = false; else st.castle.k = st.castle.q = false; }
  for (const [sq, key] of [[63, "K"], [56, "Q"], [7, "k"], [0, "q"]]) if (m.from === sq || m.to === sq) st.castle[key] = false;
  st.ep = m.dbl ? (m.from + m.to) / 2 : -1;
  st.half = t === "p" || m.cap ? 0 : st.half + 1;
  if (st.turn === "b") st.full++;
  st.turn = st.turn === "w" ? "b" : "w";
  return undo;
}
export function unmake(st, m, u) {
  const b = st.b;
  st.turn = st.turn === "w" ? "b" : "w";
  b[m.from] = m.piece; b[m.to] = "";
  if (u.capPiece) b[u.capSq] = u.capPiece;
  if (m.castle) {
    const row = st.turn === "w" ? 7 : 0;
    if (m.castle === "K") { b[row * 8 + 7] = b[row * 8 + 5]; b[row * 8 + 5] = ""; } else { b[row * 8 + 0] = b[row * 8 + 3]; b[row * 8 + 3] = ""; }
  }
  st.castle = u.castle; st.ep = u.ep; st.half = u.half; st.full = u.full;
}

export function legal(st) {
  const me = st.turn, out = [];
  for (const m of pseudo(st)) { const u = make(st, m); if (!inCheck(st, me)) out.push(m); unmake(st, m, u); }
  return out;
}
export function status(st) {
  const ms = legal(st);
  if (ms.length) return st.half >= 100 ? "draw" : insufficient(st) ? "draw" : "play";
  return inCheck(st) ? "mate" : "stalemate";
}
function insufficient(st) { const p = st.b.filter((x) => x && x.toLowerCase() !== "k"); return p.length === 0 || (p.length === 1 && "nb".includes(p[0].toLowerCase())); }

// ---------------------------------------------------------------- evaluation + search
const PST_N = [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30, -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50];
const PST_P = [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0];
const PST_B = [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20];
const PST_K = [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20];
const PST = { p: PST_P, n: PST_N, b: PST_B, k: PST_K };

export function evaluate(st) {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = st.b[i]; if (!p) continue;
    const t = p.toLowerCase(), w = isW(p);
    const pst = PST[t] ? PST[t][w ? i : (7 - (i >> 3)) * 8 + (i & 7)] : 0;
    s += (w ? 1 : -1) * (VAL[t] + pst);
  }
  return st.turn === "w" ? s : -s;
}

function order(ms) { return ms.sort((a, b) => (b.cap ? VAL[b.cap.toLowerCase()] * 10 - VAL[b.piece.toLowerCase()] : 0) + (b.promo ? 800 : 0) - ((a.cap ? VAL[a.cap.toLowerCase()] * 10 - VAL[a.piece.toLowerCase()] : 0) + (a.promo ? 800 : 0))); }

function quiesce(st, alpha, beta, depth) {
  const stand = evaluate(st);
  if (stand >= beta) return beta;
  if (alpha < stand) alpha = stand;
  if (depth <= 0) return alpha;
  for (const m of order(pseudo(st).filter((m) => m.cap))) {
    const me = st.turn; const u = make(st, m);
    if (inCheck(st, me)) { unmake(st, m, u); continue; }
    const sc = -quiesce(st, -beta, -alpha, depth - 1);
    unmake(st, m, u);
    if (sc >= beta) return beta;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}
function negamax(st, depth, alpha, beta) {
  if (depth === 0) return quiesce(st, alpha, beta, 3);
  const ms = order(legal(st));
  if (!ms.length) return inCheck(st) ? -99999 + (10 - depth) : 0;
  for (const m of ms) {
    const u = make(st, m);
    const sc = -negamax(st, depth - 1, -beta, -alpha);
    unmake(st, m, u);
    if (sc >= beta) return beta;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}
/** Best move for the side to move. level: 1 easy, 2 normal, 3 hard. */
export function bestMove(st, level = 2) {
  const ms = order(legal(st));
  if (!ms.length) return null;
  const depth = level >= 3 ? 3 : level === 2 ? 2 : 1;
  let best = null, bestSc = -Infinity;
  for (const m of ms) {
    const u = make(st, m);
    let sc = -negamax(st, depth - 1, -Infinity, Infinity);
    unmake(st, m, u);
    if (level === 1) sc += Math.random() * 120;
    else sc += Math.random() * 8;
    if (sc > bestSc) { bestSc = sc; best = m; }
  }
  return best;
}
