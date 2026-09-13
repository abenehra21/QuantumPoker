/*
 * Candy Coven — self-checks. Open index.html?test to run them.
 * No framework: plain asserts, printed to the page and the console.
 */
(function (global) {
  'use strict';

  if (!/[?&]test\b/.test(location.search)) return;

  var Q = global.Q, E = global.Engine;
  var out = [], passed = 0, failed = 0;

  function ok(name, cond, detail) {
    if (cond) { passed++; out.push('  pass  ' + name); }
    else { failed++; out.push('  FAIL  ' + name + (detail ? '   → ' + detail : '')); }
  }
  function near(a, b, tol) { return Math.abs(a - b) < (tol || 1e-9); }
  function group(name) { out.push(''); out.push('▸ ' + name); }

  /* ---- helpers ---- */

  var SETUPS = {
    down: function (s) { },
    up:   function (s) { s.x(0); },
    cw:   function (s) { s.h(0); },
    ccw:  function (s) { s.h(0); s.z(0); }
  };

  function after(from, gate) {
    var s = new Q.QState(1);
    SETUPS[from](s);
    if (gate) s[gate](0);
    return Q.readCoin(s, 0).kind;
  }

  /* ---- 1. the coin metaphor is exact ---- */

  group('Cards do what the table says they do');

  ok('Flip: skull ↔ face-up', after('down', 'x') === 'up' && after('up', 'x') === 'down');
  ok('Flip: a spinning coin shrugs it off', after('cw', 'x') === 'cw' && after('ccw', 'x') === 'ccw');

  ok('Haunt: resting ↔ spinning', after('down', 'h') === 'cw' && after('cw', 'h') === 'down');
  ok('Haunt: face-up ↔ counter-clockwise', after('up', 'h') === 'ccw' && after('ccw', 'h') === 'up');

  ok('Summon catches a clockwise spin face-up', after('cw', 'zh') === 'up');
  ok('Summon kills a counter-clockwise spin', after('ccw', 'zh') === 'down');
  ok('Summon sets a resting coin spinning', after('down', 'zh') === 'cw' && after('up', 'zh') === 'ccw');

  ['x', 'h'].forEach(function (g) {
    var allBack = Object.keys(SETUPS).every(function (k) {
      var s = new Q.QState(1);
      SETUPS[k](s); s[g](0); s[g](0);
      return Q.readCoin(s, 0).kind === k;
    });
    ok((g === 'x' ? 'Flip' : 'Haunt') + ' played twice is a no-op', allBack);
  });

  // Summon is NOT self-inverse: it walks a coin around a four-step cycle.
  // dead → ↻ → face-up → ↺ → dead. Worth knowing before you spend two of them.
  ok('Summon cycles a coin through all four states',
    after('down', 'zh') === 'cw' && after('cw', 'zh') === 'up' &&
    after('up', 'zh') === 'ccw' && after('ccw', 'zh') === 'down');

  (function () {
    var allBack = Object.keys(SETUPS).every(function (k) {
      var s = new Q.QState(1);
      SETUPS[k](s); s.zh(0); s.zh(0); s.zh(0); s.zh(0);
      return Q.readCoin(s, 0).kind === k;
    });
    ok('…so four Summons bring it back where it started', allBack);
  })();

  /* ---- 2. chains ---- */

  group('Bind chains and unchains');

  (function () {
    var s = new Q.QState(2);
    s.h(0); s.cx(0, 1);
    var ch = Q.findChains(s);
    ok('Bind on a clockwise control makes one chain', ch.length === 1);
    ok('…and the two coins land the same way', ch.length === 1 && ch[0].same === true);
    ok('chained coins each read 50/50', near(s.probOne(0), 0.5) && near(s.probOne(1), 0.5));
    s.cx(0, 1);
    ok('Bind again snaps the chain', Q.findChains(s).length === 0);
    ok('…and the control is spinning again', Q.readCoin(s, 0).kind === 'cw');
  })();

  (function () {
    var s = new Q.QState(2);
    s.h(0); s.x(1); s.cx(0, 1);
    var ch = Q.findChains(s);
    ok('a face-up target chains them opposite', ch.length === 1 && ch[0].same === false);
  })();

  (function () {
    var s = new Q.QState(2);
    ok('unentangled coins are not reported as chained', Q.findChains(s).length === 0);
  })();

  /* ---- 3. the simulator stays a valid quantum state ---- */

  group('The simulator stays honest');

  (function () {
    var rng = Q.mulberry32(99), worst = 0, t, i, s, g;
    for (t = 0; t < 400; t++) {
      s = Q.dealBoard(rng, 5);
      for (i = 0; i < 25; i++) {
        g = Math.floor(rng() * 4);
        var a = Math.floor(rng() * 5), b = (a + 1 + Math.floor(rng() * 4)) % 5;
        if (g === 0) s.x(a); else if (g === 1) s.h(a); else if (g === 2) s.zh(a); else s.cx(a, b);
      }
      worst = Math.max(worst, Math.abs(s.norm() - 1));
    }
    ok('total probability stays 1 over 10 000 random gates', worst < 1e-9, 'drift ' + worst.toExponential(2));
  })();

  (function () {
    var rng = Q.mulberry32(5), bad = 0, t, s, i, p, sum;
    for (t = 0; t < 200; t++) {
      s = Q.dealBoard(rng, 5);
      for (i = 0; i < 5; i++) {
        p = s.probOne(i);
        if (p < -1e-9 || p > 1 + 1e-9) bad++;
      }
      sum = s.bellProbs(0, 1).reduce(function (x, y) { return x + y; }, 0);
      if (!near(sum, 1, 1e-9)) bad++;
    }
    ok('every coin probability is in [0,1] and Bell weights sum to 1', bad === 0, bad + ' violations');
  })();

  (function () {
    var s = new Q.QState(1);
    var m0 = s.probMinus(0); s.h(0);
    var mCw = s.probMinus(0); s.z(0);
    var mCcw = s.probMinus(0);
    ok('spin direction is readable: resting .5, ↻ 0, ↺ 1',
      near(m0, 0.5) && near(mCw, 0) && near(mCcw, 1));
  })();

  (function () {
    var rng = Q.mulberry32(31), bad = 0, t, s;
    for (t = 0; t < 300; t++) {
      s = Q.dealBoard(rng, 5);
      var given = 0, free = 0, i, c;
      for (i = 0; i < 5; i++) {
        c = Q.readCoin(s, i);
        if (c.kind === 'up') given++;
        if (c.kind !== 'up' && c.kind !== 'down') free++;
      }
      if (given > 2 || free < 2) bad++;
    }
    ok('dealt boards are never already-won or hopeless', bad === 0, bad + ' bad deals');
  })();

  /* ---- 4. counting a measurement ---- */

  group('Measurement matches the odds');

  (function () {
    var rng = Q.mulberry32(4242);
    var s = new Q.QState(5);
    s.x(0); s.h(1);                       // coin 1 certain, coin 2 fifty-fifty
    var c0 = 0, c1 = 0, n = 4000, i, bits;
    for (i = 0; i < n; i++) { bits = s.measure(rng); c0 += bits[0]; c1 += bits[1]; }
    ok('a face-up coin lands face-up every time', c0 === n);
    ok('a spinning coin lands ~50%', Math.abs(c1 / n - 0.5) < 0.03, (c1 / n).toFixed(3));
  })();

  (function () {
    var rng = Q.mulberry32(77);
    var s = new Q.QState(2);
    s.h(0); s.cx(0, 1);                   // chained, same way
    var mismatched = 0, i, bits;
    for (i = 0; i < 2000; i++) { bits = s.measure(rng); if (bits[0] !== bits[1]) mismatched++; }
    ok('chained coins always land together', mismatched === 0, mismatched + ' mismatches');
  })();

  /* ---- 5. card previews ---- */

  group('Card preview tells the truth');

  (function () {
    var s = new Q.QState(5);
    s.h(0);
    var pv = E.previewCard(s, 'SUMMON', [0], 5);
    ok('Summon on a ↻ coin is worth exactly +0.5', near(pv.delta, 0.5, 1e-9), String(pv.delta));
    ok('…and says it locks the coin face-up', /FACE-UP/.test(pv.text), pv.text);
  })();

  (function () {
    var s = new Q.QState(5);
    var pv = E.previewCard(s, 'FLIP', [2], 5);
    ok('Flip on a dead coin is worth +1', near(pv.delta, 1, 1e-9), String(pv.delta));
  })();

  (function () {
    // Bind with a settled control is a conditional flip, not a chain. The
    // preview must say what really happens rather than talk about chains.
    var s = new Q.QState(5);
    s.x(0);                                  // coin 1 face-up, coin 3 dead
    var pv = E.previewCard(s, 'BIND', [0, 2], 5);
    ok('Bind off a face-up coin flips the target, and says so',
      near(pv.delta, 1, 1e-9) && /locks coin 3 FACE-UP/.test(pv.text), pv.text);
  })();

  (function () {
    var s = new Q.QState(5);
    s.h(0);
    var pv = E.previewCard(s, 'BIND', [0, 1], 5);
    ok('Bind off a spinning coin says it chains them', /chains coins 1 and 2/.test(pv.text), pv.text);
    var chained = pv.state;
    var pv2 = E.previewCard(chained, 'BIND', [0, 1], 5);
    ok('…and Bind again says it snaps the chain', /snaps the chain/.test(pv2.text), pv2.text);
  })();

  /* ---- 6. candy ---- */

  group('Candy adds up');

  (function () {
    var bad = 0, v;
    for (v = 0; v <= 600; v++) if (E.stashValue(E.toCandy(v)) !== v) bad++;
    ok('every value from 0 to 600 breaks into exact candy', bad === 0, bad + ' failures');
  })();

  ok('the starting stash is 200 points', E.stashValue(E.STARTING_STASH) === 200,
    String(E.stashValue(E.STARTING_STASH)));

  ok('candy is described in words', E.candyLine(37) === '1× Bar, 1× Fun, 2× Corn', E.candyLine(37));
  ok('an empty stash says so', E.candyLine(0) === 'nothing', E.candyLine(0));

  (function () {
    // The winner cannot be told to collect 24 chocolate bars when the table
    // only owns 12. Every payout must come out of the candy that exists.
    var rng = Q.mulberry32(12), bad = 0, overdrawn = 0, short = 0, t, i;
    for (t = 0; t < 4000; t++) {
      var n = 2 + Math.floor(rng() * 4), total = 200 * n;
      var cuts = [0, total];
      for (i = 0; i < n - 1; i++) cuts.push(Math.floor(rng() * (total + 1)));
      cuts.sort(function (a, b) { return a - b; });
      var players = [];
      for (i = 0; i < n; i++) players.push({ points: cuts[i + 1] - cuts[i] });
      var out = E.settlePool(players);
      out.forEach(function (o, k) {
        if (E.stashValue(o) + o.short !== players[k].points) bad++;
        if (o.short) short++;
      });
      E.CANDY.forEach(function (c) {
        var used = out.reduce(function (s2, o) { return s2 + o[c.key]; }, 0);
        if (used > (E.STARTING_STASH[c.key] || 0) * n) overdrawn++;
      });
    }
    ok('4000 random finishes pay out exactly', bad === 0 && short === 0, bad + ' wrong, ' + short + ' short');
    ok('…and never hand out candy the table does not have', overdrawn === 0, overdrawn + ' overdrawn');
  })();

  /* ---- 7. side pots ---- */

  group('Side pots');

  (function () {
    var ps = [
      { committed: 50, folded: false },
      { committed: 100, folded: false },
      { committed: 100, folded: false },
      { committed: 20, folded: true }
    ];
    var pots = E.buildPots(ps);
    var total = pots.reduce(function (s, p) { return s + p.amount; }, 0);
    ok('every candy committed ends up in some pot', total === 270, String(total));
    ok('a short stack cannot win the side pot',
      pots[pots.length - 1].eligible.join() === '1,2', pots[pots.length - 1].eligible.join());
    ok('a folder is never eligible',
      pots.every(function (p) { return p.eligible.indexOf(3) === -1; }));
  })();

  (function () {
    var ps = [{ committed: 30, folded: false }, { committed: 30, folded: false }];
    var pots = E.buildPots(ps);
    ok('a flat pot is a single pot', pots.length === 1 && pots[0].amount === 60);
  })();

  /* ---- 8. whole games ---- */

  group('Complete games, played by bots');

  (function () {
    var START = E.stashValue(E.STARTING_STASH);
    var hands = 0, allIns = 0, splits = 0, problems = [];

    function playHand(g, rng, wild) {
      var guard = 0;
      while (g.phase === 'betting') {
        if (++guard > 500) { problems.push('betting never closed'); return; }
        var p = g.players[g.actor], r = rng();
        if (wild && r < 0.15) g.raiseTo(Math.min(p.bet + p.points, g.currentBet + g.minRaise * (1 + Math.floor(rng() * 4))));
        else if (r < 0.08 && g.toCall(g.actor) > 0) g.fold();
        else g.call();
      }
      guard = 0;
      while (g.phase === 'gates') {
        if (++guard > 200) { problems.push('gate phase never closed'); return; }
        var seat = g.actor, best;
        while ((best = g.bestPlay(seat)) && best.delta > 1e-9) {
          if (!g.playCard(best.card, best.targets).ok) break;
        }
        g.endTurn();
      }
    }

    for (var seed = 1; seed <= 60; seed++) {
      var rng = Q.mulberry32(seed * 977);
      var nP = 2 + Math.floor(rng() * 4);
      var players = [];
      for (var i = 0; i < nP; i++) players.push({ name: 'P' + i, sigil: 'moon' });
      var g = new E.Game({ players: players, seed: seed });
      var expect = START * nP, safety = 0;
      do {
        playHand(g, rng, seed % 2 === 1);
        hands++;
        if (g.players.some(function (p) { return p.allIn; })) allIns++;
        if (g.results && g.results.pots.some(function (p) { return p.winners.length > 1; })) splits++;
        var total = g.players.reduce(function (s, p) { return s + p.points; }, 0);
        if (total !== expect) problems.push('candy leaked in seed ' + seed + ' (' + total + ' vs ' + expect + ')');
        if (g.players.some(function (p) { return p.points < 0; })) problems.push('negative stack in seed ' + seed);
        if (++safety > 400) { problems.push('seed ' + seed + ' never finished'); break; }
      } while (g.nextHand());
      if (g.live().length !== 1) problems.push('seed ' + seed + ' ended with ' + g.live().length + ' players standing');
    }

    ok('60 games, ' + hands + ' hands: candy is conserved and exactly one player is left',
      problems.length === 0, problems.slice(0, 3).join(' | '));
    ok('the bots hit all-ins (' + allIns + ') and split pots (' + splits + ')', allIns > 0 && splits > 0);
  })();

  /* ---- report ---- */

  var head = failed === 0
    ? '✅  ALL ' + passed + ' CHECKS PASSED'
    : '❌  ' + failed + ' FAILED, ' + passed + ' passed';

  var pre = document.getElementById('test-out');
  pre.hidden = false;
  pre.textContent = 'Candy Coven — self-checks\n' + '='.repeat(46) + '\n' +
    head + '\n' + out.join('\n') +
    '\n\n' + '='.repeat(46) + '\nRemove ?test from the URL to play.';
  pre.style.color = failed === 0 ? '#8ee6a0' : '#ff9a9a';

  (failed === 0 ? console.log : console.error)(head);
  global.__ccTestResult = { passed: passed, failed: failed };
})(window);
