/*
 * Quantum Hold'em — explainer.js
 * "How to play" in about eighty seconds, on the home page.
 *
 * It is not a video file. Every frame is the game's own coins and cards,
 * animated live from a list of cues, so it stays sharp on any screen and its
 * captions are real, selectable text. Each cue sets absolute state, so the
 * state at any moment is the fold of every cue up to it: scrubbing is free.
 *
 * The cue list has no DOM dependency; only mount() touches the page.
 */
(function (root) {
  'use strict';

  const ONE = 'one', ZERO = 'zero', PLUS = 'plus', MINUS = 'minus', HID = 'hidden';
  const LINK = { kind: 'mixed', link: { partner: 1, same: true } };
  const LINK2 = { kind: 'mixed', link: { partner: 0, same: true } };

  const CUES = [
    /* 1 — the goal */
    { t: 0.0, set: { chapter: 'The goal', caption: 'Five coins are dealt to the middle of the table.',
      coins: [HID, HID, HID, HID, HID], cards: [], pot: null, score: null, links: [], spot: null, cardSpot: null }, sfx: 'card' },
    { t: 2.4, set: { caption: 'At the end of the hand, every coin lands on a 1 or a 0.' } },
    { t: 3.6, set: { coins: [ONE, HID, HID, HID, HID] }, sfx: 'coin' },
    { t: 4.1, set: { coins: [ONE, ZERO, HID, HID, HID] }, sfx: 'thud' },
    { t: 4.6, set: { coins: [ONE, ZERO, ONE, HID, HID] }, sfx: 'coin' },
    { t: 5.1, set: { coins: [ONE, ZERO, ONE, ONE, HID] }, sfx: 'coin' },
    { t: 5.6, set: { coins: [ONE, ZERO, ONE, ONE, ZERO] }, sfx: 'thud' },
    { t: 6.6, set: { caption: 'Every coin showing a 1 is one point.', spot: [0, 2, 3], score: 3 } },
    { t: 9.2, set: { caption: 'Most points takes the pot. That is the whole game.', spot: null } },

    /* 2 — reading a coin */
    { t: 12.2, set: { chapter: 'Reading a coin', score: null,
      caption: 'A coin can already be settled on 1 — a sure point.', coins: [ONE, ZERO, PLUS, MINUS], spot: [0] }, sfx: 'card' },
    { t: 15.0, set: { caption: 'Or settled on 0. Worth nothing, unless you change it.', spot: [1] } },
    { t: 18.0, set: { caption: 'Or spinning. A spinning coin is a real quantum superposition: 50/50 until it lands.', spot: [2, 3] } },
    { t: 22.0, set: { caption: 'Spinning coins carry a hidden tilt, + or −. It decides what your cards do to them.' } },
    { t: 26.0, set: { caption: 'Two coins can be linked — entangled. They always land the same way, or always opposite.',
      coins: [LINK, LINK2], links: [[0, 1]], spot: null }, sfx: 'play' },

    /* 3 — the cards */
    { t: 30.0, set: { chapter: 'Your cards', caption: 'You get three cards. Each one is a quantum gate. There are five kinds.',
      coins: [], links: [], cards: ['X', 'H', 'Z', 'CX', 'M'], cardSpot: null }, sfx: 'card' },
    { t: 33.4, set: { caption: 'Flip turns a 0 into a 1.', coins: [ZERO], cardSpot: 'X' } },
    { t: 35.2, set: { coins: [ONE] }, sfx: 'coin' },
    { t: 37.0, set: { caption: 'Spin stops a spinning coin. A − spin lands on 1.', coins: [MINUS], cardSpot: 'H' } },
    { t: 39.2, set: { coins: [ONE] }, sfx: 'coin' },
    { t: 41.0, set: { caption: 'A + spin lands on 0…', coins: [PLUS] } },
    { t: 42.6, set: { coins: [ZERO] }, sfx: 'thud' },
    { t: 43.6, set: { caption: '…so Twist it first. Twist turns + into −.', coins: [PLUS], cardSpot: 'Z' } },
    { t: 45.4, set: { coins: [MINUS] }, sfx: 'play' },
    { t: 46.4, set: { caption: 'Then Spin. Two cards, one point.', cardSpot: 'H' } },
    { t: 47.6, set: { coins: [ONE] }, sfx: 'coin' },
    { t: 49.6, set: { caption: 'Link entangles a spinning coin with a settled one.', coins: [PLUS, ZERO], cardSpot: 'CX' } },
    { t: 51.6, set: { coins: [LINK, LINK2], links: [[0, 1]], caption: 'Now they land together. Fix one and you have fixed both.' }, sfx: 'play' },
    { t: 54.6, set: { caption: 'Collapse lands a spinning coin right now — on your board only.', coins: [PLUS], links: [], cardSpot: 'M' } },
    { t: 56.6, set: { coins: [ZERO], caption: 'Came up 0? You still have cards. Flip it.' }, sfx: 'thud' },
    { t: 58.2, set: { cardSpot: 'X' } },
    { t: 59.2, set: { coins: [ONE] }, sfx: 'coin' },

    /* 4 — the betting */
    { t: 61.2, set: { chapter: 'The betting', caption: 'It plays like Texas Hold’em. You know your cards; you bet before any coin shows.',
      coins: [HID, HID, HID, HID, HID], cards: [], cardSpot: null, pot: 30 }, sfx: 'chip' },
    { t: 64.4, set: { coins: [PLUS, ZERO, ONE, HID, HID], pot: 90, caption: 'The flop: three coins. Bet again.' }, sfx: 'chip' },
    { t: 66.6, set: { coins: [PLUS, ZERO, ONE, MINUS, HID], pot: 150, caption: 'The turn.' }, sfx: 'chip' },
    { t: 68.2, set: { coins: [PLUS, ZERO, ONE, MINUS, PLUS], pot: 260, caption: 'The river, and the last bets.' }, sfx: 'chip' },
    { t: 70.4, set: { caption: 'Then everyone plays their cards — each on their own copy of the five coins.' } },

    /* 5 — showdown */
    { t: 73.6, set: { chapter: 'Showdown', caption: 'The coins land. Count the ones.', coins: [HID, HID, HID, HID, HID] } },
    { t: 74.8, set: { coins: [ONE, HID, HID, HID, HID] }, sfx: 'coin' },
    { t: 75.3, set: { coins: [ONE, ONE, HID, HID, HID] }, sfx: 'coin' },
    { t: 75.8, set: { coins: [ONE, ONE, ONE, HID, HID] }, sfx: 'coin' },
    { t: 76.3, set: { coins: [ONE, ONE, ONE, ZERO, HID] }, sfx: 'thud' },
    { t: 76.8, set: { coins: [ONE, ONE, ONE, ZERO, ONE], score: 4, caption: 'Four — Quads. Most coins wins.' }, sfx: 'coin' },
    { t: 79.4, set: { caption: 'Tied? A 1 further left wins. Coin 1 is the ace.', spot: [0] } },
    { t: 82.2, set: { chapter: 'That is all of it', caption: 'Land coins on 1. Bet on your odds. Take the pot.',
      spot: null, score: null, pot: null } },
    { t: 84.6, set: { caption: 'The quantum mechanics underneath is real. Press Ψ at the table to see it.' } }
  ];

  const DURATION = 88;

  const CHAPTERS = (() => {
    const out = [];
    let seen = null;
    CUES.forEach((c) => {
      if (c.set.chapter && c.set.chapter !== seen) { seen = c.set.chapter; out.push({ t: c.t, name: seen }); }
    });
    return out;
  })();

  function blank() {
    return { chapter: '', caption: '', coins: [], cards: [], cardSpot: null, spot: null, pot: null, score: null, links: [] };
  }

  function stateAt(t) {
    const s = blank();
    for (const c of CUES) {
      if (c.t > t) break;
      Object.assign(s, c.set);
    }
    return s;
  }

  /* ------------------------------------------------------------------ *
   * Mounting on the page
   * ------------------------------------------------------------------ */

  function mount(rootEl, opts) {
    const Art = root.Art, Sound = root.Sound, E = root.Engine;
    const $ = (sel) => rootEl.querySelector(sel);
    const onDone = (opts && opts.onDone) || null;

    rootEl.innerHTML =
      '<div class="ex-stage" id="ex-stage">' +
        '<div class="ex-chapter" id="ex-chapter"></div>' +
        '<svg class="link-layer" id="ex-links" aria-hidden="true"></svg>' +
        '<div class="ex-pot" id="ex-pot" hidden></div>' +
        '<div class="ex-score" id="ex-score" hidden></div>' +
        '<div class="coin-row ex-coins" id="ex-coins"></div>' +
        '<div class="hand ex-cards" id="ex-cards"></div>' +
        '<p class="ex-caption" id="ex-caption" aria-live="polite"></p>' +
        '<button class="ex-cover" id="ex-cover" type="button" aria-label="Play the rules video">' +
          '<span class="ex-cover-btn">' + Art.icon('play') + '</span><span class="ex-cover-txt">Watch how to play · 1:28</span>' +
        '</button>' +
      '</div>' +
      '<div class="ex-transport">' +
        '<button class="icon-btn" id="ex-play" type="button" aria-label="Play"></button>' +
        '<div class="ex-scrub" id="ex-scrub" role="slider" tabindex="0" aria-label="Scrub" aria-valuemin="0" aria-valuemax="' +
          DURATION + '" aria-valuenow="0"><div class="ex-fill" id="ex-fill"></div><div class="ex-marks" id="ex-marks"></div></div>' +
        '<span class="ex-time mono" id="ex-time"></span>' +
      '</div>';

    let time = 0, playing = false, raf = null, last = 0, lastSfx = -1, rendered = null, started = false;
    let coinNodes = [];

    const marks = $('#ex-marks');
    CHAPTERS.forEach((ch) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ex-mark'; b.title = ch.name;
      b.style.left = ((ch.t / DURATION) * 100).toFixed(2) + '%';
      b.setAttribute('aria-label', 'Jump to ' + ch.name);
      b.onclick = (ev) => { ev.stopPropagation(); seek(ch.t); play(); };
      marks.appendChild(b);
    });

    function paint(s) {
      const prev = rendered || blank();
      if (s.chapter !== prev.chapter) $('#ex-chapter').textContent = s.chapter;
      if (s.caption !== prev.caption) {
        const cap = $('#ex-caption');
        cap.textContent = s.caption;
        cap.classList.remove('flash'); void cap.offsetWidth; cap.classList.add('flash');
      }
      const row = $('#ex-coins');
      if (s.coins.length !== coinNodes.length) {
        row.innerHTML = ''; coinNodes = [];
        s.coins.forEach((_, i) => { const n = Art.coinNode(String(i + 1)); coinNodes.push(n); row.appendChild(n); });
      }
      s.coins.forEach((spec, i) => {
        const info = typeof spec === 'string' ? { kind: spec } : spec;
        Art.paintCoin(coinNodes[i], info, false);
        coinNodes[i].classList.toggle('dim', !!(s.spot && !s.spot.includes(i)));
        coinNodes[i].classList.toggle('lit', !!(s.spot && s.spot.includes(i)));
      });
      const key = s.cards.join() + '|' + s.cardSpot;
      if (key !== prev.cards.join() + '|' + prev.cardSpot) {
        const hand = $('#ex-cards');
        hand.innerHTML = '';
        s.cards.forEach((id) => {
          const n = Art.cardNode(id, E.CARDS[id]);
          n.tabIndex = -1;
          n.classList.toggle('dim', !!(s.cardSpot && s.cardSpot !== id));
          n.classList.toggle('lit', s.cardSpot === id);
          hand.appendChild(n);
        });
      }
      const pot = $('#ex-pot');
      pot.hidden = s.pot === null;
      if (s.pot !== null) pot.innerHTML = '<span>Pot</span><b class="mono">' + s.pot + '</b>';
      const score = $('#ex-score');
      score.hidden = s.score === null;
      if (s.score !== null) score.innerHTML = '<b class="mono">' + s.score + '</b><span>' + E.rankName(s.score) + '</span>';
      requestAnimationFrame(() => drawLinks(s.links));
      rendered = s;
    }

    function drawLinks(links) {
      const svg = $('#ex-links');
      svg.innerHTML = '';
      if (!links || !links.length) return;
      const wrap = svg.parentNode.getBoundingClientRect();
      if (!wrap.width) return;
      svg.setAttribute('viewBox', '0 0 ' + wrap.width + ' ' + wrap.height);
      links.forEach(([a, b]) => {
        const A = coinNodes[a], B = coinNodes[b];
        if (!A || !B) return;
        const ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
        const x1 = ra.left + ra.width / 2 - wrap.left, x2 = rb.left + rb.width / 2 - wrap.left;
        const y = ra.top + 4 - wrap.top;
        const lift = Math.min(40, 14 + Math.abs(x2 - x1) * 0.12);
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', 'M' + x1 + ' ' + y + ' Q' + ((x1 + x2) / 2) + ' ' + (y - lift) + ' ' + x2 + ' ' + y);
        p.setAttribute('class', 'link-arc same');
        svg.appendChild(p);
      });
    }

    function fireSfx(from, to) {
      if (!Sound) return;
      CUES.forEach((c) => {
        if (c.sfx && c.t > from && c.t <= to && c.t > lastSfx) { lastSfx = c.t; if (Sound[c.sfx]) Sound[c.sfx](); }
      });
    }

    function frame(now) {
      if (!playing) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const was = time;
      time = Math.min(DURATION, time + dt);
      fireSfx(was, time);
      paint(stateAt(time));
      transport();
      if (time >= DURATION) { finish(); return; }
      raf = requestAnimationFrame(frame);
    }

    function play() {
      if (playing) return;
      if (time >= DURATION) time = 0;
      started = true;
      rootEl.classList.add('started');
      playing = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
      transport();
    }

    function pause() {
      playing = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      transport();
    }

    function seek(t) {
      time = Math.max(0, Math.min(DURATION, t));
      lastSfx = time;
      rendered = null; coinNodes = [];
      $('#ex-coins').innerHTML = ''; $('#ex-cards').innerHTML = ''; $('#ex-links').innerHTML = '';
      paint(stateAt(time));
      transport();
    }

    function finish() {
      playing = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      transport();
      if (onDone) onDone();
    }

    function fmt(s) {
      const m = Math.floor(s / 60), r = Math.floor(s % 60);
      return m + ':' + (r < 10 ? '0' : '') + r;
    }

    function transport() {
      $('#ex-fill').style.width = ((time / DURATION) * 100).toFixed(2) + '%';
      $('#ex-scrub').setAttribute('aria-valuenow', Math.round(time));
      const btn = $('#ex-play');
      const ended = time >= DURATION;
      btn.innerHTML = Art.icon(playing ? 'pause' : ended ? 'replay' : 'play');
      btn.setAttribute('aria-label', playing ? 'Pause' : ended ? 'Watch again' : 'Play');
      $('#ex-time').textContent = fmt(time) + ' / ' + fmt(DURATION);
      const ms = marks.children;
      for (let i = 0; i < ms.length; i++) {
        const next = CHAPTERS[i + 1] ? CHAPTERS[i + 1].t : DURATION;
        ms[i].classList.toggle('on', time >= CHAPTERS[i].t && time < next);
      }
    }

    $('#ex-cover').onclick = play;
    $('#ex-play').onclick = () => { playing ? pause() : play(); };
    $('#ex-stage').onclick = (ev) => { if (started && !ev.target.closest('button')) playing ? pause() : play(); };
    const scrub = $('#ex-scrub');
    scrub.onclick = (ev) => {
      const r = scrub.getBoundingClientRect();
      seek(((ev.clientX - r.left) / r.width) * DURATION);
      if (!started) play();
    };
    scrub.onkeydown = (ev) => {
      if (ev.key === 'ArrowRight') { seek(time + 5); ev.preventDefault(); }
      if (ev.key === 'ArrowLeft') { seek(time - 5); ev.preventDefault(); }
      if (ev.key === ' ') { playing ? pause() : play(); ev.preventDefault(); }
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });
    window.addEventListener('resize', () => { if (rendered) drawLinks(rendered.links); });

    seek(0);
    return { play, pause, seek, at: () => time };
  }

  root.Explainer = { cues: CUES, chapters: CHAPTERS, duration: DURATION, stateAt, mount };
})(typeof window !== 'undefined' ? window : globalThis);
