/*
 * Quantum Hold'em — bots.js
 * Opponents. Each has a personality; all of them judge a hand the same way:
 * "how many coins can my cards land on 1, compared with an average hand?"
 *
 * They never look at unrevealed coins or at anyone else's cards.
 */
(function (root) {
  'use strict';

  const Q = root.Q, E = root.Engine;

  const PERSONAS = [
    { key: 'rook',   name: 'Rook',   avatar: 1, aggression: 0.35, bluff: 0.06, tight: 0.55, tell: 'plays it straight' },
    { key: 'vesper', name: 'Vesper', avatar: 2, aggression: 0.70, bluff: 0.18, tight: 0.20, tell: 'bets at anything' },
    { key: 'moth',   name: 'Moth',   avatar: 3, aggression: 0.20, bluff: 0.03, tight: 0.85, tell: 'folds unless sure' },
    { key: 'ash',    name: 'Ash',    avatar: 4, aggression: 0.50, bluff: 0.10, tight: 0.45, tell: 'hard to read' }
  ];

  /** What a random three-card hand adds to a random board, on average. Measured; see tests. */
  const AVG_UPLIFT = 1.1;

  const CARD_WEIGHT = { X: 0.55, H: 0.50, CX: 0.45, M: 0.35, Z: 0.30 };

  function handPotential(hand) {
    return hand.reduce((s, id) => s + CARD_WEIGHT[id], 0);
  }

  /**
   * Strength in (0, 1): 0.5 is an average hand for this board. Coins not yet
   * revealed count as 50/50 for everyone, plus what the bot's leftover cards
   * could still do to them.
   */
  function strength(game, seat) {
    const p = game.players[seat];
    const rev = game.revealed, unrev = game.coins - rev;
    const mine = (rev ? E.plan(p.board, p.hand, rev).value : 0)
      + 0.5 * unrev + handPotential(p.hand) * (unrev / game.coins) * 0.8;
    const baseline = Q.expectedScore(game.origin, rev) + 0.5 * unrev + AVG_UPLIFT;
    const edge = mine - baseline;
    return 1 / (1 + Math.exp(-edge * 1.8));
  }

  /** Decide a betting action. Returns { action: 'fold'|'call'|'raise', to? }. */
  function decide(game, seat, rng) {
    const p = game.players[seat], me = p.bot;
    const s = strength(game, seat);
    const toCall = game.toCall(seat);
    const pot = game.potTotal();
    const minTo = game.minRaiseTo(seat), maxTo = game.maxRaiseTo(seat);
    const canRaise = maxTo > game.currentBet;
    const opponents = game.inHand().length - 1;

    // One raise per street each, unless the hand is a monster. Without this,
    // two aggressive bots re-raise each other all in on the first hand.
    const raisedAlready = p.raisedStreet === game.round;
    const raise = () => {
      if (raisedAlready && s < 0.85) return { action: 'call' };
      p.raisedStreet = game.round;
      const size = Math.round(pot * (0.4 + me.aggression * 0.6) + game.currentBet);
      return { action: 'raise', to: Math.max(minTo, Math.min(maxTo, size)) };
    };

    if (toCall === 0) {
      if (canRaise && s > 0.58 + (1 - me.aggression) * 0.12 && rng() < 0.45 + me.aggression * 0.5) return raise();
      if (canRaise && s > 0.4 && rng() < me.bluff) return raise();
      return { action: 'call' };
    }

    const potOdds = toCall / (pot + toCall);
    const margin = me.tight * 0.18 + opponents * 0.03;
    if (s > potOdds + margin) {
      if (canRaise && s > 0.7 && rng() < me.aggression * 0.7) return raise();
      return { action: 'call' };
    }
    if (s > 0.35 && rng() < me.bluff * 0.5 && toCall < p.chips * 0.15) return { action: 'call' };
    return { action: 'fold' };
  }

  /** Play a bot's cards, best line first, until nothing helps. */
  function playCards(game, seat) {
    const p = game.players[seat];
    let guard = 0;
    while (p.hand.length && guard++ < 6) {
      const h = game.hint(seat);
      if (!h) break;
      if (!game.playCard(h.card, h.targets).ok) break;
    }
  }

  /** Advance the game through one bot action. Returns false if it is not a bot's turn. */
  function step(game) {
    const p = game.current();
    if (!p || !p.bot) return false;
    if (game.phase === 'betting') {
      const d = decide(game, p.seat, game.rng);
      if (d.action === 'fold') game.fold();
      else if (d.action === 'raise') { if (!game.raiseTo(d.to).ok) game.call(); }
      else game.call();
      return true;
    }
    if (game.phase === 'gates') {
      playCards(game, p.seat);
      game.endTurn();
      return true;
    }
    return false;
  }

  root.Bots = { PERSONAS, AVG_UPLIFT, strength, decide, playCards, step, handPotential };
})(typeof window !== 'undefined' ? window : globalThis);
