/*
 * Quantum Hold'em — engine.js
 * The rules: chips, streets, betting, the five gate cards, showdown.
 *
 * No DOM in here. The whole game can be driven from a script, which is how
 * the bots and the self-checks use it.
 */
(function (root) {
  'use strict';

  const Q = root.Q;
  const LOOSE = 1e-6;

  /* ------------------------------------------------------------------ *
   * Cards
   * ------------------------------------------------------------------ */

  const CARDS = {
    X:  { id: 'X',  name: 'Flip',     gate: 'X',    arity: 1,
          blurb: 'Turns 0 into 1 and 1 into 0. A spinning coin ignores it.' },
    H:  { id: 'H',  name: 'Spin',     gate: 'H',    arity: 1,
          blurb: 'Spins a settled coin. Stops a spinning one: + lands on 0, − lands on 1.' },
    Z:  { id: 'Z',  name: 'Twist',    gate: 'Z',    arity: 1,
          blurb: 'Turns a + spin into − and back. Does nothing to a settled coin.' },
    CX: { id: 'CX', name: 'Link',     gate: 'CNOT', arity: 2,
          blurb: 'If the first coin is 1, flips the second. If it is spinning, links the two.' },
    M:  { id: 'M',  name: 'Collapse', gate: 'measure', arity: 1,
          blurb: 'Lands a spinning coin right now, on your board. You can still play on it.' }
  };
  const CARD_ORDER = ['X', 'H', 'Z', 'CX', 'M'];

  /** How many of each card go in the deck for n seats. */
  function deckFor(n) {
    const deck = [];
    const counts = { X: n, H: n, Z: Math.max(1, Math.round(n * 0.75)), CX: n, M: Math.ceil(n / 2) };
    CARD_ORDER.forEach((id) => { for (let i = 0; i < counts[id]; i++) deck.push(id); });
    return deck;
  }

  /** Apply a card to a board. Collapse needs an rng and returns the bit. */
  function applyCard(state, id, targets, rng) {
    switch (id) {
      case 'X':  state.x(targets[0]); return null;
      case 'H':  state.h(targets[0]); return null;
      case 'Z':  state.z(targets[0]); return null;
      case 'CX': state.cx(targets[0], targets[1]); return null;
      case 'M':  return state.collapse(targets[0], rng);
      default: throw new Error('unknown card ' + id);
    }
  }

  const KIND_WORDS = { one: 'lands on 1', zero: 'lands on 0', plus: 'spins +', minus: 'spins −', mixed: 'stays 50/50' };

  function coinPhrase(state, q) {
    return 'coin ' + (q + 1) + ' ' + KIND_WORDS[Q.readCoin(state, q).kind];
  }

  function isLinked(state, a, b) {
    return Q.findLinks(state).some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
  }

  /** What a card would do here, in plain words, before you commit. */
  function previewCard(state, id, targets, upTo) {
    const card = CARDS[id];
    if (targets.length < card.arity) return null;
    if (card.arity === 2 && targets[0] === targets[1]) return null;
    const before = Q.expectedScore(state, upTo);

    if (id === 'M') {
      const p = state.probOne(targets[0]);
      const settled = p < LOOSE || p > 1 - LOOSE;
      const link = Q.findLinks(state).find((l) => l.a === targets[0] || l.b === targets[0]);
      return {
        text: settled ? 'coin ' + (targets[0] + 1) + ' is already settled — nothing happens'
          : 'coin ' + (targets[0] + 1) + ' lands now: ' + Math.round(p * 100) + '% chance of a 1'
            + (link ? ', and its linked partner lands with it' : ''),
        delta: 0, noop: settled, state: state.clone()
      };
    }

    const after = state.clone();
    applyCard(after, id, targets);
    const delta = Q.expectedScore(after, upTo) - before;
    const changed = !state.same(after);
    let text;
    if (card.arity === 1) {
      text = changed ? coinPhrase(after, targets[0]) : 'nothing changes';
    } else {
      const was = isLinked(state, targets[0], targets[1]);
      const now = isLinked(after, targets[0], targets[1]);
      if (now && !was) text = 'coins ' + (targets[0] + 1) + ' and ' + (targets[1] + 1) + ' become linked';
      else if (was && !now) text = 'the link between ' + (targets[0] + 1) + ' and ' + (targets[1] + 1) + ' breaks';
      else if (!changed) text = 'nothing changes';
      else text = coinPhrase(after, targets[1]) + (Q.readCoin(after, targets[0]).kind !== Q.readCoin(state, targets[0]).kind
        ? ', ' + coinPhrase(after, targets[0]) : '');
    }
    return { text, delta, noop: !changed, state: after };
  }

  function describePlay(id, targets) {
    return CARDS[id].name + ' ' + targets.map((t) => t + 1).join('→');
  }

  /* ------------------------------------------------------------------ *
   * Planning: the best way to spend a hand of cards on a board
   * ------------------------------------------------------------------ */

  const SINGLES = {}, PAIRS = {};
  function singles(n) {
    if (!SINGLES[n]) SINGLES[n] = Q.range(n).map((i) => [i]);
    return SINGLES[n];
  }
  function pairs(n) {
    if (!PAIRS[n]) {
      PAIRS[n] = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) PAIRS[n].push([i, j]);
    }
    return PAIRS[n];
  }

  /**
   * Exhaustive search over every order and target of the cards in `hand`,
   * counting only the first `upTo` coins. Collapse branches on both outcomes,
   * weighted by their probability. Returns the expected score and the first
   * play of the best line (null when playing nothing is best).
   *
   * Worst case is three Link cards: 20³ leaves of a 32-amplitude state.
   * A phone does that in a few milliseconds.
   */
  function plan(state, hand, upTo) {
    const n = upTo === undefined ? state.n : upTo;

    /** The kicker: how the board reads as a binary number, coin 1 highest. */
    function kicker(st) {
      let k = 0;
      for (let q = 0; q < n; q++) k += st.probOne(q) * Math.pow(2, n - 1 - q);
      return k / Math.pow(2, n);
    }

    // A line is better when it expects more coins on 1; among equals, the one
    // that spends fewer cards (so the hint never opens with busywork); among
    // those, the one that lands its 1s further left, matching the tie rule.
    function better(v, u, k, best) {
      if (v > best.value + 1e-9) return true;
      if (v < best.value - 1e-9) return false;
      if (u < best.used - 1e-9) return true;
      if (u > best.used + 1e-9) return false;
      return k > best.kicker + 1e-9;
    }

    function best(st, cards) {
      const out = { value: Q.expectedScore(st, n), first: null, used: 0, kicker: kicker(st) };
      const seen = new Set();
      cards.forEach((id, idx) => {
        if (seen.has(id)) return;
        seen.add(id);
        const rest = cards.slice(); rest.splice(idx, 1);
        const targetSets = CARDS[id].arity === 1 ? singles(n) : pairs(n);
        for (const t of targetSets) {
          let v, u, k;
          if (id === 'M') {
            const p1 = st.probOne(t[0]);
            if (p1 < LOOSE || p1 > 1 - LOOSE) continue;
            const s1 = st.clone(); s1.project(t[0], 1);
            const s0 = st.clone(); s0.project(t[0], 0);
            const b1 = best(s1, rest), b0 = best(s0, rest);
            v = p1 * b1.value + (1 - p1) * b0.value;
            u = 1 + p1 * b1.used + (1 - p1) * b0.used;
            k = p1 * b1.kicker + (1 - p1) * b0.kicker;
          } else {
            const s = st.clone();
            applyCard(s, id, t);
            if (s.same(st)) continue;           // a play that changes nothing is never needed
            const b = best(s, rest);
            v = b.value; u = 1 + b.used; k = b.kicker;
          }
          if (better(v, u, k, out)) { out.value = v; out.used = u; out.kicker = k; out.first = { card: id, targets: t }; }
        }
      });
      return out;
    }
    return best(state, hand.slice());
  }

  /* ------------------------------------------------------------------ *
   * Hand ranks and pots
   * ------------------------------------------------------------------ */

  const RANKS = ['Blank', 'One', 'Pair', 'Trips', 'Quads', 'Coherence'];
  const STREETS = ['Deal', 'Flop', 'Turn', 'River'];

  /**
   * Most coins on 1 wins. Tied counts go to whoever has a 1 further left —
   * coin 1 is the ace — so the five coins read like a hand with a kicker.
   * Identical boards split the pot.
   */
  function rankKey(bits) {
    let value = 0;
    bits.forEach((b, i) => { value += b << (bits.length - 1 - i); });
    return bits.reduce((a, b) => a + b, 0) * (1 << bits.length) + value;
  }

  function rankName(score) {
    return RANKS[Math.max(0, Math.min(RANKS.length - 1, score))];
  }

  /** Main pot plus side pots, each with the seats allowed to win it. */
  function buildPots(players) {
    const levels = [];
    players.forEach((p) => { if (p.committed > 0 && !levels.includes(p.committed)) levels.push(p.committed); });
    levels.sort((a, b) => a - b);
    const pots = [];
    let prev = 0;
    levels.forEach((lvl) => {
      let amount = 0;
      const eligible = [];
      players.forEach((p, i) => {
        amount += Math.min(p.committed, lvl) - Math.min(p.committed, prev);
        if (p.committed >= lvl && !p.folded) eligible.push(i);
      });
      if (amount > 0) pots.push({ amount, eligible });
      prev = lvl;
    });
    return pots;
  }

  /* ------------------------------------------------------------------ *
   * Game
   * ------------------------------------------------------------------ */

  class Game {
    /**
     * seats: [{ name, avatar, bot }]  — bot is a persona object or null.
     * seed:  any integer. Every hand's board and deck come from the seed and
     *        the hand number alone, so a Daily Deal is the same for everyone
     *        no matter how they play it.
     */
    constructor(opts) {
      this.seed = (opts.seed === undefined || opts.seed === null) ? (Date.now() & 0x7fffffff) : opts.seed >>> 0;
      this.rng = Q.mulberry32(Q.mix(this.seed, 0xC0FFEE));   // measurement + bot dice
      this.startChips = opts.startChips || 1000;
      this.baseBlind = opts.smallBlind || 10;
      this.handsPerLevel = opts.handsPerLevel || 5;
      this.maxHands = opts.maxHands || 0;
      this.coins = opts.coins || 5;
      this.handNo = 0;
      this.dealer = 0;
      this.log = [];
      this.history = [];
      this.players = opts.seats.map((s, i) => ({
        seat: i, name: s.name, avatar: s.avatar || 0, bot: s.bot || null,
        chips: this.startChips, bet: 0, committed: 0,
        folded: false, allIn: false, acted: false, out: false,
        hand: [], board: null, plays: [], bits: null, score: null, won: 0,
        handsWon: 0
      }));
      this.n = this.players.length;
      this.startHand();
    }

    /* ---- queries ---- */

    live() { return this.players.filter((p) => !p.out); }
    inHand() { return this.players.filter((p) => !p.out && !p.folded); }
    humans() { return this.players.filter((p) => !p.bot); }
    canAct(p) { return !p.out && !p.folded && !p.allIn && p.chips > 0; }
    potTotal() { return this.players.reduce((s, p) => s + p.committed, 0); }
    street() { return this.phase === 'gates' ? 'Play your cards' : this.phase === 'betting' ? STREETS[this.round] : 'Showdown'; }
    current() { return this.actor >= 0 ? this.players[this.actor] : null; }

    /** Seats still in the game, starting from the dealer. */
    liveSeats() {
      const out = [];
      for (let k = 0; k < this.n; k++) {
        const i = (this.dealer + k) % this.n;
        if (!this.players[i].out) out.push(i);
      }
      return out;
    }

    note(text) {
      this.message = text;
      this.log.push(text);
      if (this.log.length > 80) this.log.shift();
    }

    /* ---- starting a hand ---- */

    startHand() {
      this.handNo++;
      this.blindLevel = Math.min(6, Math.floor((this.handNo - 1) / this.handsPerLevel));
      this.smallBlind = this.baseBlind * Math.pow(2, this.blindLevel);
      this.bigBlind = this.smallBlind * 2;
      this.phase = 'betting';
      this.round = 0;
      this.revealed = 0;
      this.results = null;
      this.lastCollapse = null;

      const dealRng = Q.mulberry32(Q.mix(this.seed, this.handNo));
      this.origin = Q.dealBoard(dealRng, this.coins);
      this.players.forEach((p) => {
        p.bet = 0; p.committed = 0; p.won = 0;
        p.folded = p.out; p.allIn = false; p.acted = false;
        p.score = null; p.bits = null; p.plays = [];
        p.board = this.origin.clone();
        p.hand = [];
      });
      this.dealCards(dealRng);

      // Blinds sit left of the dealer. Heads-up, the dealer posts the small
      // blind and acts first before the flop; after it, the other seat does.
      const seats = this.liveSeats();
      const hu = seats.length === 2;
      const sb = hu ? seats[0] : seats[1], bb = hu ? seats[1] : seats[2];
      this.sbSeat = sb; this.bbSeat = bb;
      this.forceBet(sb, this.smallBlind);
      this.forceBet(bb, this.bigBlind);
      this.currentBet = this.bigBlind;
      this.minRaise = this.bigBlind;

      this.actor = hu ? seats[0] : seats[3 % seats.length];
      if (!this.canAct(this.players[this.actor])) this.actor = this.nextActor(this.actor);
      this.note('Hand ' + this.handNo + ' — blinds ' + this.smallBlind + '/' + this.bigBlind + '.');
      if (this.actor < 0) this.closeRound();
    }

    /** Three cards each from a shared deck; the leftovers stay hidden. */
    dealCards(rng) {
      const seats = this.liveSeats();
      const deck = Q.shuffle(deckFor(seats.length), rng);
      for (let i = 0; i < 3; i++) seats.forEach((s) => { this.players[s].hand.push(deck.pop()); });
      this.players.forEach((p) => { p.hand.sort((a, b) => CARD_ORDER.indexOf(a) - CARD_ORDER.indexOf(b)); });
    }

    /* ---- betting ---- */

    forceBet(seat, amount) {
      const p = this.players[seat];
      const pay = Math.min(amount, p.chips);
      p.chips -= pay; p.bet += pay; p.committed += pay;
      if (p.chips === 0) p.allIn = true;
      return pay;
    }

    toCall(seat) {
      const p = this.players[seat];
      return Math.max(0, Math.min(this.currentBet - p.bet, p.chips));
    }

    minRaiseTo(seat) {
      const p = this.players[seat];
      return Math.min(this.currentBet + this.minRaise, p.bet + p.chips);
    }

    maxRaiseTo(seat) {
      const p = this.players[seat];
      return p.bet + p.chips;
    }

    fold() {
      if (this.phase !== 'betting') return false;
      const p = this.players[this.actor];
      p.folded = true; p.acted = true;
      this.note(p.name + ' folds.');
      this.afterAction();
      return true;
    }

    call() {
      if (this.phase !== 'betting') return false;
      const seat = this.actor, p = this.players[seat];
      const amount = this.toCall(seat);
      this.forceBet(seat, amount);
      p.acted = true;
      this.note(amount === 0 ? p.name + ' checks.' : p.name + (p.allIn ? ' calls all in for ' : ' calls ') + amount + '.');
      this.afterAction();
      return true;
    }

    /** Raise the total bet this street to `to`. */
    raiseTo(to) {
      if (this.phase !== 'betting') return { ok: false, why: 'not betting' };
      const seat = this.actor, p = this.players[seat];
      const max = p.bet + p.chips;
      to = Math.round(to);
      if (to > max) return { ok: false, why: 'You only have ' + max + '.' };
      const allIn = to === max;
      if (!allIn && to < this.currentBet + this.minRaise) {
        return { ok: false, why: 'Raise to at least ' + (this.currentBet + this.minRaise) + ', or go all in.' };
      }
      if (to <= p.bet) return { ok: false, why: 'That is not a raise.' };
      this.forceBet(seat, to - p.bet);
      if (p.bet > this.currentBet) {
        this.minRaise = Math.max(this.minRaise, p.bet - this.currentBet);
        this.currentBet = p.bet;
        this.players.forEach((q) => { if (q.seat !== seat) q.acted = false; });
      }
      p.acted = true;
      this.note(p.name + (p.allIn ? ' goes all in for ' : ' raises to ') + p.bet + '.');
      this.afterAction();
      return { ok: true };
    }

    nextActor(from) {
      for (let k = 1; k <= this.n; k++) {
        const i = (from + k) % this.n, p = this.players[i];
        if (this.canAct(p) && (!p.acted || p.bet < this.currentBet)) return i;
      }
      return -1;
    }

    afterAction() {
      if (this.inHand().length <= 1) { this.endHandUncontested(); return; }
      const next = this.nextActor(this.actor);
      if (next < 0) { this.closeRound(); return; }
      this.actor = next;
    }

    closeRound() {
      this.players.forEach((p) => { p.bet = 0; p.acted = false; });
      this.currentBet = 0;
      this.minRaise = this.bigBlind;
      while (this.round < 3) {
        this.round++;
        this.revealed = this.round === 1 ? 3 : this.revealed + 1;
        if (this.players.filter((p) => this.canAct(p)).length >= 2) {
          this.actor = this.firstToAct();
          if (this.actor >= 0) {
            this.note(STREETS[this.round] + ' — ' + this.revealed + ' coins showing.');
            return;
          }
        }
      }
      this.startGatePhase();
    }

    /** After the flop the first live seat left of the dealer opens. */
    firstToAct() {
      const seats = this.liveSeats();
      for (let k = 1; k <= seats.length; k++) {
        const s = seats[k % seats.length];
        if (this.canAct(this.players[s])) return s;
      }
      return -1;
    }

    /* ---- playing cards ---- */

    startGatePhase() {
      this.phase = 'gates';
      this.revealed = this.coins;
      this.gateOrder = this.liveSeats().filter((s) => !this.players[s].folded);
      this.gateIdx = 0;
      this.actor = this.gateOrder.length ? this.gateOrder[0] : -1;
      if (this.actor < 0) { this.showdown(); return; }
      this.note('Everyone plays their cards on their own copy of the board.');
    }

    playCard(id, targets) {
      if (this.phase !== 'gates') return { ok: false, why: 'not the card phase' };
      const p = this.players[this.actor];
      const idx = p.hand.indexOf(id);
      if (idx < 0) return { ok: false, why: 'no ' + CARDS[id].name + ' in hand' };
      const card = CARDS[id];
      if (targets.length !== card.arity) return { ok: false, why: 'pick ' + card.arity + ' coin' + (card.arity > 1 ? 's' : '') };
      if (card.arity === 2 && targets[0] === targets[1]) return { ok: false, why: 'pick two different coins' };

      const preview = previewCard(p.board, id, targets, this.coins);
      const outcome = applyCard(p.board, id, targets, this.rng);
      p.hand.splice(idx, 1);
      const play = { card: id, targets: targets.slice(), outcome };
      p.plays.push(play);
      if (id === 'M') this.lastCollapse = { seat: p.seat, coin: targets[0], bit: outcome };
      return { ok: true, outcome, preview, play };
    }

    /** The best next play for a seat, or null if nothing helps. */
    hint(seat) {
      const p = this.players[seat];
      const res = plan(p.board, p.hand, this.coins);
      if (!res.first) return null;
      const pv = previewCard(p.board, res.first.card, res.first.targets, this.coins);
      return { card: res.first.card, targets: res.first.targets, text: pv ? pv.text : '', value: res.value };
    }

    endTurn() {
      if (this.phase !== 'gates') return;
      this.gateIdx++;
      if (this.gateIdx < this.gateOrder.length) { this.actor = this.gateOrder[this.gateIdx]; return; }
      this.showdown();
    }

    /* ---- finishing ---- */

    endHandUncontested() {
      const winner = this.inHand()[0];
      const total = this.potTotal();
      winner.chips += total; winner.won = total; winner.handsWon++;
      this.results = {
        uncontested: true,
        pots: [{ amount: total, winners: [winner.seat], score: null }],
        summary: winner.name + (winner.name === 'You' ? ' take ' : ' takes ') + total + ' — everyone else folded.'
      };
      this.finishHand();
    }

    showdown() {
      this.phase = 'showdown';
      this.revealed = this.coins;
      this.players.forEach((p) => {
        if (p.folded || p.out) { p.score = null; p.bits = null; return; }
        p.bits = p.board.measure(this.rng);
        p.score = p.bits.reduce((a, b) => a + b, 0);
        p.rankKey = rankKey(p.bits);
      });

      const awarded = [];
      buildPots(this.players).forEach((pot) => {
        let contenders = pot.eligible.filter((i) => this.players[i].score !== null);
        if (!contenders.length) contenders = this.inHand().map((p) => p.seat);
        const bestKey = Math.max(...contenders.map((i) => this.players[i].rankKey));
        const winners = contenders.filter((i) => this.players[i].rankKey === bestKey);
        const best = this.players[winners[0]].score;
        const share = Math.floor(pot.amount / winners.length);
        const remainder = pot.amount - share * winners.length;
        winners.forEach((i, k) => {
          const got = share + (k < remainder ? 1 : 0);
          this.players[i].chips += got; this.players[i].won += got;
        });
        awarded.push({ amount: pot.amount, winners, score: best });
      });
      const winnerSeats = new Set();
      awarded.forEach((a) => a.winners.forEach((w) => winnerSeats.add(w)));
      winnerSeats.forEach((s) => { this.players[s].handsWon++; });

      this.results = { uncontested: false, pots: awarded, summary: this.describeResult(awarded) };
      this.finishHand();
    }

    describeResult(awarded) {
      const main = awarded[0];
      if (!main) return 'No chips changed hands.';
      const names = main.winners.map((i) => this.players[i].name);
      const who = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
      const total = awarded.reduce((s, a) => s + a.amount, 0);
      const verb = names.length > 1 ? ' split ' : names[0] === 'You' ? ' win ' : ' wins ';
      return who + verb + total + ' with ' + rankName(main.score) +
        ' (' + main.score + ' coin' + (main.score === 1 ? '' : 's') + ' on 1).';
    }

    finishHand() {
      this.phase = 'over';
      this.note(this.results.summary);
      this.players.forEach((p) => { if (!p.out && p.chips <= 0) { p.out = true; p.chips = 0; } });
      this.history.push({
        hand: this.handNo,
        winners: this.results.pots[0].winners.slice(),
        score: this.results.pots[0].score,
        pot: this.results.pots.reduce((s, a) => s + a.amount, 0),
        scores: this.players.map((p) => p.score)
      });
    }

    /** Why the game is over, or null if it is not. */
    finished() {
      if (this.phase !== 'over') return null;
      if (this.live().length <= 1) return 'last one standing';
      if (this.humans().length && this.humans().every((p) => p.out)) return 'busted';
      if (this.maxHands && this.handNo >= this.maxHands) return 'all hands played';
      return null;
    }

    nextHand() {
      if (this.finished()) return false;
      do { this.dealer = (this.dealer + 1) % this.n; } while (this.players[this.dealer].out);
      this.startHand();
      return true;
    }

    standings() {
      return this.players.slice().sort((a, b) => b.chips - a.chips);
    }
  }

  root.Engine = {
    Game, CARDS, CARD_ORDER, RANKS, STREETS,
    deckFor, applyCard, previewCard, describePlay, plan, rankName, rankKey, buildPots
  };
})(typeof window !== 'undefined' ? window : globalThis);
