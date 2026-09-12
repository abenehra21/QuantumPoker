/*
 * Candy Coven — Quantum Poker
 * quantum.js : an exact state-vector simulator for the cursed coins.
 *
 * The whole game lives in a tiny corner of quantum mechanics, so this is a
 * complete and honest simulation rather than an approximation: an array of
 * 2^n complex amplitudes with the real gates applied to it. For n = 5 that
 * is 32 numbers, which a browser does not notice.
 *
 * Qubit 0 is the least significant bit of the basis index, matching the
 * Qiskit convention used by the original Python implementation in Python/.
 *
 * Copyright (C) 2026 — released under the GNU GPL v3, like the rest of this
 * repository. Original game by Fuchs, Falch & Johnsen (SINTEF); see README.
 */
(function (global) {
  'use strict';

  var R2 = Math.SQRT1_2;
  var EPS = 1e-9;

  /* ------------------------------------------------------------------ *
   * State vector
   * ------------------------------------------------------------------ */

  function QState(n) {
    this.n = n;
    this.size = 1 << n;
    this.re = new Float64Array(this.size);
    this.im = new Float64Array(this.size);
    this.re[0] = 1; // |00…0>
  }

  QState.prototype.clone = function () {
    var s = new QState(this.n);
    s.re.set(this.re);
    s.im.set(this.im);
    return s;
  };

  /** Pauli X — flips a resting coin over, ignores a spinning one. */
  QState.prototype.x = function (q) {
    var b = 1 << q, i, j, t;
    for (i = 0; i < this.size; i++) {
      if (i & b) continue;
      j = i | b;
      t = this.re[i]; this.re[i] = this.re[j]; this.re[j] = t;
      t = this.im[i]; this.im[i] = this.im[j]; this.im[j] = t;
    }
  };

  /** Pauli Z — reverses the direction of a spin, ignores a resting coin. */
  QState.prototype.z = function (q) {
    var b = 1 << q, i;
    for (i = 0; i < this.size; i++) {
      if (i & b) { this.re[i] = -this.re[i]; this.im[i] = -this.im[i]; }
    }
  };

  /** Hadamard — starts a resting coin spinning, or stops a spinning one. */
  QState.prototype.h = function (q) {
    var b = 1 << q, i, j, ar, ai, br, bi;
    for (i = 0; i < this.size; i++) {
      if (i & b) continue;
      j = i | b;
      ar = this.re[i]; ai = this.im[i];
      br = this.re[j]; bi = this.im[j];
      this.re[i] = (ar + br) * R2; this.im[i] = (ai + bi) * R2;
      this.re[j] = (ar - br) * R2; this.im[j] = (ai - bi) * R2;
    }
  };

  /** Z then H — catches a clockwise spin face-up. The "Summon" card. */
  QState.prototype.zh = function (q) {
    this.z(q);
    this.h(q);
  };

  /** Controlled NOT — chains two coins together, or breaks the chain. */
  QState.prototype.cx = function (c, t) {
    if (c === t) throw new Error('cx: control and target must differ');
    var bc = 1 << c, bt = 1 << t, i, j, tmp;
    for (i = 0; i < this.size; i++) {
      if (!(i & bc) || (i & bt)) continue;
      j = i | bt;
      tmp = this.re[i]; this.re[i] = this.re[j]; this.re[j] = tmp;
      tmp = this.im[i]; this.im[i] = this.im[j]; this.im[j] = tmp;
    }
  };

  /** Probability that coin q lands face-up (i.e. measures |1>). */
  QState.prototype.probOne = function (q) {
    var b = 1 << q, p = 0, i;
    for (i = 0; i < this.size; i++) {
      if (i & b) p += this.re[i] * this.re[i] + this.im[i] * this.im[i];
    }
    return p;
  };

  /**
   * Probability of measuring |-> in the +/- basis, i.e. how
   * counter-clockwise the spin is. 0 => |+>, 1 => |->, 0.5 => resting.
   */
  QState.prototype.probMinus = function (q) {
    var b = 1 << q, p = 0, i, j, dr, di;
    for (i = 0; i < this.size; i++) {
      if (i & b) continue;
      j = i | b;
      dr = this.re[i] - this.re[j];
      di = this.im[i] - this.im[j];
      p += dr * dr + di * di;
    }
    return p / 2;
  };

  /**
   * Probabilities that the pair (i, j) is in each of the four Bell states,
   * in the order  |00>+|11>, |00>-|11>, |01>+|10>, |01>-|10>.
   * A value of 1 means the two coins are perfectly chained.
   */
  QState.prototype.bellProbs = function (qa, qb) {
    var ba = 1 << qa, bb = 1 << qb;
    var p = [0, 0, 0, 0];
    var k, a, b, c, d, r, m;
    for (k = 0; k < this.size; k++) {
      if ((k & ba) || (k & bb)) continue;
      a = k; b = k | ba; c = k | bb; d = k | ba | bb;
      r = this.re[a] + this.re[d]; m = this.im[a] + this.im[d]; p[0] += r * r + m * m;
      r = this.re[a] - this.re[d]; m = this.im[a] - this.im[d]; p[1] += r * r + m * m;
      r = this.re[b] + this.re[c]; m = this.im[b] + this.im[c]; p[2] += r * r + m * m;
      r = this.re[b] - this.re[c]; m = this.im[b] - this.im[c]; p[3] += r * r + m * m;
    }
    return [p[0] / 2, p[1] / 2, p[2] / 2, p[3] / 2];
  };

  /** Total probability — should always be 1. Used by the self-checks. */
  QState.prototype.norm = function () {
    var s = 0, i;
    for (i = 0; i < this.size; i++) s += this.re[i] * this.re[i] + this.im[i] * this.im[i];
    return s;
  };

  /** Collapse the whole board once. Returns an array of n bits. */
  QState.prototype.measure = function (rng) {
    var r = rng(), acc = 0, i, k, bits = [];
    var chosen = this.size - 1;
    for (i = 0; i < this.size; i++) {
      acc += this.re[i] * this.re[i] + this.im[i] * this.im[i];
      if (r <= acc) { chosen = i; break; }
    }
    for (k = 0; k < this.n; k++) bits.push((chosen >> k) & 1);
    return bits;
  };

  /* ------------------------------------------------------------------ *
   * Reading a coin
   * ------------------------------------------------------------------ */

  var LOOSE = 1e-6;

  /**
   * What a single coin looks like on the table.
   *   up    — resting, jack-o'-lantern face showing  (|1>)
   *   down  — resting, skull showing                 (|0>)
   *   cw    — spinning clockwise                     (|+>)
   *   ccw   — spinning counter-clockwise             (|->)
   *   murky — chained to another coin, or otherwise undecided
   */
  function readCoin(st, q) {
    var up = st.probOne(q);
    var minus = st.probMinus(q);
    var kind = 'murky';
    if (up > 1 - LOOSE) kind = 'up';
    else if (up < LOOSE) kind = 'down';
    else if (Math.abs(up - 0.5) < LOOSE) {
      if (minus < LOOSE) kind = 'cw';
      else if (minus > 1 - LOOSE) kind = 'ccw';
    }
    return { kind: kind, up: up, minus: minus, ket: KETS[kind] || null };
  }

  var KETS = { up: '|1⟩', down: '|0⟩', cw: '|+⟩', ccw: '|−⟩' };

  /**
   * Every pair of coins that is perfectly chained.
   * `same` is true when the two always land the same way up.
   */
  function findChains(st) {
    var out = [], used = {}, i, j, p, best, k;
    for (i = 0; i < st.n - 1; i++) {
      if (used[i]) continue;
      for (j = i + 1; j < st.n; j++) {
        if (used[j]) continue;
        p = st.bellProbs(i, j);
        best = 0;
        for (k = 1; k < 4; k++) if (p[k] > p[best]) best = k;
        if (p[best] > 1 - LOOSE) {
          out.push({ a: i, b: j, same: best < 2, bell: best });
          used[i] = used[j] = true;
          break;
        }
      }
    }
    return out;
  }

  /** Expected number of face-up coins — the honest value of a board. */
  function expectedScore(st, upTo) {
    var n = upTo === undefined ? st.n : upTo, s = 0, q;
    for (q = 0; q < n; q++) s += st.probOne(q);
    return s;
  }

  /* ------------------------------------------------------------------ *
   * Dealing a board
   * ------------------------------------------------------------------ */

  /**
   * Build a starting board: a few coins chained into pairs, the rest in one
   * of the four plain states. Chains are always disjoint pairs, never
   * three-way tangles, so every chain can be drawn as one visible link and
   * broken with a single Bind.
   */
  function dealBoard(rng, n) {
    n = n || 5;
    var best = null, attempt;
    for (attempt = 0; attempt < 200; attempt++) {
      var st = new QState(n);
      var order = shuffle(range(n), rng);
      var pos = 0;
      var nPairs = pickWeighted([0, 1, 2], [0.25, 0.5, 0.25], rng);
      var p;
      for (p = 0; p < nPairs && pos + 1 < n; p++) {
        var c = order[pos++], t = order[pos++];
        st.h(c);                       // control into a spin
        if (rng() < 0.5) st.z(c);      // clockwise or counter-clockwise
        if (rng() < 0.5) st.x(t);      // chained the same way, or opposite
        st.cx(c, t);
      }
      for (; pos < n; pos++) {
        var q = order[pos];
        var pickState = Math.floor(rng() * 4);
        if (pickState === 1) st.x(q);
        else if (pickState === 2) st.h(q);
        else if (pickState === 3) { st.h(q); st.z(q); }
      }
      if (isPlayable(st)) return st;
      if (!best) best = st;
    }
    return best;
  }

  /**
   * A board is worth playing if it is neither already won nor hopeless:
   * at most two coins handed to you face-up, and at least two coins that a
   * card can actually change.
   */
  function isPlayable(st) {
    var free = 0, given = 0, q, c;
    for (q = 0; q < st.n; q++) {
      c = readCoin(st, q);
      if (c.kind === 'up') given++;
      if (c.kind !== 'up' && c.kind !== 'down') free++;
    }
    return given <= 2 && free >= 2;
  }

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */

  /** Deterministic PRNG so a seed always replays the same game. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function range(n) {
    var a = [], i;
    for (i = 0; i < n; i++) a.push(i);
    return a;
  }

  function shuffle(arr, rng) {
    var i, j, t;
    for (i = arr.length - 1; i > 0; i--) {
      j = Math.floor(rng() * (i + 1));
      t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function pickWeighted(values, weights, rng) {
    var r = rng(), acc = 0, i;
    for (i = 0; i < values.length; i++) {
      acc += weights[i];
      if (r <= acc) return values[i];
    }
    return values[values.length - 1];
  }

  global.Q = {
    QState: QState,
    readCoin: readCoin,
    findChains: findChains,
    expectedScore: expectedScore,
    dealBoard: dealBoard,
    mulberry32: mulberry32,
    shuffle: shuffle,
    range: range,
    EPS: EPS
  };
})(window);
