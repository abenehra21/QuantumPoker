/*
 * Candy Coven — Quantum Poker
 * ui.js : screens, rendering, and everything the player touches.
 */
(function (global) {
  'use strict';

  var Q = global.Q, E = global.Engine;

  /* ------------------------------------------------------------------ *
   * Art
   * ------------------------------------------------------------------ */

  var SVG_PUMPKIN =
    '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<path d="M21 33 L46 42 L23 53 Z"/>' +
      '<path d="M79 33 L54 42 L77 53 Z"/>' +
      '<path d="M50 45 L42 61 L58 61 Z"/>' +
      '<path d="M20 64 L32 69 L38 62 L46 70 L54 62 L62 69 L68 62 L80 65 L73 81 Q50 91 27 81 Z"/>' +
    '</svg>';

  var SVG_SKULL =
    '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle cx="36" cy="45" r="9.5"/>' +
      '<circle cx="64" cy="45" r="9.5"/>' +
      '<path d="M50 53 L43.5 65 L56.5 65 Z"/>' +
      '<rect x="35" y="71" width="30" height="10" rx="2.5"/>' +
      '<rect x="44.5" y="71" width="2.6" height="10" fill="rgba(0,0,0,.5)"/>' +
      '<rect x="52.9" y="71" width="2.6" height="10" fill="rgba(0,0,0,.5)"/>' +
    '</svg>';

  var CARD_GLYPH = { FLIP: '🦇', HAUNT: '👻', SUMMON: '🕯️', BIND: '⛓️' };
  var AVATARS = ['🎃', '👻', '🦇', '🕷️', '🧙', '🐈‍⬛', '💀', '🕸️'];
  var DEFAULT_NAMES = ['Morticia', 'Ichabod', 'Hazel', 'Grimm', 'Wednesday'];

  /* ------------------------------------------------------------------ *
   * Little helpers
   * ------------------------------------------------------------------ */

  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function show(node) { node.hidden = false; }
  function hide(node) { node.hidden = true; }
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem('cc_' + key);
      localStorage.setItem('cc_' + key, value);
    } catch (e) { /* private browsing, never mind */ }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * UI state
   * ------------------------------------------------------------------ */

  var game = null;
  var seats = [];                 // setup rows
  var selectedCard = null;        // card id being aimed
  var pickedCoins = [];           // targets chosen so far
  var curtainedSeat = -1;         // whose gate turn has been unveiled
  var hint = null;
  var nerd = store('nerd') === '1';
  var peekTimer = null;

  /* ------------------------------------------------------------------ *
   * Setup screen
   * ------------------------------------------------------------------ */

  function initSetup() {
    seats = [
      { name: DEFAULT_NAMES[0], avatar: 0 },
      { name: DEFAULT_NAMES[1], avatar: 1 },
      { name: DEFAULT_NAMES[2], avatar: 2 }
    ];
    renderSeats();

    $('#btn-add-seat').onclick = function () {
      if (seats.length >= 5) return;
      seats.push({ name: DEFAULT_NAMES[seats.length] || 'Player ' + (seats.length + 1), avatar: seats.length % AVATARS.length });
      renderSeats();
    };
    $('#btn-remove-seat').onclick = function () {
      if (seats.length <= 2) return;
      seats.pop();
      renderSeats();
    };
    $('#btn-start').onclick = startGame;
    $('#btn-tutorial').onclick = function () { startTutorial(); };
    $('#btn-rules-setup').onclick = openRules;
  }

  function renderSeats() {
    var list = $('#seat-list');
    list.innerHTML = '';
    seats.forEach(function (s, i) {
      var row = el('div', 'seat');

      var av = el('button', 'avatar-btn', AVATARS[s.avatar]);
      av.type = 'button';
      av.setAttribute('aria-label', 'Change avatar for player ' + (i + 1));
      av.onclick = function () {
        s.avatar = (s.avatar + 1) % AVATARS.length;
        av.textContent = AVATARS[s.avatar];
      };

      var input = document.createElement('input');
      input.value = s.name;
      input.maxLength = 14;
      input.setAttribute('aria-label', 'Name for player ' + (i + 1));
      input.oninput = function () { s.name = input.value; };

      row.appendChild(av);
      row.appendChild(input);
      list.appendChild(row);
    });
    $('#btn-add-seat').disabled = seats.length >= 5;
    $('#btn-remove-seat').disabled = seats.length <= 2;
  }

  function startGame() {
    var params = new URLSearchParams(location.search);
    var seedParam = params.get('seed');
    game = new E.Game({
      players: seats.map(function (s, i) {
        return { name: (s.name || '').trim() || 'Player ' + (i + 1), avatar: AVATARS[s.avatar] };
      }),
      seed: seedParam === null ? null : parseInt(seedParam, 10)
    });
    curtainedSeat = -1;
    hide($('#screen-setup'));
    show($('#screen-table'));
    sync();
  }

  /* ------------------------------------------------------------------ *
   * Main loop
   * ------------------------------------------------------------------ */

  /** Decide which screen or overlay the game state calls for, then draw. */
  function sync() {
    if (!game) return;
    if (game.phase === 'over') { render(); openShowdown(); return; }
    if (game.phase === 'gates' && curtainedSeat !== game.actor && game.players.length > 1) {
      render();
      openCurtain(game.actor, function () { curtainedSeat = game.actor; sync(); });
      return;
    }
    render();
  }

  function render() {
    if (!game) return;
    renderTop();
    renderCoins();
    renderPlayers();
    renderPrompt();
    renderHandRail();
    renderActions();
    requestAnimationFrame(drawChains);
  }

  /** Your own cards, face down, so you can see how many you are holding. */
  function renderHandRail() {
    var rail = $('#handrail');
    if (game.phase !== 'betting' || game.actor < 0) { rail.hidden = true; return; }
    var seat = game.actor;
    var count = game.handSize(seat);
    rail.hidden = false;
    rail.innerHTML = '';
    var cards = el('div', 'handrail-cards');
    for (var i = 0; i < count; i++) cards.appendChild(el('div', 'handrail-card', '🎃'));
    rail.appendChild(cards);
    rail.appendChild(el('span', 'handrail-label', 'Your hand — tap to peek'));
    rail.setAttribute('aria-label', 'Peek at your ' + count + ' cards');
    rail.onclick = function () { openPeek(seat); };
  }

  function renderTop() {
    $('#round-name').textContent = game.phase === 'gates'
      ? 'Cards on the Coins'
      : E.ROUND_NAMES[Math.min(game.round, 3)];
    $('#blind-chip').textContent =
      'Hand ' + game.handNo + ' · blinds ' + game.smallBlind + '/' + game.bigBlind;
    $('#pot-value').textContent = game.potTotal();
    $('#btn-nerd').setAttribute('aria-pressed', nerd ? 'true' : 'false');
  }

  /** The board belonging to whoever is acting — everyone has their own copy. */
  function activeBoard() {
    var seat = game.actor >= 0 ? game.actor : game.liveSeats()[0];
    return game.players[seat].board;
  }

  function renderCoins() {
    var row = $('#coin-row');
    var board = activeBoard();
    var chains = Q.findChains(board);
    row.innerHTML = '';

    for (var i = 0; i < game.coins; i++) {
      var revealed = i < game.revealed;
      var info = revealed ? Q.readCoin(board, i) : null;
      var kind = revealed ? info.kind : 'hidden';

      var slot = el('button', 'coin-slot');
      slot.type = 'button';
      slot.dataset.i = String(i);

      var coin = el('div', 'coin');
      coin.dataset.kind = kind;
      var d3 = el('div', 'coin-3d');
      // Offset each coin's spin, otherwise the whole row goes edge-on together
      // and the table appears to blink.
      d3.style.animationDelay = (-0.19 * i).toFixed(2) + 's';
      var front = el('div', 'coin-face coin-front');
      front.innerHTML = SVG_PUMPKIN;
      var back = el('div', 'coin-face coin-back');
      back.innerHTML = SVG_SKULL;
      var edge = el('div', 'coin-edge');
      d3.appendChild(edge); d3.appendChild(front); d3.appendChild(back);
      coin.appendChild(d3);

      var meta = el('div', 'coin-meta');
      meta.appendChild(el('span', 'coin-no', 'COIN ' + (i + 1)));
      if (revealed) {
        var chain = chainFor(chains, i);
        var tag = el('span', 'coin-tag ' + tagClass(kind, chain));
        tag.textContent = tagText(kind, chain, i);
        meta.appendChild(tag);
        if (nerd) {
          var k = el('span', 'coin-ket');
          k.textContent = info.ket || ('P↑ ' + info.up.toFixed(2));
          meta.appendChild(k);
        }
      }

      slot.appendChild(coin);
      slot.appendChild(meta);
      slot.setAttribute('aria-label', coinAria(i, revealed, info, chainFor(chains, i)));

      wireCoin(slot, i, revealed);
      row.appendChild(slot);
    }

    row.dataset.chains = JSON.stringify(chains);
    renderLegend(board, chains);
  }

  function chainFor(chains, i) {
    for (var k = 0; k < chains.length; k++) {
      if (chains[k].a === i) return { partner: chains[k].b, same: chains[k].same };
      if (chains[k].b === i) return { partner: chains[k].a, same: chains[k].same };
    }
    return null;
  }

  function tagClass(kind, chain) {
    if (chain) return 'link';
    if (kind === 'up') return 'good';
    if (kind === 'cw' || kind === 'ccw') return 'spin';
    return '';
  }

  function tagText(kind, chain, i) {
    if (chain) return (chain.same ? '⛓ = ' : '⛓ ≠ ') + (chain.partner + 1);
    if (kind === 'up') return 'FACE-UP';
    if (kind === 'down') return 'dead';
    if (kind === 'cw') return '↻ 50%';
    if (kind === 'ccw') return '↺ 50%';
    return '50%';
  }

  function coinAria(i, revealed, info, chain) {
    if (!revealed) return 'Coin ' + (i + 1) + ', not turned over yet';
    var what = { up: 'face-up, a sure point', down: 'skull side up, dead',
                 cw: 'spinning clockwise, even odds', ccw: 'spinning counter-clockwise, even odds',
                 murky: 'chained, even odds' }[info.kind];
    return 'Coin ' + (i + 1) + ', ' + what +
      (chain ? ', chained to coin ' + (chain.partner + 1) + (chain.same ? ', lands the same' : ', lands opposite') : '');
  }

  function renderLegend(board, chains) {
    var legend = $('#coin-legend');
    // Only chains between coins already turned over. Counting the hidden ones
    // would tell the table something it has not paid to see.
    chains = chains.filter(function (c) { return c.a < game.revealed && c.b < game.revealed; });
    if (hint) { legend.textContent = '\u{1F4A1} ' + hint.label; return; }
    if (game.phase === 'gates' && selectedCard) {
      var card = E.CARDS[selectedCard];
      legend.textContent = pickedCoins.length < card.arity
        ? 'Tap ' + (card.arity - pickedCoins.length) + ' coin' + (card.arity - pickedCoins.length > 1 ? 's' : '') + ' to aim ' + card.name + '.'
        : '';
      return;
    }
    if (game.revealed === 0) {
      legend.textContent = 'No coins on the table yet — bet on nerve alone.';
      return;
    }
    var sure = 0, i;
    for (i = 0; i < game.revealed; i++) if (Q.readCoin(board, i).kind === 'up') sure++;
    var expected = Q.expectedScore(board, game.revealed);
    var text = sure + ' locked face-up · ' + expected.toFixed(1) + ' expected out of ' + game.revealed;
    if (chains.length) {
      text += ' · ' + chains.map(function (c) {
        return 'coins ' + (c.a + 1) + ' and ' + (c.b + 1) + ' land ' + (c.same ? 'together' : 'opposite');
      }).join('; ');
    }
    legend.textContent = text;
  }

  function wireCoin(slot, i, revealed) {
    var interactive = game.phase === 'gates' && selectedCard && revealed;
    slot.disabled = !interactive;
    if (interactive) slot.classList.add('pickable');
    if (pickedCoins.indexOf(i) !== -1) slot.classList.add('picked');
    if (hint && hint.targets.indexOf(i) !== -1) slot.classList.add('hinted');

    if (!interactive) return;

    slot.onclick = function () { pickCoin(i); };
    slot.onmouseenter = function () {
      var card = E.CARDS[selectedCard];
      var targets = pickedCoins.concat([i]);
      if (targets.length !== card.arity) return;
      if (card.arity === 2 && targets[0] === targets[1]) return;
      var pv = E.previewCard(game.players[game.actor].board, selectedCard, targets, game.coins);
      if (pv) {
        $('#coin-legend').textContent = card.name + ' → ' + pv.text +
          (pv.delta > 0.001 ? '  (+' + pv.delta.toFixed(1) + ')' : pv.delta < -0.001 ? '  (' + pv.delta.toFixed(1) + ')' : '');
      }
    };
    slot.onmouseleave = function () { renderLegend(activeBoard(), Q.findChains(activeBoard())); };
  }

  function pickCoin(i) {
    var card = E.CARDS[selectedCard];
    if (pickedCoins.indexOf(i) !== -1) return;
    pickedCoins.push(i);
    if (pickedCoins.length < card.arity) { hint = null; render(); return; }
    var res = game.playCard(selectedCard, pickedCoins.slice());
    selectedCard = null;
    pickedCoins = [];
    hint = null;
    if (!res.ok) { $('#coin-legend').textContent = res.why; }
    render();
  }

  /* ---- chains drawn between coins ---- */

  function drawChains() {
    var svg = $('#chain-layer');
    if (!svg) return;
    svg.innerHTML = '';
    var row = $('#coin-row');
    if (!row || !row.dataset.chains) return;
    var chains = JSON.parse(row.dataset.chains);
    var wrap = svg.parentNode.getBoundingClientRect();
    svg.setAttribute('viewBox', '0 0 ' + wrap.width + ' ' + wrap.height);

    chains.forEach(function (ch) {
      if (ch.a >= game.revealed || ch.b >= game.revealed) return;
      var A = row.children[ch.a], B = row.children[ch.b];
      if (!A || !B) return;
      var ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
      var x1 = ra.left + ra.width / 2 - wrap.left;
      var x2 = rb.left + rb.width / 2 - wrap.left;
      var y = ra.top + ra.height * 0.16 - wrap.top;
      var lift = Math.min(46, 18 + Math.abs(x2 - x1) * 0.15);

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M' + x1 + ' ' + y + ' Q' + ((x1 + x2) / 2) + ' ' + (y - lift) + ' ' + x2 + ' ' + y);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', ch.same ? '#7ce38b' : '#ff9ad2');
      path.setAttribute('stroke-width', '2.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-dasharray', '7 6');
      path.setAttribute('opacity', '.85');
      path.style.filter = 'drop-shadow(0 0 6px ' + (ch.same ? 'rgba(124,227,139,.8)' : 'rgba(255,154,210,.8)') + ')';
      svg.appendChild(path);
    });
  }

  /* ------------------------------------------------------------------ *
   * Players strip
   * ------------------------------------------------------------------ */

  function renderPlayers() {
    var box = $('#players');
    box.innerHTML = '';
    game.players.forEach(function (p) {
      var card = el('div', 'player' + (p.seat === game.actor ? ' turn' : '') +
        (p.folded && !p.out ? ' folded' : '') + (p.out ? ' out' : ''));
      card.appendChild(el('div', 'player-av', p.avatar));
      card.appendChild(el('div', 'player-name', p.name));
      card.appendChild(el('div', 'player-stack', p.out ? 'out' : String(p.points)));
      card.appendChild(el('div', 'player-bet', p.bet > 0 ? 'bet ' + p.bet : (p.folded && !p.out ? 'folded' : '')));
      if (p.allIn && !p.out) card.appendChild(el('span', 'badge allin', 'ALL IN'));
      else if (p.seat === game.dealer && !p.out) card.appendChild(el('span', 'badge dealer', 'D'));
      box.appendChild(card);
    });
  }

  function renderPrompt() {
    var p = $('#prompt');
    if (game.phase === 'gates') {
      var actor = game.players[game.actor];
      p.innerHTML = '<span><em>' + esc(actor.name) + '</em> — play cards on your coins, then end your turn.</span>';
    } else if (game.phase === 'betting') {
      var a = game.players[game.actor];
      var owe = game.toCall(game.actor);
      p.innerHTML = '<span><em>' + esc(a.name) + '</em> — ' +
        (owe > 0 ? 'call ' + owe + ', raise, or fold.' : 'check, bet, or fold.') + '</span>';
    } else {
      p.textContent = game.message;
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ------------------------------------------------------------------ *
   * Action bar
   * ------------------------------------------------------------------ */

  function renderActions() {
    var bar = $('#actionbar');
    bar.innerHTML = '';
    if (game.phase === 'betting') renderBetting(bar);
    else if (game.phase === 'gates') renderGates(bar);
  }

  function renderBetting(bar) {
    var seat = game.actor, p = game.players[seat];
    var owe = game.toCall(seat);
    var minTo = game.minRaiseTo(seat);
    var maxTo = p.bet + p.points;

    var row = el('div', 'action-row');

    var fold = el('button', 'btn danger', 'Fold');
    fold.type = 'button';
    fold.onclick = function () { game.fold(); afterBet(); };
    row.appendChild(fold);

    var call = el('button', 'btn primary', owe === 0 ? 'Check' : (owe >= p.points ? 'Call all in ' + owe : 'Call ' + owe));
    call.type = 'button';
    call.onclick = function () { game.call(); afterBet(); };
    row.appendChild(call);

    bar.appendChild(row);

    if (maxTo > game.currentBet) {
      var raiseRow = el('div', 'raise-row');
      var slider = document.createElement('input');
      slider.type = 'range';
      slider.min = String(minTo);
      slider.max = String(maxTo);
      slider.step = '1';
      slider.value = String(Math.min(maxTo, minTo));
      slider.setAttribute('aria-label', 'Raise to');

      var amt = el('span', 'raise-amt', slider.value);
      slider.oninput = function () { amt.textContent = slider.value; };

      var go = el('button', 'btn', 'Raise');
      go.type = 'button';
      go.onclick = function () {
        var r = game.raiseTo(parseInt(slider.value, 10));
        if (!r.ok) { $('#prompt').textContent = r.why; return; }
        afterBet();
      };

      var shove = el('button', 'btn', 'All in');
      shove.type = 'button';
      shove.onclick = function () { game.raiseTo(maxTo); afterBet(); };

      raiseRow.appendChild(amt);
      raiseRow.appendChild(slider);
      raiseRow.appendChild(go);
      raiseRow.appendChild(shove);
      bar.appendChild(raiseRow);
    }
  }

  function afterBet() {
    selectedCard = null; pickedCoins = []; hint = null;
    sync();
  }

  function renderGates(bar) {
    var seat = game.actor, p = game.players[seat];

    var strip = el('div', 'hand-strip');
    E.CARD_IDS.forEach(function (id) {
      var count = p.hand[id] || 0;
      var card = E.CARDS[id];
      var btn = el('button', 'card' + (selectedCard === id ? ' selected' : '') +
        (hint && hint.card === id ? ' hinted' : ''));
      btn.type = 'button';
      btn.disabled = count === 0;
      btn.innerHTML =
        '<span class="card-glyph">' + CARD_GLYPH[id] + '</span>' +
        '<span class="card-name">' + card.name + (count > 1 ? ' ×' + count : '') + '</span>' +
        (nerd ? '<span class="card-gate">' + card.gate + ' gate</span>' : '') +
        '<span class="card-blurb">' + card.blurb + '</span>';
      btn.onclick = function () {
        selectedCard = selectedCard === id ? null : id;
        pickedCoins = [];
        hint = null;
        render();
      };
      strip.appendChild(btn);
    });
    bar.appendChild(strip);

    var row = el('div', 'action-row');

    var hintBtn = el('button', 'btn ghost', '💡 Hint');
    hintBtn.type = 'button';
    hintBtn.disabled = game.handSize(seat) === 0;
    hintBtn.onclick = function () {
      var best = game.bestPlay(seat);
      if (!best || best.delta <= 0.001) {
        hint = null;
        $('#coin-legend').textContent = 'Nothing left that improves your odds. End your turn.';
        return;
      }
      hint = {
        card: best.card, targets: best.targets,
        label: 'Play ' + E.CARDS[best.card].name + ' on coin ' +
               best.targets.map(function (t) { return t + 1; }).join(' → ') +
               ' — ' + best.text + ' (+' + best.delta.toFixed(1) + ')'
      };
      selectedCard = null; pickedCoins = [];
      render();
    };
    row.appendChild(hintBtn);

    var end = el('button', 'btn primary', 'End turn');
    end.type = 'button';
    end.onclick = function () {
      selectedCard = null; pickedCoins = []; hint = null;
      game.endTurn();
      sync();
    };
    row.appendChild(end);

    bar.appendChild(row);
  }

  /* ------------------------------------------------------------------ *
   * Curtain / peek
   * ------------------------------------------------------------------ */

  function openCurtain(seat, done) {
    var p = game.players[seat];
    $('#curtain-avatar').textContent = p.avatar;
    $('#curtain-name').textContent = p.name;
    $('#curtain-sub').textContent = 'Everyone else, look away. Your coins and cards are private.';
    show($('#curtain'));
    $('#curtain-go').onclick = function () { hide($('#curtain')); done(); };
    $('#curtain-go').focus();
  }

  function openPeek(seat) {
    var p = game.players[seat];
    var strip = $('#peek-hand');
    strip.innerHTML = '';
    E.CARD_IDS.forEach(function (id) {
      var count = p.hand[id] || 0;
      if (!count) return;
      var card = E.CARDS[id];
      var node = el('div', 'card');
      node.innerHTML =
        '<span class="card-glyph">' + CARD_GLYPH[id] + '</span>' +
        '<span class="card-name">' + card.name + (count > 1 ? ' ×' + count : '') + '</span>' +
        '<span class="card-blurb">' + card.blurb + '</span>';
      strip.appendChild(node);
    });
    $('#peek-sub').textContent = 'Held by ' + p.name + '. Hides in a few seconds.';
    show($('#peek'));
    clearTimeout(peekTimer);
    peekTimer = setTimeout(closePeek, 6000);
  }

  function closePeek() { clearTimeout(peekTimer); hide($('#peek')); }

  /* ------------------------------------------------------------------ *
   * Showdown
   * ------------------------------------------------------------------ */

  var sdTimers = [];

  function openShowdown() {
    var body = $('#showdown-body');
    body.innerHTML = '';
    sdTimers.forEach(clearTimeout);
    sdTimers = [];

    $('#showdown-title').textContent = game.results.uncontested ? 'Everyone folded' : 'Showdown';
    $('#showdown-next').hidden = true;
    $('#showdown-skip').hidden = false;

    var contenders = game.players.filter(function (p) { return p.score !== null; });
    var delay = 0;
    var step = 340;

    contenders.forEach(function (p) {
      var sec = el('div', 'sd-player');
      var head = el('div', 'sd-head');
      head.appendChild(el('span', 'av', p.avatar));
      head.appendChild(el('span', 'nm', p.name));
      sec.appendChild(head);

      var coins = el('div', 'sd-coins');
      var nodes = [];
      p.bits.forEach(function (bit) {
        var c = el('div', 'sd-coin ' + (bit ? 'hit' : 'miss'));
        c.innerHTML = bit ? SVG_PUMPKIN : SVG_SKULL;
        coins.appendChild(c);
        nodes.push(c);
      });
      sec.appendChild(coins);

      var rank = el('div', 'rank-name' + (p.score === 5 ? ' bloodmoon' : ''), '');
      sec.appendChild(rank);
      body.appendChild(sec);

      nodes.forEach(function (c) {
        delay += step;
        sdTimers.push(setTimeout(function () { c.classList.add('shown'); }, delay));
      });
      delay += 160;
      sdTimers.push(setTimeout(function () {
        rank.textContent = E.rankName(p.score) + ' — ' + p.score + ' face-up';
      }, delay));
    });

    var summary = el('div', 'sd-summary', '');
    body.appendChild(summary);
    delay += 420;
    sdTimers.push(setTimeout(function () { finishShowdown(summary); }, delay));

    show($('#showdown'));

    $('#showdown-skip').onclick = function () {
      sdTimers.forEach(clearTimeout);
      sdTimers = [];
      body.querySelectorAll('.sd-coin').forEach(function (c) { c.classList.add('shown'); });
      contenders.forEach(function (p, i) {
        body.querySelectorAll('.rank-name')[i].textContent = E.rankName(p.score) + ' — ' + p.score + ' face-up';
      });
      finishShowdown(summary);
    };
  }

  function finishShowdown(summary) {
    summary.textContent = game.results.summary;
    $('#showdown-skip').hidden = true;
    var next = $('#showdown-next');
    next.hidden = false;
    next.textContent = game.gameOver() ? 'See the damage' : 'Next hand';
    next.onclick = function () {
      hide($('#showdown'));
      if (game.gameOver()) { openBank(); return; }
      curtainedSeat = -1;
      selectedCard = null; pickedCoins = []; hint = null;
      game.nextHand();
      sync();
    };
    next.focus();
  }

  /* ------------------------------------------------------------------ *
   * Bank
   * ------------------------------------------------------------------ */

  function openBank() {
    var body = $('#bank-body');
    body.innerHTML = '';
    var sorted = game.players.slice().sort(function (a, b) { return b.points - a.points; });
    var payouts = E.settlePool(sorted);
    sorted.forEach(function (p, i) {
      var row = el('div', 'bank-row');
      row.appendChild(el('span', 'player-av', p.avatar));
      var mid = el('div');
      mid.appendChild(el('div', 'bank-name', p.name + (p.points > 0 && i === 0 ? ' 👑' : '')));
      mid.appendChild(el('div', 'bank-candy', E.describeStash(payouts[i]) +
        (payouts[i].short ? '  (+' + payouts[i].short + ' owed)' : '')));
      row.appendChild(mid);
      var delta = p.points - p.startPoints;
      row.appendChild(el('span', 'bank-delta ' + (delta >= 0 ? 'up' : 'down'),
        (delta >= 0 ? '+' : '') + delta));
      body.appendChild(row);
    });
    show($('#bank'));
    $('#bank-close').onclick = function () { hide($('#bank')); };
    $('#bank-again').onclick = function () {
      hide($('#bank'));
      hide($('#screen-table'));
      show($('#screen-setup'));
      game = null;
    };
  }

  /* ------------------------------------------------------------------ *
   * Rules sheet
   * ------------------------------------------------------------------ */

  function openRules() {
    var body = $('#rules-body');
    body.innerHTML =
      '<div><h3>The point</h3><p>Five cursed coins sit on the table. At the end of the hand they all land. ' +
      'Every coin that lands <b>face-up</b> — jack-o&#39;-lantern showing — is one point. Most points takes the pot. ' +
      'You bet candy along the way, exactly like poker.</p></div>' +

      '<div><h3>Reading a coin</h3>' +
      '<table class="rules-table">' +
      '<tr><td><span class="mini-coin up">' + SVG_PUMPKIN + '</span> Face-up</td><td>A sure point. Nothing can take it but your own card.</td></tr>' +
      '<tr><td><span class="mini-coin down">' + SVG_SKULL + '</span> Skull</td><td>Dead. Worth nothing unless you flip it.</td></tr>' +
      '<tr><td>↻ Spinning</td><td>Fifty-fifty. Which way it spins decides which card can catch it.</td></tr>' +
      '<tr><td>⛓ Chained</td><td>Two coins tied together. They always land the same way — or always opposite.</td></tr>' +
      '</table></div>' +

      '<div><h3>Your cards</h3><table class="rules-table">' +
      E.CARD_IDS.map(function (id) {
        var c = E.CARDS[id];
        return '<tr><td>' + CARD_GLYPH[id] + ' <b>' + c.name + '</b></td><td>' + c.blurb + '</td></tr>';
      }).join('') +
      '</table><p>Three cards each, dealt face-down. You play them after the last round of betting. ' +
      'Flip, Haunt and Bind undo themselves — play one twice and the coin is back where it started. ' +
      '<b>Summon is different</b>: it walks the coin round a four-step loop — ' +
      'dead → ↻ → face-up → ↺ — so spending two in a row on the same coin will cost you.</p></div>' +

      '<div><h3>The candy</h3><table class="rules-table"><tr><th>Sweet</th><th class="val">Worth</th></tr>' +
      E.CANDY.map(function (c) {
        return '<tr><td>' + c.name + '</td><td class="val">' + c.value + '</td></tr>';
      }).join('') +
      '</table><p>Everyone starts with 200 points of candy. Blinds climb every six hands so the night actually ends. ' +
      'The app keeps score; the candy moves for real.</p></div>' +

      '<div><h3>Hand ranks</h3><p>' +
      E.RANKS.map(function (r, i) { return i + ' → <b>' + r + '</b>'; }).join(' · ') +
      '</p></div>' +

      '<div><h3>The quantum bit</h3><p>The coins are real qubits and the cards are real quantum gates — ' +
      'Flip is X, Haunt is Hadamard, Summon is ZH, Bind is CNOT. Spinning is superposition; chained is entanglement. ' +
      'Hit the <b>ψ</b> button any time to see the actual states. You do not need any of this to win.</p></div>';

    show($('#rules'));
    $('#rules-close').onclick = function () { hide($('#rules')); };
  }

  /* ------------------------------------------------------------------ *
   * Tutorial — two coins, two cards, sixty seconds
   * ------------------------------------------------------------------ */

  var tut = null;

  function startTutorial() {
    tut = { step: 0, state: new Q.QState(2), waiting: null };
    tut.state.x(0);            // coin 1 face-up
    tut.state.h(1);            // coin 2 spinning clockwise
    show($('#tutorial'));
    renderTutorial();
    $('#tut-quit').onclick = function () { hide($('#tutorial')); tut = null; };
  }

  var TUT_STEPS = [
    {
      title: 'The coins',
      text: 'Two cursed coins. The left one landed <b>face-up</b> — that is a point in your pocket. ' +
            'The right one is still <b>spinning</b>: it is a coin flip, worth half a point on average.',
      next: 'Go on'
    },
    {
      title: 'Your job',
      text: 'You want coins face-up when the spinning stops. A spinning coin is not bad luck — it is an ' +
            '<b>opportunity</b>, because the right card can catch it.',
      next: 'Show me'
    },
    {
      title: 'Play a card',
      text: 'You are holding a <b>Summon</b> 🕯️. It catches a coin spinning <b>clockwise ↻</b> and locks it face-up. ' +
            'Tap Summon, then tap the spinning coin.',
      interactive: true
    },
    {
      title: 'Both face-up',
      text: 'Two coins, two points. That is the whole game — plus betting candy on whether your coins ' +
            'will beat everyone else&#39;s.',
      next: 'Let me play'
    }
  ];

  function renderTutorial() {
    var step = TUT_STEPS[tut.step];
    $('#tut-title').textContent = step.title;
    $('#tut-text').innerHTML = step.text;

    var row = $('#tut-coins');
    row.innerHTML = '';
    for (var i = 0; i < 2; i++) {
      var info = Q.readCoin(tut.state, i);
      var slot = el('button', 'coin-slot' + (step.interactive && tut.armed ? ' pickable' : ''));
      slot.type = 'button';
      slot.disabled = !(step.interactive && tut.armed);
      var coin = el('div', 'coin');
      coin.dataset.kind = info.kind;
      var d3 = el('div', 'coin-3d');
      var f = el('div', 'coin-face coin-front'); f.innerHTML = SVG_PUMPKIN;
      var b = el('div', 'coin-face coin-back'); b.innerHTML = SVG_SKULL;
      d3.appendChild(el('div', 'coin-edge')); d3.appendChild(f); d3.appendChild(b);
      coin.appendChild(d3);
      var meta = el('div', 'coin-meta');
      meta.appendChild(el('span', 'coin-tag ' + tagClass(info.kind, null), tagText(info.kind, null, i)));
      slot.appendChild(coin); slot.appendChild(meta);
      (function (idx) {
        slot.onclick = function () {
          if (idx !== 1) { $('#tut-text').innerHTML = 'That one is already face-up. Try the <b>spinning</b> coin.'; return; }
          tut.state.zh(1);
          tut.armed = false;
          tut.step = 3;
          renderTutorial();
        };
      })(i);
      row.appendChild(slot);
    }

    var hand = $('#tut-hand');
    hand.innerHTML = '';
    if (step.interactive) {
      var btn = el('button', 'card' + (tut.armed ? ' selected' : ''));
      btn.type = 'button';
      btn.innerHTML = '<span class="card-glyph">🕯️</span><span class="card-name">Summon</span>' +
        '<span class="card-blurb">Catches a clockwise spin face-up.</span>';
      btn.onclick = function () { tut.armed = !tut.armed; renderTutorial(); };
      hand.appendChild(btn);
    }

    var next = $('#tut-next');
    next.hidden = !!step.interactive;
    next.textContent = step.next || 'Next';
    next.onclick = function () {
      if (tut.step >= TUT_STEPS.length - 1) {
        hide($('#tutorial'));
        tut = null;
        store('tutorial', '1');
        return;
      }
      tut.step++;
      renderTutorial();
    };
  }

  /* ------------------------------------------------------------------ *
   * Atmosphere
   * ------------------------------------------------------------------ */

  function spawnEmbers() {
    var box = $('#embers');
    if (!box || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (var i = 0; i < 18; i++) {
      var e = el('div', 'ember');
      e.style.left = (Math.random() * 100) + 'vw';
      e.style.animationDuration = (9 + Math.random() * 11) + 's';
      e.style.animationDelay = (-Math.random() * 20) + 's';
      e.style.setProperty('--drift', (Math.random() * 90 - 45) + 'px');
      e.style.opacity = String(0.3 + Math.random() * 0.5);
      box.appendChild(e);
    }
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function boot() {
    spawnEmbers();
    initSetup();

    $('#btn-nerd').onclick = function () {
      nerd = !nerd;
      store('nerd', nerd ? '1' : '0');
      render();
    };
    $('#btn-rules').onclick = openRules;
    $('#rules-close').onclick = function () { hide($('#rules')); };
    $('#peek-close').onclick = closePeek;

    window.addEventListener('resize', function () { requestAnimationFrame(drawChains); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      ['#peek', '#rules', '#bank'].forEach(function (s) { hide($(s)); });
    });

    if (store('tutorial') !== '1') {
      // First visit: nudge, don't hijack.
      $('#btn-tutorial').classList.add('nudge');
    }
  }

  // Exposed so the self-checks (and a curious console) can drive the table.
  global.UI = { boot: boot, sync: sync, render: render, get game() { return game; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
