/*
 * Quantum Hold'em — quantum.js
 * An exact state-vector simulator for the five coins on the table.
 *
 * The coins are qubits. This keeps all 2^n complex amplitudes and applies the
 * real gate matrices to them, so every probability the table shows is the
 * genuine quantum answer. For n = 5 that is 32 numbers.
 *
 * Qubit 0 is the least significant bit of the basis index (Qiskit order),
 * matching the original SINTEF implementation in Python/.
 *
 * No DOM in here. Runs in the browser and in Node.
 */
(function (root) {
  'use strict';

  const R2 = Math.SQRT1_2;
  const LOOSE = 1e-6;

  class QState {
    constructor(n) {
      this.n = n;
      this.size = 1 << n;
      this.re = new Float64Array(this.size);
      this.im = new Float64Array(this.size);
      this.re[0] = 1; // |00…0⟩
    }

    clone() {
      const s = new QState(this.n);
      s.re.set(this.re);
      s.im.set(this.im);
      return s;
    }

    /** Pauli X: 0 ↔ 1. A spinning coin is unchanged. */
    x(q) {
      const b = 1 << q;
      for (let i = 0; i < this.size; i++) {
        if (i & b) continue;
        const j = i | b;
        let t = this.re[i]; this.re[i] = this.re[j]; this.re[j] = t;
        t = this.im[i]; this.im[i] = this.im[j]; this.im[j] = t;
      }
    }

    /** Pauli Z: + ↔ −. A settled coin is unchanged. */
    z(q) {
      const b = 1 << q;
      for (let i = 0; i < this.size; i++) {
        if (i & b) { this.re[i] = -this.re[i]; this.im[i] = -this.im[i]; }
      }
    }

    /** Hadamard: 0 ↔ +, 1 ↔ −. */
    h(q) {
      const b = 1 << q;
      for (let i = 0; i < this.size; i++) {
        if (i & b) continue;
        const j = i | b;
        const ar = this.re[i], ai = this.im[i], br = this.re[j], bi = this.im[j];
        this.re[i] = (ar + br) * R2; this.im[i] = (ai + bi) * R2;
        this.re[j] = (ar - br) * R2; this.im[j] = (ai - bi) * R2;
      }
    }

    /** Controlled NOT: flips t when c is 1; entangles when c is spinning. */
    cx(c, t) {
      if (c === t) throw new Error('cx: control and target must differ');
      const bc = 1 << c, bt = 1 << t;
      for (let i = 0; i < this.size; i++) {
        if (!(i & bc) || (i & bt)) continue;
        const j = i | bt;
        let tmp = this.re[i]; this.re[i] = this.re[j]; this.re[j] = tmp;
        tmp = this.im[i]; this.im[i] = this.im[j]; this.im[j] = tmp;
      }
    }

    /** Probability that coin q measures 1. */
    probOne(q) {
      const b = 1 << q;
      let p = 0;
      for (let i = 0; i < this.size; i++) {
        if (i & b) p += this.re[i] * this.re[i] + this.im[i] * this.im[i];
      }
      return p;
    }

    /** Probability of |−⟩ in the ± basis: 0 → +, 1 → −, 0.5 → settled. */
    probMinus(q) {
      const b = 1 << q;
      let p = 0;
      for (let i = 0; i < this.size; i++) {
        if (i & b) continue;
        const j = i | b;
        const dr = this.re[i] - this.re[j], di = this.im[i] - this.im[j];
        p += dr * dr + di * di;
      }
      return p / 2;
    }

    /**
     * Weight of the pair (a, b) on each Bell state, in the order
     * |00⟩+|11⟩, |00⟩−|11⟩, |01⟩+|10⟩, |01⟩−|10⟩. A 1 means perfectly linked.
     */
    bellProbs(qa, qb) {
      const ba = 1 << qa, bb = 1 << qb;
      const p = [0, 0, 0, 0];
      for (let k = 0; k < this.size; k++) {
        if ((k & ba) || (k & bb)) continue;
        const a = k, b = k | ba, c = k | bb, d = k | ba | bb;
        let r = this.re[a] + this.re[d], m = this.im[a] + this.im[d]; p[0] += r * r + m * m;
        r = this.re[a] - this.re[d]; m = this.im[a] - this.im[d]; p[1] += r * r + m * m;
        r = this.re[b] + this.re[c]; m = this.im[b] + this.im[c]; p[2] += r * r + m * m;
        r = this.re[b] - this.re[c]; m = this.im[b] - this.im[c]; p[3] += r * r + m * m;
      }
      return p.map((v) => v / 2);
    }

    /**
     * Project coin q onto `bit` and renormalise. Returns the probability that
     * outcome had; 0 means it was impossible and the state is left untouched.
     * This is a real projective measurement: every superposition and link
     * through this coin is destroyed.
     */
    project(q, bit) {
      const b = 1 << q;
      const p1 = this.probOne(q);
      const keep = bit ? p1 : 1 - p1;
      if (keep < 1e-12) return 0;
      const scale = 1 / Math.sqrt(keep);
      for (let i = 0; i < this.size; i++) {
        if (((i & b) ? 1 : 0) === bit) { this.re[i] *= scale; this.im[i] *= scale; }
        else { this.re[i] = 0; this.im[i] = 0; }
      }
      return keep;
    }

    /** Measure one coin with a random outcome and keep the collapsed state. */
    collapse(q, rng) {
      const p1 = this.probOne(q);
      let bit = rng() < p1 ? 1 : 0;
      if (!this.project(q, bit)) { bit = 1 - bit; this.project(q, bit); }
      return bit;
    }

    /** True when the two states are equal up to a global phase: |⟨a|b⟩|² = 1. */
    same(o) {
      let re = 0, im = 0;
      for (let i = 0; i < this.size; i++) {
        re += this.re[i] * o.re[i] + this.im[i] * o.im[i];
        im += this.re[i] * o.im[i] - this.im[i] * o.re[i];
      }
      return re * re + im * im > 1 - 1e-9;
    }

    /** Total probability. Always 1; the self-checks verify it. */
    norm() {
      let s = 0;
      for (let i = 0; i < this.size; i++) s += this.re[i] * this.re[i] + this.im[i] * this.im[i];
      return s;
    }

    /** Collapse the whole board once. Returns n bits, coin 0 first. */
    measure(rng) {
      const r = rng();
      let acc = 0, chosen = this.size - 1;
      for (let i = 0; i < this.size; i++) {
        acc += this.re[i] * this.re[i] + this.im[i] * this.im[i];
        if (r <= acc) { chosen = i; break; }
      }
      const bits = [];
      for (let k = 0; k < this.n; k++) bits.push((chosen >> k) & 1);
      return bits;
    }
  }

  /* ------------------------------------------------------------------ *
   * Reading a coin
   * ------------------------------------------------------------------ */

  const KETS = { one: '|1⟩', zero: '|0⟩', plus: '|+⟩', minus: '|−⟩', mixed: 'ρ' };

  /**
   * What a single coin looks like on the table:
   *   one    settled, showing 1          |1⟩
   *   zero   settled, showing 0          |0⟩
   *   plus   spinning, + tilt            |+⟩
   *   minus  spinning, − tilt            |−⟩
   *   mixed  linked to another coin (or otherwise undecided)
   */
  function readCoin(st, q) {
    const up = st.probOne(q);
    const minus = st.probMinus(q);
    let kind = 'mixed';
    if (up > 1 - LOOSE) kind = 'one';
    else if (up < LOOSE) kind = 'zero';
    else if (Math.abs(up - 0.5) < LOOSE) {
      if (minus < LOOSE) kind = 'plus';
      else if (minus > 1 - LOOSE) kind = 'minus';
    }
    return { kind, up, minus, ket: KETS[kind] };
  }

  /** Every pair of coins that is perfectly linked. `same` → land alike. */
  function findLinks(st) {
    const out = [], used = {};
    for (let i = 0; i < st.n - 1; i++) {
      if (used[i]) continue;
      for (let j = i + 1; j < st.n; j++) {
        if (used[j]) continue;
        const p = st.bellProbs(i, j);
        let best = 0;
        for (let k = 1; k < 4; k++) if (p[k] > p[best]) best = k;
        if (p[best] > 1 - LOOSE) {
          out.push({ a: i, b: j, same: best < 2, bell: best });
          used[i] = used[j] = true;
          break;
        }
      }
    }
    return out;
  }

  /** Expected number of coins landing 1 among the first `upTo`. */
  function expectedScore(st, upTo) {
    const n = upTo === undefined ? st.n : upTo;
    let s = 0;
    for (let q = 0; q < n; q++) s += st.probOne(q);
    return s;
  }

  /* ------------------------------------------------------------------ *
   * Dealing a board
   * ------------------------------------------------------------------ */

  /**
   * A fresh board: maybe a linked pair, the rest in one of the four plain
   * states. Links are disjoint pairs so each can be drawn as one arc and
   * broken with one Link card. Boards that are already won or hopeless are
   * redealt.
   */
  const PLAIN_WEIGHTS = [0.38, 0.12, 0.32, 0.18];

  function dealBoard(rng, n = 5) {
    let fallback = null;
    for (let attempt = 0; attempt < 200; attempt++) {
      const st = new QState(n);
      const order = shuffle(range(n), rng);
      let pos = 0;
      const nPairs = pickWeighted([0, 1, 2], [0.45, 0.45, 0.10], rng);
      for (let p = 0; p < nPairs && pos + 1 < n; p++) {
        const c = order[pos++], t = order[pos++];
        st.h(c);
        if (rng() < 0.5) st.z(c);
        if (rng() < 0.5) st.x(t);
        st.cx(c, t);
      }
      for (; pos < n; pos++) {
        const q = order[pos];
        const pick = pickWeighted(['zero', 'one', 'plus', 'minus'], PLAIN_WEIGHTS, rng);
        if (pick === 'one') st.x(q);
        else if (pick === 'plus') st.h(q);
        else if (pick === 'minus') { st.h(q); st.z(q); }
      }
      if (isPlayable(st)) return st;
      if (!fallback) fallback = st;
    }
    return fallback;
  }

  /** At most one coin handed out as a 1, and at least two a card can change. */
  function isPlayable(st) {
    let given = 0, free = 0;
    for (let q = 0; q < st.n; q++) {
      const k = readCoin(st, q).kind;
      if (k === 'one') given++;
      if (k !== 'one' && k !== 'zero') free++;
    }
    return given <= 1 && free >= 2;
  }

  /* ------------------------------------------------------------------ *
   * Randomness
   * ------------------------------------------------------------------ */

  /** Deterministic PRNG so a seed always deals the same game. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Mix two integers into one seed (for per-hand deal streams). */
  function mix(a, b) {
    let h = (a ^ 0x9E3779B9) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
    h = (h ^ b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  function range(n) { return Array.from({ length: n }, (_, i) => i); }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function pickWeighted(values, weights, rng) {
    const r = rng();
    let acc = 0;
    for (let i = 0; i < values.length; i++) {
      acc += weights[i];
      if (r <= acc) return values[i];
    }
    return values[values.length - 1];
  }

  root.Q = { QState, readCoin, findLinks, expectedScore, dealBoard, mulberry32, mix, range, shuffle, KETS };
})(typeof window !== 'undefined' ? window : globalThis);
