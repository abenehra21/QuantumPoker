/*
 * Quantum Poker — tutorial.js
 * "How to play" as a short film: a scripted timeline of coins, cards and
 * captions, paced the way a good board-game explainer is paced.
 *
 * It is not a video file. Every frame is the game's own art, animated live,
 * which keeps it sharp on a projector, silent on a slow connection, and
 * readable by a screen reader — the captions are real text.
 *
 * The timeline is a list of cues. Each cue sets absolute state rather than a
 * change, so the state at any moment is just the fold of every cue up to that
 * moment. That is what makes scrubbing and replay free.
 */
(function (global) {
  'use strict';

  var Art = global.Art, Sound = global.Sound;

  /* ------------------------------------------------------------ vocabulary -- */

  function C(k, tag, cls) { return { k: k, tag: tag, cls: cls || '' }; }
  var UP    = C('up', '1', 'good');
  var DOWN  = C('down', '0', '');
  var CW    = C('cw', '↻ 50%', 'spin');
  var CCW   = C('ccw', '↺ 50%', 'spin');
  var HID   = C('hidden', '', '');
  function LINK(n) { return C('murky', 'linked ' + n, 'link'); }
  function OPPOSED(n) { return C('murky', 'opposed ' + n, 'link-opp'); }

  /* ---------------------------------------------------------------- script -- */

  var CUES = [
    /* ---- 1. what you are trying to do ---- */
    { t: 0.0, set: {
      chapter: 'The goal',
      caption: 'Five qubits are dealt to the middle of the table, face down.',
      coins: [HID, HID, HID, HID, HID], cards: [], pot: null, score: null, chains: []
    }, sfx: 'card' },

    { t: 2.2, set: { caption: 'At the end of the hand, every one of them settles — on a 1 or a 0.' } },
    { t: 3.4, set: { coins: [UP, HID, HID, HID, HID] }, sfx: 'coin' },
    { t: 3.9, set: { coins: [UP, DOWN, HID, HID, HID] }, sfx: 'thud' },
    { t: 4.4, set: { coins: [UP, DOWN, UP, HID, HID] }, sfx: 'coin' },
    { t: 4.9, set: { coins: [UP, DOWN, UP, UP, HID] }, sfx: 'coin' },
    { t: 5.4, set: { coins: [UP, DOWN, UP, UP, DOWN] }, sfx: 'thud' },

    { t: 6.4, set: {
      caption: 'Every coin showing a 1 is one point.',
      spot: [0, 2, 3], score: 3
    } },
    { t: 8.6, set: { caption: 'Most points takes the candy. That is the whole game.', spot: null } },

    /* ---- 2. reading a coin ---- */
    { t: 11.2, set: {
      chapter: 'Reading a coin', score: null,
      caption: 'Three things can be true of a coin. This one has settled on 1.',
      coins: [UP, DOWN, CW], spot: [0]
    }, sfx: 'card' },

    { t: 14.0, set: { caption: 'This one settled on 0. Worth nothing — unless you turn it.', spot: [1] } },
    { t: 16.8, set: { caption: 'And this one is still spinning: a qubit in superposition, even money.', spot: [2] } },

    { t: 20.0, set: {
      caption: 'Which way it spins matters. These are two different qubits.',
      coins: [CW, CCW], spot: null
    }, sfx: 'card' },
    { t: 22.8, set: { caption: 'Clockwise and counter-clockwise take different cards to catch.' } },

    /* ---- 3. the cards ---- */
    { t: 25.6, set: {
      chapter: 'Your cards',
      caption: 'You are dealt three cards. There are four you will see often.',
      coins: [], cards: ['FLIP', 'HAUNT', 'SUMMON', 'BIND'], spot: null
    }, sfx: 'card' },

    { t: 28.4, set: { caption: 'Flip turns a settled coin over.', coins: [DOWN], cardSpot: 'FLIP' } },
    { t: 30.4, set: { coins: [UP] }, sfx: 'cast' },

    { t: 32.4, set: {
      caption: 'Haunt sets a settled coin spinning — or stops one that already is.',
      coins: [DOWN], cardSpot: 'HAUNT'
    } },
    { t: 34.4, set: { coins: [CW] }, sfx: 'cast' },

    { t: 36.4, set: {
      caption: 'Summon catches a clockwise spin and pins it on 1. Your best card.',
      coins: [CW], cardSpot: 'SUMMON'
    } },
    { t: 38.6, set: { coins: [UP] }, sfx: 'coin' },

    { t: 40.6, set: { caption: 'But Summon does not undo itself.' } },
    { t: 42.2, set: { coins: [CCW], caption: 'Play it twice on the same coin and the point is gone.' }, sfx: 'thud' },

    /* ---- 4. entanglement ---- */
    { t: 45.4, set: {
      chapter: 'Links',
      caption: 'Bind entangles two coins.',
      coins: [CW, DOWN], cards: ['BIND'], cardSpot: 'BIND', spot: null
    }, sfx: 'card' },

    { t: 47.6, set: {
      coins: [LINK(2), LINK(1)], chains: [[0, 1]],
      caption: 'Linked coins always settle the same way.'
    }, sfx: 'cast' },

    { t: 50.4, set: { caption: 'So fix one of them, and you have fixed both.', cards: ['SUMMON'], cardSpot: 'SUMMON' } },
    { t: 52.6, set: { coins: [UP, UP], chains: [], caption: 'One card. Two points.' }, sfx: 'coin' },

    /* ---- 5. the rare one ---- */
    { t: 55.8, set: {
      chapter: 'The Observer',
      caption: 'And then there is the Observer. One exists. Most hands do not contain it.',
      coins: [], cards: ['OBSERVER'], cardSpot: 'OBSERVER', chains: []
    }, sfx: 'card' },

    { t: 59.0, set: {
      caption: 'It does not change a coin. It measures one — on every board at the table at once.',
      coins: [UP, CW, CW]
    } },
    { t: 61.6, set: { caption: 'Say you have already pinned your coin on 1, and the others have not.', spot: [0] } },
    { t: 64.0, set: { caption: 'Play the Observer, and every copy of that coin collapses where it stands.', spot: null }, sfx: 'observe' },
    { t: 66.2, set: { coins: [UP, DOWN, UP] } },
    { t: 67.4, set: {
      caption: 'You keep your point. Everyone still spinning gets a toss — and no way back.',
      spot: [0]
    } },
    { t: 70.4, set: { caption: 'Superposition gone, links broken, the value fixed. It is the strongest card in the deck.', spot: null } },

    /* ---- 6. the betting ---- */
    { t: 74.0, set: {
      chapter: 'The betting',
      caption: 'You bet candy before a single coin is turned over.',
      coins: [HID, HID, HID, HID, HID], cards: [], cardSpot: null, pot: 15
    }, sfx: 'chip' },

    { t: 76.4, set: { coins: [CW, DOWN, UP, HID, HID], pot: 40, caption: 'Three coins come down. Bet again.' }, sfx: 'chip' },
    { t: 78.8, set: { coins: [CW, DOWN, UP, CCW, HID], pot: 75, caption: 'A fourth. Bet again.' }, sfx: 'chip' },
    { t: 81.0, set: { coins: [CW, DOWN, UP, CCW, CW], pot: 120, caption: 'A fifth, and the last round of betting.' }, sfx: 'chip' },
    { t: 83.6, set: { caption: 'Only then does everybody play their cards.' } },

    /* ---- 7. the pay-off ---- */
    { t: 86.2, set: {
      chapter: 'The collapse', pot: 120,
      caption: 'The coins settle. Count the ones.',
      coins: [HID, HID, HID, HID, HID]
    } },
    { t: 87.6, set: { coins: [UP, HID, HID, HID, HID] }, sfx: 'coin' },
    { t: 88.1, set: { coins: [UP, UP, HID, HID, HID] }, sfx: 'coin' },
    { t: 88.6, set: { coins: [UP, UP, UP, HID, HID] }, sfx: 'coin' },
    { t: 89.1, set: { coins: [UP, UP, UP, UP, HID] }, sfx: 'coin' },
    { t: 89.6, set: { coins: [UP, UP, UP, UP, UP], score: 5, caption: 'Five ones. Coherence — and the whole pot.' }, sfx: 'coherence' },

    { t: 93.0, set: {
      chapter: 'That is all of it',
      caption: 'Settle coins on 1. Bet on your odds. Take the candy.',
      spot: null, score: null, pot: null, cards: [], cardSpot: null
    } },
    { t: 95.6, set: { caption: 'The quantum mechanics is real. Knowing that is optional.' } }
  ];

  var DURATION = 99.0;

  var CHAPTERS = (function () {
    var out = [], seen = null;
    CUES.forEach(function (c) {
      if (c.set.chapter && c.set.chapter !== seen) {
        seen = c.set.chapter;
        out.push({ t: c.t, name: seen });
      }
    });
    return out;
  })();

  /* ----------------------------------------------------------------- state -- */

  var time = 0, playing = false, rafId = null, lastFrame = 0, lastSfxAt = -1;
  var rendered = null, coinNodes = [], onDone = null, finished = false;

  function blank() {
    return { chapter: '', caption: '', coins: [], cards: [], cardSpot: null,
             spot: null, pot: null, score: null, chains: [] };
  }

  function stateAt(t) {
    var s = blank(), i, k;
    for (i = 0; i < CUES.length; i++) {
      if (CUES[i].t > t) break;
      for (k in CUES[i].set) if (CUES[i].set.hasOwnProperty(k)) s[k] = CUES[i].set[k];
    }
    return s;
  }

  /* -------------------------------------------------------------- rendering -- */

  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function buildCoin() {
    var slot = el('div', 'coin-slot film-coin');
    var shell = el('div', 'coin-shell');
    var coin = el('div', 'coin');
    var d3 = el('div', 'coin-3d');
    var edge = el('div', 'coin-edge');
    var front = el('div', 'coin-face coin-front'); front.innerHTML = Art.coinOne();
    var back = el('div', 'coin-face coin-back'); back.innerHTML = Art.coinZero();
    d3.appendChild(edge); d3.appendChild(front); d3.appendChild(back);
    coin.appendChild(d3); shell.appendChild(coin);
    var meta = el('div', 'coin-meta');
    var tag = el('span', 'coin-tag');
    meta.appendChild(tag);
    slot.appendChild(shell); slot.appendChild(meta);
    return { slot: slot, coin: coin, tag: tag };
  }

  function paint(s) {
    var prev = rendered || blank();

    if (s.chapter !== prev.chapter) $('#film-chapter').textContent = s.chapter;

    if (s.caption !== prev.caption) {
      var cap = $('#film-caption');
      cap.textContent = s.caption;
      cap.classList.remove('flash');
      void cap.offsetWidth;                 // restart the fade
      cap.classList.add('flash');
    }

    // Coins: reuse nodes so the flip animates instead of snapping.
    var row = $('#film-coins');
    if (s.coins.length !== coinNodes.length) {
      row.innerHTML = '';
      coinNodes = [];
      for (var i = 0; i < s.coins.length; i++) {
        var n = buildCoin();
        coinNodes.push(n);
        row.appendChild(n.slot);
      }
    }
    s.coins.forEach(function (spec, i) {
      var n = coinNodes[i];
      n.coin.dataset.kind = spec.k;
      n.tag.textContent = spec.tag;
      n.tag.className = 'coin-tag ' + spec.cls;
      n.tag.hidden = !spec.tag;
      n.slot.classList.toggle('dimmed', !!(s.spot && s.spot.indexOf(i) === -1));
      n.slot.classList.toggle('lit', !!(s.spot && s.spot.indexOf(i) !== -1));
    });

    // Cards
    var cardsKey = s.cards.join(',') + '|' + s.cardSpot;
    if (cardsKey !== prev.cards.join(',') + '|' + prev.cardSpot) {
      var hand = $('#film-cards');
      hand.innerHTML = '';
      s.cards.forEach(function (id) {
        var card = global.Engine.CARDS[id];
        var node = el('div', 'card film-card' +
          (card.rare ? ' rare' : '') +
          (s.cardSpot && s.cardSpot !== id ? ' dimmed' : '') +
          (s.cardSpot === id ? ' lit' : ''));
        node.innerHTML =
          '<span class="card-name">' + card.name + '</span>' +
          Art.cardArt(id) +
          '<span class="card-blurb">' + card.blurb + '</span>';
        if (card.rare) {
          var mark = el('span', 'rare-mark', 'rare');
          node.appendChild(mark);
        }
        hand.appendChild(node);
      });
    }

    // Pot and score
    var pot = $('#film-pot');
    pot.hidden = s.pot === null;
    if (s.pot !== null) pot.innerHTML = '<span class="pot-label">Pot</span>' +
      '<span class="pot-value">' + s.pot + '</span>';

    var score = $('#film-score');
    score.hidden = s.score === null;
    if (s.score !== null) score.innerHTML =
      '<span class="film-score-n">' + s.score + '</span><span class="film-score-l">face-up</span>';

    requestAnimationFrame(function () { drawChains(s.chains); });
    rendered = s;
  }

  function drawChains(chains) {
    var svg = $('#film-chain');
    if (!svg) return;
    svg.innerHTML = '';
    if (!chains || !chains.length) return;
    var row = $('#film-coins');
    var wrap = svg.parentNode.getBoundingClientRect();
    if (!wrap.width) return;
    svg.setAttribute('viewBox', '0 0 ' + wrap.width + ' ' + wrap.height);
    chains.forEach(function (pair) {
      var A = row.children[pair[0]], B = row.children[pair[1]];
      if (!A || !B) return;
      var ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
      var x1 = ra.left + ra.width / 2 - wrap.left;
      var x2 = rb.left + rb.width / 2 - wrap.left;
      var y = ra.top + ra.height * 0.14 - wrap.top;
      var lift = Math.min(46, 18 + Math.abs(x2 - x1) * 0.15);
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M' + x1 + ' ' + y + ' Q' + ((x1 + x2) / 2) + ' ' + (y - lift) + ' ' + x2 + ' ' + y);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', '#63a98c');
      p.setAttribute('stroke-width', '2.4');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-dasharray', '6 5');
      p.style.filter = 'drop-shadow(0 0 6px #63a98c)';
      svg.appendChild(p);
    });
  }

  /* ------------------------------------------------------------- transport -- */

  function fireSfx(from, to) {
    CUES.forEach(function (c) {
      if (!c.sfx) return;
      if (c.t > from && c.t <= to && c.t > lastSfxAt) {
        lastSfxAt = c.t;
        if (Sound[c.sfx]) Sound[c.sfx]();
      }
    });
  }

  function frame(now) {
    if (!playing) return;
    var dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    var was = time;
    time = Math.min(DURATION, time + dt);
    fireSfx(was, time);
    paint(stateAt(time));
    updateTransport();
    if (time >= DURATION) { finish(); return; }
    rafId = requestAnimationFrame(frame);
  }

  function play() {
    if (playing || finished) return;
    playing = true;
    lastFrame = performance.now();
    rafId = requestAnimationFrame(frame);
    updateTransport();
  }

  function pause() {
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    updateTransport();
  }

  function seek(t) {
    time = Math.max(0, Math.min(DURATION, t));
    lastSfxAt = time;            // no sound stampede when scrubbing
    // Wipe the whole stage, not just the coins: paint() diffs against
    // `rendered`, so anything left behind would never be diffed away.
    rendered = null;
    coinNodes = [];
    $('#film-coins').innerHTML = '';
    $('#film-cards').innerHTML = '';
    $('#film-chain').innerHTML = '';
    paint(stateAt(time));
    if (time >= DURATION) { finish(); return; }
    finished = false;
    $('#film-end').hidden = true;
    updateTransport();
  }

  function finish() {
    playing = false;
    finished = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    $('#film-end').hidden = false;
    updateTransport();
  }

  function updateTransport() {
    var pct = (time / DURATION) * 100;
    $('#film-fill').style.width = pct.toFixed(2) + '%';
    $('#film-scrub').setAttribute('aria-valuenow', Math.round(time));
    var btn = $('#film-play');
    btn.innerHTML = playing ? ICON_PAUSE : (finished ? ICON_REPLAY : ICON_PLAY);
    btn.setAttribute('aria-label', playing ? 'Pause' : finished ? 'Watch again' : 'Play');
    $('#film-time').textContent = fmt(time) + ' / ' + fmt(DURATION);

    var marks = $('#film-marks').children;
    for (var i = 0; i < marks.length; i++) {
      var at = CHAPTERS[i].t;
      var next = CHAPTERS[i + 1] ? CHAPTERS[i + 1].t : DURATION;
      marks[i].classList.toggle('on', time >= at && time < next);
    }
  }

  function fmt(s) {
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  var ICON_PLAY   = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  var ICON_PAUSE  = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
  var ICON_REPLAY = '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>';

  /* ------------------------------------------------------------------ open -- */

  function open(opts) {
    opts = opts || {};
    onDone = opts.onDone || null;
    finished = false;

    var marks = $('#film-marks');
    marks.innerHTML = '';
    CHAPTERS.forEach(function (ch) {
      var b = el('button', 'film-mark');
      b.type = 'button';
      b.style.left = ((ch.t / DURATION) * 100).toFixed(2) + '%';
      b.title = ch.name;
      b.setAttribute('aria-label', 'Jump to ' + ch.name);
      b.onclick = function () { seek(ch.t); play(); };
      marks.appendChild(b);
    });

    $('#film').hidden = false;
    seek(0);
    play();
  }

  function close(started) {
    pause();
    $('#film').hidden = true;
    if (onDone) { var f = onDone; onDone = null; f(started); }
  }

  function boot() {
    $('#film-play').onclick = function () {
      if (finished) { seek(0); play(); return; }
      playing ? pause() : play();
    };
    $('#film-skip').onclick = function () { close(false); };
    $('#film-deal').onclick = function () { close(true); };
    $('#film-practice').onclick = function () { close('practice'); };

    var scrub = $('#film-scrub');
    scrub.onclick = function (ev) {
      var r = scrub.getBoundingClientRect();
      seek(((ev.clientX - r.left) / r.width) * DURATION);
    };
    scrub.onkeydown = function (ev) {
      if (ev.key === 'ArrowRight') { seek(time + 5); ev.preventDefault(); }
      if (ev.key === 'ArrowLeft') { seek(time - 5); ev.preventDefault(); }
    };

    document.addEventListener('keydown', function (ev) {
      if ($('#film').hidden) return;
      if (ev.key === ' ') { ev.preventDefault(); playing ? pause() : play(); }
      if (ev.key === 'Escape') close(false);
    });

    global.addEventListener('resize', function () {
      if (!$('#film').hidden && rendered) drawChains(rendered.chains);
    });

    // Tab away and the animation frames stop; hold the film there rather than
    // letting it run on silently in the background.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && playing) pause();
    });

    // Expose the transport so the page can be driven without a clock.
    global.Film.seek = seek;
    global.Film.play = play;
    global.Film.pause = pause;
    global.Film.at = function () { return time; };
  }

  global.Film = {
    open: open, boot: boot,
    duration: DURATION,
    cues: CUES, chapters: CHAPTERS, stateAt: stateAt
  };
})(window);
