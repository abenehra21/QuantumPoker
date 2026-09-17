/*
 * Quantum Hold'em — self-checks.
 *   browser:  open index.html?test
 *   node:     node js/tests.js
 * No framework: plain asserts.
 */
(function (root) {
  'use strict';

  const inNode = typeof window === 'undefined';
  if (!inNode && !/[?&]test\b/.test(location.search)) return;

  if (inNode) {
    const fs = require('fs'), path = require('path'), vm = require('vm');
    const ctx = vm.createContext({ Math, Float64Array, Set, Map, Array, Date, console, Object, Number, String, globalThis: null });
    ctx.globalThis = ctx;
    ['quantum', 'engine', 'bots', 'explainer'].forEach((f) => {
      vm.runInContext(fs.readFileSync(path.join(__dirname, f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
    });
    root = ctx;
  }

  const Q = root.Q, E = root.Engine, Bots = root.Bots, X = root.Explainer;
  const out = [];
  let passed = 0, failed = 0;

  function ok(name, cond, detail) {
    if (cond) { passed++; out.push('  pass  ' + name); }
    else { failed++; out.push('  FAIL  ' + name + (detail ? '   → ' + detail : '')); }
  }
  const near = (a, b, tol) => Math.abs(a - b) < (tol || 1e-9);
  const group = (name) => { out.push(''); out.push('▸ ' + name); };

  const SETUPS = {
    zero: () => {}, one: (s) => s.x(0), plus: (s) => s.h(0), minus: (s) => { s.h(0); s.z(0); }
  };
  function after(from, gate) {
    const s = new Q.QState(1);
    SETUPS[from](s);
    if (gate) s[gate](0);
    return Q.readCoin(s, 0).kind;
  }

  /* ---- 1. the cards do what the rules say ---- */

  group('Cards do what the rules say');
  ok('Flip: 0 ↔ 1', after('zero', 'x') === 'one' && after('one', 'x') === 'zero');
  ok('Flip: a spinning coin ignores it', after('plus', 'x') === 'plus' && after('minus', 'x') === 'minus');
  ok('Spin: 0 → +, + → 0', after('zero', 'h') === 'plus' && after('plus', 'h') === 'zero');
  ok('Spin: 1 → −, − → 1', after('one', 'h') === 'minus' && after('minus', 'h') === 'one');
  ok('Twist: + ↔ −', after('plus', 'z') === 'minus' && after('minus', 'z') === 'plus');
  ok('Twist: a settled coin ignores it', after('zero', 'z') === 'zero' && after('one', 'z') === 'one');
  ['x', 'h', 'z'].forEach((g) => {
    const back = Object.keys(SETUPS).every((k) => { const s = new Q.QState(1); SETUPS[k](s); s[g](0); s[g](0); return Q.readCoin(s, 0).kind === k; });
    ok(g.toUpperCase() + ' played twice is a no-op', back);
  });
  ok('Twist then Spin lands a + on 1', (() => { const s = new Q.QState(1); s.h(0); s.z(0); s.h(0); return Q.readCoin(s, 0).kind === 'one'; })());

  /* ---- 2. links ---- */

  group('Link');
  (() => {
    const s = new Q.QState(2);
    s.h(0); s.cx(0, 1);
    const l = Q.findLinks(s);
    ok('Link off a spinning control makes one link', l.length === 1 && l[0].same === true);
    ok('linked coins each read 50/50', near(s.probOne(0), 0.5) && near(s.probOne(1), 0.5));
    s.cx(0, 1);
    ok('Link again breaks it', Q.findLinks(s).length === 0 && Q.readCoin(s, 0).kind === 'plus');
  })();
  (() => {
    const s = new Q.QState(2); s.h(0); s.x(1); s.cx(0, 1);
    ok('a target on 1 links them opposite', Q.findLinks(s)[0].same === false);
    const t = new Q.QState(2); t.x(0); t.cx(0, 1);
    ok('Link off a settled 1 just flips the target', Q.readCoin(t, 1).kind === 'one' && Q.findLinks(t).length === 0);
    const u = new Q.QState(2); u.h(0); u.cx(0, 1); u.x(1);
    ok('Flip on a linked pair guarantees exactly one 1', Q.findLinks(u)[0].same === false);
  })();

  /* ---- 3. the simulator stays honest ---- */

  group('Simulator');
  (() => {
    const rng = Q.mulberry32(99);
    let worst = 0;
    for (let t = 0; t < 300; t++) {
      const s = Q.dealBoard(rng, 5);
      for (let i = 0; i < 25; i++) {
        const g = Math.floor(rng() * 4), a = Math.floor(rng() * 5), b = (a + 1 + Math.floor(rng() * 4)) % 5;
        if (g === 0) s.x(a); else if (g === 1) s.h(a); else if (g === 2) s.z(a); else s.cx(a, b);
      }
      worst = Math.max(worst, Math.abs(s.norm() - 1));
    }
    ok('probability is conserved over 7 500 random gates', worst < 1e-9, 'drift ' + worst.toExponential(2));
  })();
  (() => {
    const rng = Q.mulberry32(31);
    let bad = 0;
    for (let t = 0; t < 300; t++) {
      const s = Q.dealBoard(rng, 5);
      let given = 0, free = 0;
      for (let i = 0; i < 5; i++) { const k = Q.readCoin(s, i).kind; if (k === 'one') given++; if (k !== 'one' && k !== 'zero') free++; }
      if (given > 1 || free < 2) bad++;
    }
    ok('dealt boards are never already won or hopeless', bad === 0, bad + ' bad deals');
  })();
  (() => {
    const rng = Q.mulberry32(4242), s = new Q.QState(5);
    s.x(0); s.h(1);
    let c0 = 0, c1 = 0;
    for (let i = 0; i < 4000; i++) { const b = s.measure(rng); c0 += b[0]; c1 += b[1]; }
    ok('a settled 1 lands 1 every time', c0 === 4000);
    ok('a spinning coin lands 1 about half the time', Math.abs(c1 / 4000 - 0.5) < 0.03, (c1 / 4000).toFixed(3));
  })();
  (() => {
    const rng = Q.mulberry32(77), s = new Q.QState(2);
    s.h(0); s.cx(0, 1);
    let mismatched = 0;
    for (let i = 0; i < 2000; i++) { const b = s.measure(rng); if (b[0] !== b[1]) mismatched++; }
    ok('linked coins always land together', mismatched === 0);
  })();

  /* ---- 4. Collapse ---- */

  group('Collapse');
  (() => {
    const rng = Q.mulberry32(3);
    let ones = 0, bad = 0;
    for (let i = 0; i < 2000; i++) {
      const s = new Q.QState(3); s.h(0); s.cx(0, 1); s.h(2);
      const bit = s.collapse(0, rng);
      ones += bit;
      if (Math.abs(s.probOne(1) - bit) > 1e-9) bad++;
      if (Q.findLinks(s).length) bad++;
      if (Math.abs(s.probOne(2) - 0.5) > 1e-9) bad++;
      if (Math.abs(s.norm() - 1) > 1e-9) bad++;
    }
    ok('collapsing a spinning coin is a fair toss', Math.abs(ones / 2000 - 0.5) < 0.04, (ones / 2000).toFixed(3));
    ok('its linked partner lands with it; other coins are untouched', bad === 0, bad + ' problems');
    const s = new Q.QState(1); s.x(0);
    ok('a settled coin cannot be changed by collapsing it', s.collapse(0, rng) === 1);
    ok('project() reports an impossible outcome as 0', new Q.QState(1).project(0, 1) === 0);
  })();

  /* ---- 5. previews and planning ---- */

  group('Preview and Hint');
  (() => {
    const s = new Q.QState(5); s.h(0);
    const pv = E.previewCard(s, 'Z', [0], 5);
    ok('preview of Twist on a + says it spins −', /coin 1 spins −/.test(pv.text), pv.text);
    ok('Twist changes nothing measurable yet, and says so honestly', near(pv.delta, 0));
    const pv2 = E.previewCard(s, 'X', [0], 5);
    ok('a card that does nothing says "nothing changes"', pv2.noop && /nothing/.test(pv2.text), pv2.text);
    const pv3 = E.previewCard(s, 'CX', [0, 1], 5);
    ok('Link off a spinning coin says the coins become linked', /become linked/.test(pv3.text), pv3.text);
    const pv4 = E.previewCard(pv3.state, 'CX', [0, 1], 5);
    ok('…and again says the link breaks', /breaks/.test(pv4.text), pv4.text);
    const pv5 = E.previewCard(s, 'M', [0], 5);
    ok('Collapse preview gives the odds', /50% chance/.test(pv5.text), pv5.text);
  })();
  (() => {
    const s = new Q.QState(1); s.h(0);                         // a lone + coin
    const r = E.plan(s, ['Z', 'H'], 1);
    ok('planner finds Twist then Spin = +1 on a + coin', near(r.value, 1, 1e-3) && r.first.card === 'Z', JSON.stringify(r));
    const t = new Q.QState(2); t.h(0); t.cx(0, 1);              // linked pair, nothing else
    const r2 = E.plan(t, ['M', 'X', 'X'], 2);
    ok('Collapse then Flip both turns a linked pair into two sure points', near(r2.value, 2, 1e-3), String(r2.value));
    const u = new Q.QState(1); u.x(0);
    ok('planner plays nothing when nothing helps', E.plan(u, ['X'], 1).first === null);
    const w = new Q.QState(5); w.x(0); w.h(1); w.h(2); w.h(4);   // 1 − − 0 +  with Twist, Link, Collapse
    w.z(1); w.z(2);
    const r4 = E.plan(w, ['Z', 'CX', 'M'], 5);
    ok('the hint never opens with a play that changes nothing', r4.first.card === 'CX' && r4.first.targets.join() === '0,3', JSON.stringify(r4.first));
    const v = new Q.QState(5); v.x(4);
    const r3 = E.plan(v, ['X'], 5);
    ok('a lone Flip goes on a 0, not on the 1', r3.first.targets[0] !== 4 && near(r3.value, 2, 1e-3));
  })();

  /* ---- 6. ranks and pots ---- */

  group('Ranks and pots');
  ok('more 1s always outranks fewer', E.rankKey([0, 0, 0, 1, 1]) > E.rankKey([1, 0, 0, 0, 0]));
  ok('tied counts: a 1 further left wins', E.rankKey([1, 0, 0, 0, 1]) > E.rankKey([0, 1, 1, 0, 0]));
  ok('identical boards tie', E.rankKey([1, 0, 1, 0, 1]) === E.rankKey([1, 0, 1, 0, 1]));
  ok('five 1s is Coherence', E.rankName(5) === 'Coherence');
  (() => {
    const ps = [{ committed: 50, folded: false }, { committed: 100, folded: false }, { committed: 100, folded: false }, { committed: 20, folded: true }];
    const pots = E.buildPots(ps);
    ok('every chip committed ends up in some pot', pots.reduce((s, p) => s + p.amount, 0) === 270);
    ok('a short stack cannot win the side pot', pots[pots.length - 1].eligible.join() === '1,2');
    ok('a folder is never eligible', pots.every((p) => !p.eligible.includes(3)));
  })();

  (() => {
    const bot = Bots.PERSONAS[0];
    const g3 = new E.Game({ seats: [{ name: 'A' }, { name: 'B', bot }, { name: 'C', bot }], seed: 1 });
    ok('with three seats the blinds sit left of the dealer and the dealer acts first',
      g3.sbSeat === 1 && g3.bbSeat === 2 && g3.actor === 0);
    const g2 = new E.Game({ seats: [{ name: 'A' }, { name: 'B', bot }], seed: 1 });
    ok('heads-up the dealer posts the small blind and acts first', g2.sbSeat === 0 && g2.bbSeat === 1 && g2.actor === 0);
    g2.call(); g2.call();
    ok('…and the big blind opens after the flop', g2.round === 1 && g2.actor === 1);
  })();

  /* ---- 7. whole games ---- */

  group('Whole games, played by bots');
  (() => {
    let hands = 0, allIns = 0, splits = 0, coherences = 0, folds = 0;
    const problems = [];
    for (let seed = 1; seed <= 30; seed++) {
      const n = 2 + (seed % 4);
      const seats = [];
      for (let i = 0; i < n; i++) seats.push({ name: 'B' + i, bot: Bots.PERSONAS[i % 4] });
      const g = new E.Game({ seats, seed, maxHands: 40 });
      let safety = 0;
      do {
        let guard = 0;
        while (g.phase === 'betting' || g.phase === 'gates') {
          if (!Bots.step(g)) { problems.push('stuck in seed ' + seed); break; }
          if (++guard > 400) { problems.push('loop in seed ' + seed); break; }
        }
        hands++;
        if (g.players.some((p) => p.allIn)) allIns++;
        if (g.results.pots.some((p) => p.winners.length > 1)) splits++;
        if (g.players.some((p) => p.score === 5)) coherences++;
        if (g.results.uncontested) folds++;
        const total = g.players.reduce((s, p) => s + p.chips, 0);
        if (total !== 1000 * n) problems.push('chips leaked in seed ' + seed + ' (' + total + ')');
        if (g.players.some((p) => p.chips < 0)) problems.push('negative stack in seed ' + seed);
        if (++safety > 60) { problems.push('seed ' + seed + ' never finished'); break; }
      } while (g.nextHand());
      if (!g.finished()) problems.push('seed ' + seed + ' not finished');
    }
    ok('30 games, ' + hands + ' hands: chips conserved, every game ends', problems.length === 0, problems.slice(0, 3).join(' | '));
    ok('bots go all in (' + allIns + '), split pots (' + splits + '), fold hands out (' + folds + ')', allIns > 0 && splits > 0 && folds > 0);
    ok('Coherence is rare but happens (' + coherences + '/' + hands + ')', coherences > 0 && coherences < hands * 0.25);
  })();

  /* ---- 8. determinism ---- */

  group('Daily Deal is the same for everyone');
  (() => {
    const mk = () => new E.Game({ seats: [{ name: 'A' }, { name: 'B', bot: Bots.PERSONAS[0] }], seed: 555 });
    const a = mk(), b = mk();
    b.raiseTo(200); b.call(); b.endTurn && b.phase === 'gates' && b.endTurn();
    const sameBoard = a.origin.re.every((v, i) => near(v, b.origin.re[i]));
    ok('hand 1 deals the same board regardless of what anyone does', sameBoard);
    ok('…and the same cards', a.players[0].hand.join() === b.players[0].hand.join());
    a.nextHand = E.Game.prototype.nextHand;
    while (!a.finished() && (a.phase === 'betting' || a.phase === 'gates')) { if (a.current().bot) Bots.step(a); else a.call(); if (a.phase === 'gates' && !a.current().bot) a.endTurn(); }
    while (!b.finished() && (b.phase === 'betting' || b.phase === 'gates')) { if (b.current().bot) Bots.step(b); else b.fold(); }
    a.nextHand(); b.nextHand();
    ok('hand 2 is identical too, however hand 1 went', a.players[0].hand.join() === b.players[0].hand.join() &&
      a.origin.re.every((v, i) => near(v, b.origin.re[i])));
  })();

  /* ---- 9. the explainer ---- */

  group('The explainer');
  (() => {
    const cues = X.cues;
    let sorted = true;
    for (let i = 1; i < cues.length; i++) if (cues[i].t < cues[i - 1].t) sorted = false;
    ok('cues are in time order', sorted);
    ok('every cue lands inside the running time', cues.every((c) => c.t >= 0 && c.t <= X.duration));
    const KINDS = ['one', 'zero', 'plus', 'minus', 'mixed', 'hidden'];
    let badCoin = null, badCard = null;
    cues.forEach((c) => {
      (c.set.coins || []).forEach((spec) => { const k = typeof spec === 'string' ? spec : spec.kind; if (!KINDS.includes(k)) badCoin = k; });
      (c.set.cards || []).forEach((id) => { if (!E.CARDS[id]) badCard = id; });
      if (c.set.cardSpot && !E.CARDS[c.set.cardSpot]) badCard = c.set.cardSpot;
    });
    ok('every coin in the script is a state the table can show', badCoin === null, String(badCoin));
    ok('every card in the script is a card in the deck', badCard === null, String(badCard));
    let silent = 0, badSpot = 0;
    for (let t = 0.5; t <= X.duration; t += 0.1) {
      const s = X.stateAt(t);
      if (!s.caption || !s.chapter) silent++;
      if (s.spot && s.spot.some((i) => i >= s.coins.length)) badSpot++;
      if (s.links.some((p) => p[0] >= s.coins.length || p[1] >= s.coins.length)) badSpot++;
    }
    ok('a caption and a chapter are on screen at every moment', silent === 0, silent + ' silent frames');
    ok('spotlights and links only point at coins on screen', badSpot === 0);
    ok('it runs between one and two minutes', X.duration > 60 && X.duration < 120, X.duration + 's');
    ok('every card kind gets its own demonstration', E.CARD_ORDER.every((id) => cues.some((c) => c.set.cardSpot === id)));
  })();

  /* ---- report ---- */

  const head = failed === 0 ? '✅  ALL ' + passed + ' CHECKS PASSED' : '❌  ' + failed + ' FAILED, ' + passed + ' passed';
  const text = 'Quantum Hold’em — self-checks\n' + '='.repeat(46) + '\n' + head + '\n' + out.join('\n') + '\n';

  if (inNode) {
    console.log(text);
    process.exitCode = failed ? 1 : 0;
  } else {
    const pre = document.getElementById('test-out');
    pre.hidden = false;
    pre.textContent = text + '\n' + '='.repeat(46) + '\nRemove ?test from the URL to play.';
    pre.style.color = failed === 0 ? '#8ee6a0' : '#ff9a9a';
    document.getElementById('home').hidden = true;
    (failed === 0 ? console.log : console.error)(head);
    root.__testResult = { passed, failed };
  }
})(typeof window !== 'undefined' ? window : globalThis);
