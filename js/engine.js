/*
 * Quantum Poker
 * engine.js : the rules. Candy, betting rounds, side pots, showdown.
 *
 * No DOM in here. The whole game can be driven from a script, which is how
 * the self-checks in tests.js exercise it.
 */
(function (global) {
  'use strict';

  var Q = global.Q;

  /* ------------------------------------------------------------------ *
   * Candy
   * ------------------------------------------------------------------ */

  var CANDY = [
    { key: 'bar',  name: 'Chocolate bar', short: 'Bar',  value: 25 },
    { key: 'fun',  name: 'Fun-size bar',  short: 'Fun',  value: 10 },
    { key: 'pop',  name: 'Lollipop',      short: 'Pop',  value: 5  },
    { key: 'corn', name: 'Candy corn',    short: 'Corn', value: 1  }
  ];

  var STARTING_STASH = { bar: 4, fun: 5, pop: 6, corn: 20 }; // = 200 points

  function stashValue(stash) {
    return CANDY.reduce(function (sum, c) { return sum + (stash[c.key] || 0) * c.value; }, 0);
  }

  /**
   * Break a point total into actual candy. 1 / 5 / 10 / 25 is a canonical
   * system, so greedy is optimal — no need for anything cleverer.
   */
  function toCandy(points) {
    var left = Math.max(0, Math.round(points));
    var out = {};
    CANDY.forEach(function (c) {
      out[c.key] = Math.floor(left / c.value);
      left -= out[c.key] * c.value;
    });
    return out;
  }

  function candyLine(points) {
    return describeStash(toCandy(points));
  }

  function describeStash(stash) {
    var parts = CANDY.filter(function (c) { return (stash[c.key] || 0) > 0; })
      .map(function (c) { return stash[c.key] + '× ' + c.short; });
    return parts.length ? parts.join(', ') : 'nothing';
  }

  /**
   * Who physically hands what to whom at the end of the night.
   *
   * toCandy() alone is not enough: it would happily tell the winner to collect
   * 24 chocolate bars when the whole table only brought 12. This deals out the
   * real pool — the candy that actually exists — largest denomination first,
   * richest player first, so every payout can genuinely be made.
   */
  function settlePool(players) {
    var n = players.length;
    var pool = {};
    CANDY.forEach(function (c) { pool[c.key] = (STARTING_STASH[c.key] || 0) * n; });

    var order = players.map(function (p, i) { return i; })
      .sort(function (a, b) { return players[b].points - players[a].points; });

    var out = players.map(function () { return { short: 0 }; });
    order.forEach(function (i) {
      var left = players[i].points;
      CANDY.forEach(function (c) {
        var take = Math.min(pool[c.key], Math.floor(left / c.value));
        out[i][c.key] = take;
        pool[c.key] -= take;
        left -= take * c.value;
      });
      out[i].short = left;   // 0 unless the table ran out of small change
    });
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Cards
   * ------------------------------------------------------------------ */

  var CARDS = {
    FLIP: {
      id: 'FLIP', name: 'Flip', gate: 'X', arity: 1,
      blurb: 'Turns a settled coin over. A spinning coin shrugs it off.'
    },
    HAUNT: {
      id: 'HAUNT', name: 'Haunt', gate: 'H', arity: 1,
      blurb: 'Sets a settled coin spinning — or stops one that already is.'
    },
    SUMMON: {
      id: 'SUMMON', name: 'Summon', gate: 'ZH', arity: 1,
      blurb: 'Catches a clockwise spin and pins it on 1. Your best card.'
    },
    BIND: {
      id: 'BIND', name: 'Bind', gate: 'CX', arity: 2,
      blurb: 'Links two coins so they settle together — or breaks a link.'
    },
    OBSERVER: {
      id: 'OBSERVER', name: 'Observer', gate: 'measure', arity: 1, rare: true,
      blurb: 'Collapses one coin on every board at the table. Including yours.'
    }
  };

  var CARD_IDS = ['FLIP', 'HAUNT', 'SUMMON', 'BIND', 'OBSERVER'];
  var COMMON_IDS = ['FLIP', 'HAUNT', 'SUMMON', 'BIND'];

  // How often the single Observer is shuffled into the deck at all. Low
  // enough that seeing one is an event; high enough that a table will meet it
  // a handful of times in an evening.
  var OBSERVER_ODDS = 0.22;

  function applyCard(state, cardId, targets) {
    switch (cardId) {
      case 'FLIP':   state.x(targets[0]); break;
      case 'HAUNT':  state.h(targets[0]); break;
      case 'SUMMON': state.zh(targets[0]); break;
      case 'BIND':   state.cx(targets[0], targets[1]); break;
      case 'OBSERVER':
        throw new Error('Observer reaches every board; play it through Game.playCard');
      default: throw new Error('unknown card ' + cardId);
    }
  }

  /** How a single coin ends up, in words a first-timer can act on. */
  function coinPhrase(state, q) {
    var kind = Q.readCoin(state, q).kind;
    var n = q + 1;
    if (kind === 'up') return 'settles coin ' + n + ' on 1';
    if (kind === 'down') return 'settles coin ' + n + ' on 0';
    if (kind === 'cw') return 'sets coin ' + n + ' spinning ↻';
    if (kind === 'ccw') return 'sets coin ' + n + ' spinning ↺';
    return 'leaves coin ' + n + ' at even odds';
  }

  function pairIsChained(state, a, b) {
    return Q.findChains(state).some(function (c) {
      return (c.a === a && c.b === b) || (c.a === b && c.b === a);
    });
  }

  /** What this card would do here, in plain words. */
  function previewCard(state, cardId, targets, revealed) {
    var card = CARDS[cardId];
    if (targets.length < card.arity) return null;
    if (cardId === 'OBSERVER') {
      var p = state.probOne(targets[0]);
      return {
        text: p > 1 - 1e-6 ? 'banks coin ' + (targets[0] + 1) + ' and puts everyone else to the toss'
            : p < 1e-6 ? 'settles coin ' + (targets[0] + 1) + ' as a nought, everywhere'
            : 'tosses coin ' + (targets[0] + 1) + ' for the whole table',
        delta: 0, state: state.clone(), global: true
      };
    }
    var before = Q.expectedScore(state, revealed);
    var after = state.clone();
    applyCard(after, cardId, targets);
    var delta = Q.expectedScore(after, revealed) - before;

    var text;
    if (card.arity === 1) {
      text = coinPhrase(after, targets[0]);
    } else {
      var wasChained = pairIsChained(state, targets[0], targets[1]);
      var nowChained = pairIsChained(after, targets[0], targets[1]);
      if (nowChained && !wasChained) {
        text = 'links coins ' + (targets[0] + 1) + ' and ' + (targets[1] + 1);
      } else if (wasChained && !nowChained) {
        text = 'breaks the link on ' + (targets[0] + 1) + ' and ' + (targets[1] + 1);
      } else {
        // A Bind with a settled control is just a conditional flip of the
        // target — say what actually happens to it.
        text = coinPhrase(after, targets[1]);
      }
    }
    return { text: text, delta: delta, state: after };
  }

  /* ------------------------------------------------------------------ *
   * Hand ranks
   * ------------------------------------------------------------------ */

  var RANKS = ['Null', 'Spark', 'Pair', 'Cascade', 'Surge', 'Coherence'];

  function rankName(score) {
    return RANKS[Math.max(0, Math.min(RANKS.length - 1, score))];
  }

  /* ------------------------------------------------------------------ *
   * Side pots
   * ------------------------------------------------------------------ */

  /**
   * Split everything committed this hand into a main pot and any side pots.
   * Each pot records which seats are allowed to win it.
   */
  function buildPots(players) {
    var levels = [];
    players.forEach(function (p) {
      if (p.committed > 0 && levels.indexOf(p.committed) === -1) levels.push(p.committed);
    });
    levels.sort(function (a, b) { return a - b; });

    var pots = [], prev = 0;
    levels.forEach(function (lvl) {
      var amount = 0, eligible = [];
      players.forEach(function (p, i) {
        amount += Math.min(p.committed, lvl) - Math.min(p.committed, prev);
        if (p.committed >= lvl && !p.folded) eligible.push(i);
      });
      if (amount > 0) pots.push({ amount: amount, eligible: eligible });
      prev = lvl;
    });
    return pots;
  }

  /* ------------------------------------------------------------------ *
   * Game
   * ------------------------------------------------------------------ */

  var ROUND_NAMES = ['The Deal', 'The Reveal', 'The Turn', 'The Collapse'];

  function Game(opts) {
    this.seed = (opts.seed === undefined || opts.seed === null) ? (Date.now() & 0x7fffffff) : opts.seed;
    this.rng = Q.mulberry32(this.seed);
    this.baseBlind = opts.smallBlind || 5;
    this.handsPerLevel = opts.handsPerLevel || 6;
    this.blindLevel = 0;
    this.smallBlind = this.baseBlind;
    this.bigBlind = this.smallBlind * 2;
    this.coins = opts.coins || 5;
    this.handNo = 0;
    this.dealer = 0;
    this.log = [];

    var self = this;
    this.players = opts.players.map(function (p, i) {
      return {
        seat: i,
        name: p.name,
        sigil: p.sigil,
        points: stashValue(STARTING_STASH),
        startPoints: stashValue(STARTING_STASH),
        bet: 0, committed: 0,
        folded: false, allIn: false, acted: false, out: false,
        hand: {}, board: null, score: null, bits: null, won: 0
      };
    });
    this.n = this.players.length;
    this.startHand();
  }

  Game.prototype.live = function () {
    return this.players.filter(function (p) { return !p.out; });
  };

  Game.prototype.inHand = function () {
    return this.players.filter(function (p) { return !p.out && !p.folded; });
  };

  Game.prototype.canAct = function (p) {
    return !p.out && !p.folded && !p.allIn && p.points > 0;
  };

  /* ---- setting up a hand ---- */

  Game.prototype.startHand = function () {
    var self = this;
    this.handNo++;
    // The blinds climb so an evening of this actually finishes. Without it,
    // a table of cautious players just passes the same candy around forever.
    this.blindLevel = Math.min(5, Math.floor((this.handNo - 1) / this.handsPerLevel));
    this.smallBlind = this.baseBlind * Math.pow(2, this.blindLevel);
    this.bigBlind = this.smallBlind * 2;
    this.phase = 'betting';
    this.round = 0;
    this.revealed = 0;
    this.pots = [];
    this.results = null;
    this.message = '';

    var origin = Q.dealBoard(this.rng, this.coins);
    this.players.forEach(function (p) {
      p.bet = 0; p.committed = 0; p.won = 0;
      p.folded = p.out; p.allIn = false; p.acted = false;
      p.score = null; p.bits = null;
      p.board = origin.clone();
      p.hand = {};
    });

    this.dealCards();

    // Blinds: the dealer seat posts the small blind, the next seat the big.
    var seats = this.liveSeats();
    var sb = seats[0], bb = seats[1 % seats.length];
    this.sbSeat = sb; this.bbSeat = bb;
    this.forceBet(sb, this.smallBlind);
    this.forceBet(bb, this.bigBlind);

    this.currentBet = this.bigBlind;
    this.minRaise = this.bigBlind;
    this.lastAggressor = bb;

    // Heads-up: two seats, so index 2 wraps back to the dealer, who is first
    // to act before the flop. That is the correct heads-up rule.
    this.actor = seats[2 % seats.length];
    if (!this.canAct(this.players[this.actor])) this.actor = this.nextActor(this.actor);
    this.note(ROUND_NAMES[0] + ' — blinds are ' + this.smallBlind + '/' + this.bigBlind + '.');

    // Big blinds late in the game can put everyone all in before anyone acts.
    // Nothing left to bet: turn the coins over and go straight to the cards.
    if (this.actor < 0) this.closeRound();
  };

  /** Seats still in the game, ordered starting from the dealer. */
  Game.prototype.liveSeats = function () {
    var out = [], k, i;
    for (k = 0; k < this.n; k++) {
      i = (this.dealer + k) % this.n;
      if (!this.players[i].out) out.push(i);
    }
    return out;
  };

  /** Three cards each, drawn from a shared deck of four of each type. */
  Game.prototype.dealCards = function () {
    var seats = this.liveSeats();
    var deck = [], i, c;
    for (i = 0; i < COMMON_IDS.length; i++) {
      for (c = 0; c < seats.length; c++) deck.push(COMMON_IDS[i]);
    }
    // At most one Observer exists, and most hands do not contain it.
    this.observerInDeck = this.rng() < OBSERVER_ODDS;
    if (this.observerInDeck) deck.push('OBSERVER');

    Q.shuffle(deck, this.rng);
    var self = this;
    for (i = 0; i < 3; i++) {
      seats.forEach(function (s) {
        var card = deck.pop();
        var hand = self.players[s].hand;
        hand[card] = (hand[card] || 0) + 1;
      });
    }
    this.deckCounts = {};
    COMMON_IDS.forEach(function (id) { self.deckCounts[id] = seats.length; });
    this.deckCounts.OBSERVER = this.observerInDeck ? 1 : 0;
  };

  Game.prototype.note = function (text) {
    this.message = text;
    this.log.push(text);
    if (this.log.length > 60) this.log.shift();
  };

  /* ---- betting ---- */

  Game.prototype.forceBet = function (seat, amount) {
    var p = this.players[seat];
    var pay = Math.min(amount, p.points);
    p.points -= pay;
    p.bet += pay;
    p.committed += pay;
    if (p.points === 0) p.allIn = true;
    return pay;
  };

  Game.prototype.toCall = function (seat) {
    var p = this.players[seat];
    return Math.max(0, Math.min(this.currentBet - p.bet, p.points));
  };

  Game.prototype.minRaiseTo = function (seat) {
    var p = this.players[seat];
    return Math.min(this.currentBet + this.minRaise, p.bet + p.points);
  };

  Game.prototype.fold = function () {
    if (this.phase !== 'betting') return;
    var p = this.players[this.actor];
    p.folded = true;
    p.acted = true;
    this.note(p.name + ' folds.');
    this.afterAction();
  };

  Game.prototype.call = function () {
    if (this.phase !== 'betting') return;
    var seat = this.actor, p = this.players[seat];
    var amount = this.toCall(seat);
    this.forceBet(seat, amount);
    p.acted = true;
    this.note(amount === 0 ? p.name + ' checks.' : p.name + (p.allIn ? ' calls all in for ' : ' calls ') + amount + '.');
    this.afterAction();
  };

  /** Raise the total bet to `to` points. */
  Game.prototype.raiseTo = function (to) {
    if (this.phase !== 'betting') return { ok: false, why: 'not betting' };
    var seat = this.actor, p = this.players[seat];
    var max = p.bet + p.points;
    to = Math.round(to);
    if (to > max) return { ok: false, why: 'You only have ' + max + '.' };
    var isAllIn = to === max;
    if (!isAllIn && to < this.currentBet + this.minRaise) {
      return { ok: false, why: 'Raise to at least ' + (this.currentBet + this.minRaise) + ', or shove all in.' };
    }
    var add = to - p.bet;
    this.forceBet(seat, add);
    if (p.bet > this.currentBet) {
      this.minRaise = Math.max(this.minRaise, p.bet - this.currentBet);
      this.currentBet = p.bet;
      this.lastAggressor = seat;
      // A raise reopens the action for everyone else.
      this.players.forEach(function (q) { if (q.seat !== seat) q.acted = false; });
    }
    p.acted = true;
    this.note(p.name + (p.allIn ? ' shoves all in for ' : ' raises to ') + p.bet + '.');
    this.afterAction();
    return { ok: true };
  };

  Game.prototype.nextActor = function (from) {
    var k, i, p;
    for (k = 1; k <= this.n; k++) {
      i = (from + k) % this.n;
      p = this.players[i];
      if (this.canAct(p) && (!p.acted || p.bet < this.currentBet)) return i;
    }
    return -1;
  };

  Game.prototype.afterAction = function () {
    if (this.inHand().length <= 1) { this.endHandUncontested(); return; }
    var next = this.nextActor(this.actor);
    if (next < 0) { this.closeRound(); return; }
    this.actor = next;
  };

  Game.prototype.closeRound = function () {
    this.players.forEach(function (p) { p.bet = 0; p.acted = false; });
    this.currentBet = 0;
    this.minRaise = this.bigBlind;

    while (this.round < 3) {
      this.round++;
      this.revealed = this.round === 1 ? 3 : this.revealed + 1;
      // If nobody can still bet, just keep turning coins over.
      if (this.playersWhoCanBet() >= 2) {
        this.actor = this.firstToAct();
        if (this.actor >= 0) {
          this.note(ROUND_NAMES[this.round] + ' — ' + this.revealed + ' coins on the table.');
          return;
        }
      }
    }
    this.startGatePhase();
  };

  Game.prototype.playersWhoCanBet = function () {
    var self = this;
    return this.players.filter(function (p) { return self.canAct(p); }).length;
  };

  Game.prototype.firstToAct = function () {
    var seats = this.liveSeats(), i;
    for (i = 0; i < seats.length; i++) {
      if (this.canAct(this.players[seats[i]])) return seats[i];
    }
    return -1;
  };

  /* ---- playing cards on the coins ---- */

  Game.prototype.startGatePhase = function () {
    this.phase = 'gates';
    this.revealed = this.coins;
    var seats = this.liveSeats(), i;
    this.actor = -1;
    for (i = 0; i < seats.length; i++) {
      if (!this.players[seats[i]].folded) { this.actor = seats[i]; break; }
    }
    if (this.actor < 0) { this.showdown(); return; }
    this.note('Cards on the coins. ' + this.players[this.actor].name + ' first.');
  };

  Game.prototype.handSize = function (seat) {
    var h = this.players[seat].hand, k, n = 0;
    for (k in h) if (h.hasOwnProperty(k)) n += h[k];
    return n;
  };

  Game.prototype.playCard = function (cardId, targets) {
    if (this.phase !== 'gates') return { ok: false, why: 'not the card phase' };
    var p = this.players[this.actor];
    if (!p.hand[cardId]) return { ok: false, why: 'no ' + CARDS[cardId].name + ' in hand' };
    var card = CARDS[cardId];
    if (targets.length !== card.arity) return { ok: false, why: 'pick ' + card.arity + ' coin(s)' };
    if (card.arity === 2 && targets[0] === targets[1]) return { ok: false, why: 'pick two different coins' };

    var outcome = null;
    if (cardId === 'OBSERVER') outcome = this.observe(targets[0]);
    else applyCard(p.board, cardId, targets);

    p.hand[cardId]--;
    if (p.hand[cardId] === 0) delete p.hand[cardId];
    return { ok: true, outcome: outcome };
  };

  /**
   * The Observer: measure one coin on every board still in the hand at once.
   *
   * Each player holds their own copy of the board, so each copy collapses
   * according to its own amplitudes — a coin someone has already pinned stays
   * pinned, while anyone still holding it in superposition gets a coin toss
   * and no way back. Chains break with it.
   */
  Game.prototype.observe = function (q) {
    var self = this;
    var results = [];
    this.players.forEach(function (p) {
      if (p.out || p.folded) return;
      var before = p.board.probOne(q);
      var bit = p.board.collapse(q, self.rng);
      results.push({ seat: p.seat, name: p.name, bit: bit, wasCertain: before > 1 - 1e-6 || before < 1e-6 });
    });

    var won = results.filter(function (r) { return r.bit === 1; }).length;
    this.lastObservation = { coin: q, results: results, by: this.actor };
    this.note(this.players[this.actor].name + ' plays the Observer on coin ' + (q + 1) +
      ' — it collapses on every board. ' + won + ' of ' + results.length + ' came up 1.');
    return this.lastObservation;
  };

  Game.prototype.endTurn = function () {
    if (this.phase !== 'gates') return;
    var seats = this.liveSeats();
    var at = seats.indexOf(this.actor), i, s;
    for (i = at + 1; i < seats.length; i++) {
      s = seats[i];
      if (!this.players[s].folded) { this.actor = s; return; }
    }
    this.showdown();
  };

  /**
   * The best single card you could still play, by expected coins face-up.
   * Used by the Hint button; beginners lean on it, everyone else ignores it.
   */
  Game.prototype.bestPlay = function (seat) {
    var p = this.players[seat], best = null, cardId, i, j, pv;

    // The Observer never changes your own expected score, so the usual search
    // would never suggest it. Its worth is what it takes away from everyone
    // else: play it on a coin you have already pinned and they have not.
    if (p.hand.OBSERVER) {
      var pick = null;
      for (i = 0; i < this.coins; i++) {
        if (p.board.probOne(i) < 1 - 1e-6) continue;
        var exposed = 0;
        this.players.forEach(function (o) {
          if (o.out || o.folded || o.seat === seat) return;
          if (o.board.probOne(i) < 1 - 1e-6) exposed++;
        });
        if (exposed && (!pick || exposed > pick.exposed)) pick = { i: i, exposed: exposed };
      }
      if (pick) {
        return {
          card: 'OBSERVER', targets: [pick.i], delta: pick.exposed,
          text: 'banks coin ' + (pick.i + 1) + ' and leaves ' + pick.exposed +
                ' other' + (pick.exposed > 1 ? 's' : '') + ' to the toss'
        };
      }
    }

    for (cardId in p.hand) {
      if (!p.hand.hasOwnProperty(cardId)) continue;
      if (cardId === 'OBSERVER') continue;
      var arity = CARDS[cardId].arity;
      for (i = 0; i < this.coins; i++) {
        if (arity === 1) {
          pv = previewCard(p.board, cardId, [i], this.coins);
          if (pv && (!best || pv.delta > best.delta)) best = { card: cardId, targets: [i], delta: pv.delta, text: pv.text };
        } else {
          for (j = 0; j < this.coins; j++) {
            if (i === j) continue;
            pv = previewCard(p.board, cardId, [i, j], this.coins);
            if (pv && (!best || pv.delta > best.delta)) best = { card: cardId, targets: [i, j], delta: pv.delta, text: pv.text };
          }
        }
      }
    }
    return best;
  };

  /* ---- finishing the hand ---- */

  Game.prototype.endHandUncontested = function () {
    var winner = this.inHand()[0];
    var total = this.players.reduce(function (s, p) { return s + p.committed; }, 0);
    winner.points += total;
    winner.won = total;
    this.results = {
      uncontested: true,
      pots: [{ amount: total, winners: [winner.seat] }],
      summary: winner.name + ' takes ' + total + ' — everyone else folded.'
    };
    this.phase = 'over';
    this.note(this.results.summary);
    this.settleBusts();
  };

  Game.prototype.showdown = function () {
    var self = this;
    this.phase = 'showdown';
    this.revealed = this.coins;

    this.players.forEach(function (p) {
      if (p.folded || p.out) { p.score = null; p.bits = null; return; }
      p.bits = p.board.measure(self.rng);
      p.score = p.bits.reduce(function (a, b) { return a + b; }, 0);
    });

    var pots = buildPots(this.players);
    var awarded = [];
    pots.forEach(function (pot) {
      var contenders = pot.eligible.filter(function (i) { return self.players[i].score !== null; });
      if (!contenders.length) {
        // Everyone eligible folded; hand it to whoever is left.
        contenders = self.inHand().map(function (p) { return p.seat; });
      }
      var best = -1;
      contenders.forEach(function (i) { if (self.players[i].score > best) best = self.players[i].score; });
      var winners = contenders.filter(function (i) { return self.players[i].score === best; });
      var share = Math.floor(pot.amount / winners.length);
      var remainder = pot.amount - share * winners.length;
      winners.forEach(function (i, k) {
        var got = share + (k < remainder ? 1 : 0); // odd candy goes left of the dealer
        self.players[i].points += got;
        self.players[i].won += got;
      });
      awarded.push({ amount: pot.amount, winners: winners, score: best });
    });

    this.pots = awarded;
    this.results = { uncontested: false, pots: awarded, summary: this.describeResult(awarded) };
    this.phase = 'over';
    this.settleBusts();
  };

  Game.prototype.describeResult = function (awarded) {
    var self = this;
    var main = awarded[0];
    if (!main) return 'No candy changed hands.';
    var names = main.winners.map(function (i) { return self.players[i].name; });
    var who = names.length === 1 ? names[0]
      : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
    var verb = names.length === 1 ? ' takes ' : ' split ';
    var total = awarded.reduce(function (s, a) { return s + a.amount; }, 0);
    return who + verb + total + ' with ' + rankName(main.score) + ' (' + main.score + ' face-up).';
  };

  Game.prototype.settleBusts = function () {
    this.players.forEach(function (p) {
      if (!p.out && p.points <= 0) { p.out = true; p.points = 0; }
    });
  };

  Game.prototype.gameOver = function () {
    return this.live().length <= 1;
  };

  Game.prototype.nextHand = function () {
    if (this.gameOver()) return false;
    do {
      this.dealer = (this.dealer + 1) % this.n;
    } while (this.players[this.dealer].out);
    this.startHand();
    return true;
  };

  /* ---- current pot total, for display ---- */

  Game.prototype.potTotal = function () {
    return this.players.reduce(function (s, p) { return s + p.committed; }, 0);
  };

  global.Engine = {
    Game: Game,
    CANDY: CANDY,
    CARDS: CARDS,
    CARD_IDS: CARD_IDS,
    COMMON_IDS: COMMON_IDS,
    OBSERVER_ODDS: OBSERVER_ODDS,
    RANKS: RANKS,
    ROUND_NAMES: ROUND_NAMES,
    STARTING_STASH: STARTING_STASH,
    stashValue: stashValue,
    toCandy: toCandy,
    candyLine: candyLine,
    describeStash: describeStash,
    settlePool: settlePool,
    rankName: rankName,
    buildPots: buildPots,
    applyCard: applyCard,
    previewCard: previewCard,
    coinPhrase: coinPhrase
  };
})(window);
