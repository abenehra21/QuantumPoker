/*
 * Candy Coven — ui.js
 *
 * One rule shapes this file: nodes persist. Coins, seats and cards are built
 * once and then updated in place, so the browser can animate a coin flipping
 * or a seat sliding round the table. Rebuilding the DOM every frame would
 * throw all of that away.
 */
(function (global) {
  'use strict';

  var Q = global.Q, E = global.Engine, Art = global.Art, Sound = global.Sound;

  /* ------------------------------------------------------------- helpers -- */

  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function show(n) { n.hidden = false; }
  function hide(n) { n.hidden = true; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem('cc_' + key);
      localStorage.setItem('cc_' + key, value);
    } catch (e) { /* private window; carry on */ }
    return null;
  }
  var REDUCED = global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --------------------------------------------------------------- state -- */

  var game = null;
  var seats = [];
  var selectedCard = null;
  var pickedCoins = [];
  var curtainedSeat = -1;
  var hint = null;
  var nerd = store('nerd') === '1';
  var peekTimer = null;
  var coinNodes = [];
  var seatNodes = {};
  var potShown = 0;
  var potTimer = null;

  var DEFAULT_NAMES = ['Morrow', 'Vesper', 'Crane', 'Ash', 'Wren'];

  /* --------------------------------------------------------------- setup -- */

  function initSetup() {
    seats = [0, 1, 2].map(function (i) {
      return { name: DEFAULT_NAMES[i], sigil: i };
    });
    renderSeats();
    $('#setup-rule').innerHTML = Art.rule();

    $('#btn-add-seat').onclick = function () {
      if (seats.length >= 5) return;
      seats.push({ name: DEFAULT_NAMES[seats.length], sigil: seats.length });
      Sound.card();
      renderSeats();
    };
    $('#btn-remove-seat').onclick = function () {
      if (seats.length <= 2) return;
      seats.pop();
      renderSeats();
    };
    $('#btn-start').onclick = startGame;
    $('#btn-tutorial').onclick = openFilm;
    $('#btn-rules-setup').onclick = openRules;
  }

  function renderSeats() {
    var list = $('#seat-list');
    list.innerHTML = '';
    seats.forEach(function (s, i) {
      var row = el('div', 'seat-row');

      var sig = el('button', 'sigil-btn');
      sig.type = 'button';
      sig.innerHTML = Art.sigil(Art.SIGIL_KEYS[s.sigil]);
      sig.setAttribute('aria-label', 'Change the mark for player ' + (i + 1));
      sig.onclick = function () {
        s.sigil = (s.sigil + 1) % Art.SIGIL_KEYS.length;
        sig.innerHTML = Art.sigil(Art.SIGIL_KEYS[s.sigil]);
      };

      var input = document.createElement('input');
      input.value = s.name;
      input.maxLength = 12;
      input.setAttribute('aria-label', 'Name for player ' + (i + 1));
      input.oninput = function () { s.name = input.value; };

      row.appendChild(sig);
      row.appendChild(input);
      list.appendChild(row);
    });
    $('#seat-count-label').textContent = seats.length + ' at the table';
    $('#btn-add-seat').disabled = seats.length >= 5;
    $('#btn-remove-seat').disabled = seats.length <= 2;
  }

  function startGame() {
    var seedParam = new URLSearchParams(location.search).get('seed');
    game = new E.Game({
      players: seats.map(function (s, i) {
        return { name: (s.name || '').trim() || 'Player ' + (i + 1), sigil: Art.SIGIL_KEYS[s.sigil] };
      }),
      seed: seedParam === null ? null : parseInt(seedParam, 10)
    });
    curtainedSeat = -1;
    coinNodes = [];
    seatNodes = {};
    heroCache = null;
    potShown = 0;
    $('#seats').innerHTML = '';
    $('#coin-row').innerHTML = '';
    hide($('#screen-setup'));
    show($('#screen-table'));
    Sound.card();
    sync();
  }

  /* ----------------------------------------------------------- main loop -- */

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
    renderTableSeats();
    renderPot();
    renderRead();
    renderPrompt();
    renderTray();
    renderLedger();
    requestAnimationFrame(drawChains);
  }

  function renderTop() {
    $('#street').textContent = game.phase === 'gates' ? 'Cards on the Coins'
      : E.ROUND_NAMES[Math.min(game.round, 3)];
    $('#street-meta').textContent =
      'Hand ' + game.handNo + ' — blinds ' + game.smallBlind + '/' + game.bigBlind;
    $('#btn-nerd').setAttribute('aria-pressed', nerd ? 'true' : 'false');
  }

  function activeBoard() {
    var seat = game.actor >= 0 ? game.actor : game.liveSeats()[0];
    return game.players[seat].board;
  }

  /* ---------------------------------------------------------------- coins -- */

  function buildCoin(i) {
    var slot = el('button', 'coin-slot');
    slot.type = 'button';
    slot.dataset.i = String(i);

    var shell = el('div', 'coin-shell');
    var coin = el('div', 'coin');
    var d3 = el('div', 'coin-3d');
    d3.style.animationDelay = (-0.19 * i).toFixed(2) + 's';

    var edge = el('div', 'coin-edge');
    var front = el('div', 'coin-face coin-front');
    front.innerHTML = Art.coinFace();
    var back = el('div', 'coin-face coin-back');
    back.innerHTML = Art.coinSkull();
    d3.appendChild(edge); d3.appendChild(front); d3.appendChild(back);
    coin.appendChild(d3);
    shell.appendChild(coin);

    var meta = el('div', 'coin-meta');
    var no = el('span', 'coin-no', 'Coin ' + (i + 1));
    var tag = el('span', 'coin-tag');
    var ket = el('span', 'coin-ket');
    meta.appendChild(no); meta.appendChild(tag); meta.appendChild(ket);

    slot.appendChild(shell);
    slot.appendChild(meta);

    var node = { slot: slot, coin: coin, tag: tag, ket: ket, kind: null };
    coinNodes[i] = node;
    return slot;
  }

  function renderCoins() {
    var row = $('#coin-row');
    if (!coinNodes.length || row.children.length !== game.coins) {
      row.innerHTML = '';
      coinNodes = [];
      for (var k = 0; k < game.coins; k++) row.appendChild(buildCoin(k));
    }

    var board = activeBoard();
    var chains = Q.findChains(board);

    for (var i = 0; i < game.coins; i++) {
      var n = coinNodes[i];
      var revealed = i < game.revealed;
      var info = revealed ? Q.readCoin(board, i) : null;
      var kind = revealed ? info.kind : 'hidden';
      var chain = revealed ? chainFor(chains, i) : null;

      if (n.kind !== kind) {
        // A coin that has just settled deserves to be heard.
        if (n.kind && (kind === 'up' || kind === 'down')) Sound.thud();
        n.coin.dataset.kind = kind;
        n.kind = kind;
      }

      n.tag.className = 'coin-tag ' + tagClass(kind, chain);
      n.tag.textContent = revealed ? tagText(kind, chain) : '';
      n.tag.hidden = !revealed;
      n.ket.textContent = nerd && revealed ? (info.ket || 'P↑ ' + info.up.toFixed(2)) : '';
      n.slot.setAttribute('aria-label', coinAria(i, revealed, info, chain));
      wireCoin(n, i, revealed);
    }

    row.dataset.chains = JSON.stringify(chains);
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

  function tagText(kind, chain) {
    if (chain) return (chain.same ? '⛓ = ' : '⛓ ≠ ') + (chain.partner + 1);
    if (kind === 'up') return 'face-up';
    if (kind === 'down') return 'dead';
    if (kind === 'cw') return '↻ 50%';
    if (kind === 'ccw') return '↺ 50%';
    return '50%';
  }

  function coinAria(i, revealed, info, chain) {
    if (!revealed) return 'Coin ' + (i + 1) + ', not turned over yet';
    var what = {
      up: 'face-up, a sure point', down: 'skull side up, dead',
      cw: 'spinning clockwise, even odds', ccw: 'spinning counter-clockwise, even odds',
      murky: 'chained, even odds'
    }[info.kind];
    return 'Coin ' + (i + 1) + ', ' + what + (chain
      ? ', chained to coin ' + (chain.partner + 1) + (chain.same ? ', lands the same' : ', lands opposite')
      : '');
  }

  function wireCoin(n, i, revealed) {
    var live = game.phase === 'gates' && selectedCard && revealed;
    n.slot.disabled = !live;
    n.slot.classList.toggle('pickable', !!live);
    n.slot.classList.toggle('picked', pickedCoins.indexOf(i) !== -1);
    n.slot.classList.toggle('hinted', !!(hint && hint.targets.indexOf(i) !== -1));

    n.slot.onclick = live ? function () { pickCoin(i); } : null;
    n.slot.onmouseenter = live ? function () {
      var card = E.CARDS[selectedCard];
      var targets = pickedCoins.concat([i]);
      if (targets.length !== card.arity) return;
      if (card.arity === 2 && targets[0] === targets[1]) return;
      var pv = E.previewCard(game.players[game.actor].board, selectedCard, targets, game.coins);
      if (!pv) return;
      var swing = pv.delta > 0.001 ? ' <span class="hot">+' + pv.delta.toFixed(1) + '</span>'
        : pv.delta < -0.001 ? ' ' + pv.delta.toFixed(1) : '';
      $('#read').innerHTML = esc(card.name) + ' → ' + esc(pv.text) + swing;
    } : null;
    n.slot.onmouseleave = live ? function () { renderRead(); } : null;
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
    if (res.ok) Sound.cast();
    render();
    if (!res.ok) $('#read').textContent = res.why;
  }

  function drawChains() {
    var svg = $('#chain-layer');
    if (!svg || !game) return;
    svg.innerHTML = '';
    var row = $('#coin-row');
    if (!row || !row.dataset.chains) return;
    var chains = JSON.parse(row.dataset.chains);
    var wrap = svg.parentNode.getBoundingClientRect();
    if (!wrap.width) return;
    svg.setAttribute('viewBox', '0 0 ' + wrap.width + ' ' + wrap.height);

    chains.forEach(function (ch) {
      if (ch.a >= game.revealed || ch.b >= game.revealed) return;
      var A = row.children[ch.a], B = row.children[ch.b];
      if (!A || !B) return;
      var ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
      var x1 = ra.left + ra.width / 2 - wrap.left;
      var x2 = rb.left + rb.width / 2 - wrap.left;
      var y = ra.top + ra.height * 0.14 - wrap.top;
      var lift = Math.min(44, 16 + Math.abs(x2 - x1) * 0.14);
      var stroke = ch.same ? '#63a98c' : '#9d6fa8';

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M' + x1 + ' ' + y + ' Q' + ((x1 + x2) / 2) + ' ' + (y - lift) + ' ' + x2 + ' ' + y);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', stroke);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-dasharray', '6 5');
      path.style.filter = 'drop-shadow(0 0 5px ' + stroke + ')';
      svg.appendChild(path);
    });
  }

  /* ---------------------------------------------------------------- seats -- */

  /**
   * Seats sit on an ellipse with whoever is acting placed at the bottom, the
   * way an online poker room always seats you nearest the camera. When the
   * turn passes, the whole table rotates — the CSS transition does the work.
   */
  function renderTableSeats() {
    var box = $('#seats');
    var order = game.players.map(function (p) { return p.seat; });
    var hero = game.actor >= 0 ? game.actor : order[0];
    var n = order.length;
    var start = order.indexOf(hero);
    var others = n - 1;

    game.players.forEach(function (p) {
      var node = seatNodes[p.seat];
      if (!node) {
        node = buildSeat(p);
        seatNodes[p.seat] = node;
        box.appendChild(node.root);
      }

      var idx = (order.indexOf(p.seat) - start + n) % n;
      var isHero = idx === 0;

      // The player to act comes off the felt and onto the rail in front of
      // them; the rest fan out across the far side of the table.
      node.root.hidden = isHero;
      if (!isHero) {
        var t = others === 1 ? 0.5 : (idx - 1) / (others - 1);
        if (narrowTable()) {
          // Not enough felt for an orbit — line them up along the top edge.
          node.root.style.left = (16 + t * 68).toFixed(2) + '%';
          node.root.style.top = '13%';
        } else {
          var rad = (194 + t * 152) * Math.PI / 180;
          node.root.style.left = (50 + 40 * Math.cos(rad)).toFixed(2) + '%';
          node.root.style.top = (50 + 38 * Math.sin(rad)).toFixed(2) + '%';
        }
      }
      paintSeat(node, p);
    });

    paintSeat(heroNode(), game.players[hero], true);
  }

  function paintSeat(node, p, isHero) {
    node.root.classList.toggle('acting', p.seat === game.actor);
    node.root.classList.toggle('folded', p.folded && !p.out);
    node.root.classList.toggle('out', p.out);
    node.stack.textContent = p.out ? 'out' : String(p.points);
    node.bet.textContent = p.bet > 0 ? p.bet + ' in' : (p.folded && !p.out ? 'folded' : '');
    if (isHero) {
      node.name.textContent = p.name;
      node.sig.innerHTML = Art.sigil(p.sigil);
    }
    var flag = p.out ? '' : p.allIn ? 'all in' : p.seat === game.dealer ? 'dealer' : '';
    node.flag.textContent = flag;
    node.flag.hidden = !flag;
    node.flag.className = 'seat-flag' + (p.allIn && !p.out ? ' allin' : '');
  }

  function narrowTable() { return global.innerWidth <= 620; }

  var heroCache = null;
  function heroNode() {
    if (heroCache) return heroCache;
    var root = $('#hero');
    root.innerHTML = '';
    var sig = el('span', 'hero-sigil');
    var name = el('span', 'hero-name', '');
    var stack = el('span', 'seat-stack', '0');
    var bet = el('span', 'seat-bet', '');
    var flag = el('span', 'seat-flag', '');
    flag.hidden = true;
    root.appendChild(sig); root.appendChild(name);
    root.appendChild(stack); root.appendChild(bet); root.appendChild(flag);
    heroCache = { root: root, sig: sig, name: name, stack: stack, bet: bet, flag: flag };
    return heroCache;
  }

  function buildSeat(p) {
    var root = el('div', 'seat');
    var head = el('div', 'seat-head');
    head.innerHTML = Art.sigil(p.sigil);
    head.appendChild(el('span', 'seat-name', p.name));
    var stack = el('div', 'seat-stack', '0');
    var bet = el('div', 'seat-bet', '');
    var flag = el('span', 'seat-flag', '');
    flag.hidden = true;
    root.appendChild(head); root.appendChild(stack); root.appendChild(bet); root.appendChild(flag);
    return { root: root, stack: stack, bet: bet, flag: flag };
  }

  /* ------------------------------------------------------------------ pot -- */

  function renderPot() {
    var target = game.potTotal();
    var node = $('#pot-value');
    if (potTimer) { clearInterval(potTimer); potTimer = null; }
    if (REDUCED || Math.abs(target - potShown) < 2) {
      potShown = target;
      node.textContent = target;
    } else {
      // Count the pot up rather than snapping it. Money should feel like it moves.
      var step = Math.max(1, Math.round(Math.abs(target - potShown) / 12));
      potTimer = setInterval(function () {
        potShown += potShown < target ? step : -step;
        if ((step > 0 && Math.abs(target - potShown) <= step)) potShown = target;
        node.textContent = potShown;
        if (potShown === target) { clearInterval(potTimer); potTimer = null; }
      }, 26);
    }

    var strip = $('#pot-candy');
    strip.innerHTML = '';
    var bd = E.toCandy(target);
    E.CANDY.forEach(function (c) {
      var count = Math.min(bd[c.key], 6);
      for (var i = 0; i < count; i++) {
        var w = el('span', 'candy-' + c.key);
        w.innerHTML = Art.candy(c.key);
        strip.appendChild(w);
      }
    });
  }

  /* ------------------------------------------------------- read + prompt -- */

  function renderRead() {
    var node = $('#read');
    if (hint) { node.innerHTML = '<span class="hot">' + esc(hint.label) + '</span>'; return; }
    if (game.revealed === 0) { node.textContent = 'No coins down yet — this is pure nerve'; return; }
    var board = activeBoard();
    var sure = 0, i;
    for (i = 0; i < game.revealed; i++) if (Q.readCoin(board, i).kind === 'up') sure++;
    var chains = Q.findChains(board).filter(function (c) {
      return c.a < game.revealed && c.b < game.revealed;
    });
    var text = sure + ' locked · ' + Q.expectedScore(board, game.revealed).toFixed(1) +
      ' expected of ' + game.revealed;
    if (chains.length) {
      text += ' · ' + chains.map(function (c) {
        return (c.a + 1) + ' and ' + (c.b + 1) + (c.same ? ' land together' : ' land opposite');
      }).join('; ');
    }
    node.textContent = text;
  }

  function renderPrompt() {
    var node = $('#prompt');
    if (game.phase === 'gates') {
      node.innerHTML = '<em>' + esc(game.players[game.actor].name) +
        '</em> — put cards on your coins, then end your turn.';
    } else if (game.phase === 'betting') {
      var owe = game.toCall(game.actor);
      node.innerHTML = '<em>' + esc(game.players[game.actor].name) + '</em> — ' +
        (owe > 0 ? 'call ' + owe + ', raise, or fold.' : 'check, bet, or fold.');
    } else {
      node.textContent = game.message;
    }
  }

  function renderLedger() {
    var recent = game.log.slice(-3).reverse();
    $('#ledger').innerHTML = recent.length
      ? recent.map(function (line, i) { return i === 0 ? '<b>' + esc(line) + '</b>' : esc(line); }).join('  ·  ')
      : '';
  }

  /* ----------------------------------------------------------------- tray -- */

  function renderTray() {
    var tray = $('#tray-main');
    tray.innerHTML = '';
    if (game.phase === 'betting') renderBetting(tray);
    else if (game.phase === 'gates') renderGates(tray);
  }

  function renderBetting(tray) {
    var seat = game.actor, p = game.players[seat];
    var owe = game.toCall(seat);
    var maxTo = p.bet + p.points;

    tray.appendChild(buildFaceDown(seat));

    var row = el('div', 'row');
    var fold = el('button', 'btn danger', 'Fold');
    fold.type = 'button';
    fold.onclick = function () { Sound.fold(); game.fold(); afterBet(); };
    row.appendChild(fold);

    var call = el('button', 'btn primary',
      owe === 0 ? 'Check' : owe >= p.points ? 'Call all in · ' + owe : 'Call ' + owe);
    call.type = 'button';
    call.onclick = function () { if (owe > 0) Sound.chip(); game.call(); afterBet(); };
    row.appendChild(call);
    tray.appendChild(row);

    if (maxTo > game.currentBet) {
      var minTo = game.minRaiseTo(seat);
      var betRow = el('div', 'bet-row');
      var slider = document.createElement('input');
      slider.type = 'range';
      slider.min = String(minTo); slider.max = String(maxTo); slider.step = '1';
      slider.value = String(Math.min(maxTo, minTo));
      slider.setAttribute('aria-label', 'Raise to');

      var amt = el('span', 'bet-amt', slider.value);
      slider.oninput = function () { amt.textContent = slider.value; };

      var go = el('button', 'btn', 'Raise');
      go.type = 'button';
      go.onclick = function () {
        var r = game.raiseTo(parseInt(slider.value, 10));
        if (!r.ok) { $('#prompt').textContent = r.why; return; }
        Sound.chip(); afterBet();
      };
      var shove = el('button', 'btn', 'All in');
      shove.type = 'button';
      shove.onclick = function () { game.raiseTo(maxTo); Sound.chip(); afterBet(); };

      betRow.appendChild(amt); betRow.appendChild(slider);
      betRow.appendChild(go); betRow.appendChild(shove);
      tray.appendChild(betRow);
    }
  }

  function buildFaceDown(seat) {
    var wrap = el('div', 'facedown');
    var btn = el('button', 'facedown-btn');
    btn.type = 'button';
    var cards = el('div', 'fd-cards');
    for (var i = 0; i < game.handSize(seat); i++) cards.appendChild(el('div', 'fd-card'));
    btn.appendChild(cards);
    btn.appendChild(el('span', 'fd-label', 'Your hand — look'));
    btn.setAttribute('aria-label', 'Look at your cards');
    btn.onclick = function () { openPeek(seat); };
    wrap.appendChild(btn);
    return wrap;
  }

  function afterBet() {
    selectedCard = null; pickedCoins = []; hint = null;
    sync();
  }

  function renderGates(tray) {
    var seat = game.actor, p = game.players[seat];

    var strip = el('div', 'hand-strip');
    E.CARD_IDS.forEach(function (id) {
      var count = p.hand[id] || 0;
      strip.appendChild(buildCard(id, count, {
        selected: selectedCard === id,
        hinted: !!(hint && hint.card === id),
        onPick: function () {
          selectedCard = selectedCard === id ? null : id;
          pickedCoins = [];
          hint = null;
          if (selectedCard) Sound.card();
          render();
        }
      }));
    });
    tray.appendChild(strip);

    var row = el('div', 'row');
    var hintBtn = el('button', 'btn ghost', 'Hint');
    hintBtn.type = 'button';
    hintBtn.disabled = game.handSize(seat) === 0;
    hintBtn.onclick = function () {
      var best = game.bestPlay(seat);
      if (!best || best.delta <= 0.001) {
        hint = null;
        $('#read').textContent = 'Nothing left that improves your odds — end your turn';
        return;
      }
      hint = {
        card: best.card, targets: best.targets,
        label: E.CARDS[best.card].name + ' on ' +
          best.targets.map(function (t) { return 'coin ' + (t + 1); }).join(' → ') +
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
      Sound.card();
      game.endTurn();
      sync();
    };
    row.appendChild(end);
    tray.appendChild(row);
  }

  /**
   * A card that leans toward the cursor. Costs almost nothing and is most of
   * the reason a card game feels like objects rather than buttons.
   */
  function buildCard(id, count, opts) {
    var card = E.CARDS[id];
    var node = el('button', 'card' +
      (opts.selected ? ' selected' : '') + (opts.hinted ? ' hinted' : ''));
    node.type = 'button';
    node.disabled = count === 0 && !opts.static;
    node.innerHTML =
      '<span class="card-name">' + card.name + '</span>' +
      Art.cardArt(id) +
      '<span class="card-blurb">' + card.blurb + '</span>' +
      (nerd ? '<span class="card-gate">' + card.gate + '</span>' : '');
    if (count > 1) {
      var badge = el('span', 'card-count', String(count));
      node.appendChild(badge);
    }
    if (opts.onPick) node.onclick = opts.onPick;

    if (!REDUCED) {
      node.onpointermove = function (ev) {
        var r = node.getBoundingClientRect();
        var px = (ev.clientX - r.left) / r.width - 0.5;
        var py = (ev.clientY - r.top) / r.height - 0.5;
        node.style.transform =
          'translateY(-10px) rotateX(' + (-py * 13).toFixed(2) + 'deg) rotateY(' +
          (px * 15).toFixed(2) + 'deg)';
      };
      node.onpointerleave = function () { node.style.transform = ''; };
    }
    return node;
  }

  /* -------------------------------------------------------------- curtain -- */

  function openCurtain(seat, done) {
    var p = game.players[seat];
    $('#curtain-sigil').innerHTML = Art.sigil(p.sigil);
    $('#curtain-name').textContent = p.name;
    show($('#curtain'));
    $('#curtain-go').onclick = function () { hide($('#curtain')); Sound.card(); done(); };
    $('#curtain-go').focus();
  }

  function openPeek(seat) {
    var p = game.players[seat];
    var strip = $('#peek-hand');
    strip.innerHTML = '';
    E.CARD_IDS.forEach(function (id) {
      var count = p.hand[id] || 0;
      if (!count) return;
      strip.appendChild(buildCard(id, count, { static: true }));
    });
    $('#peek-sub').textContent = 'Held by ' + p.name + '. Hides shortly.';
    show($('#peek'));
    Sound.card();
    clearTimeout(peekTimer);
    peekTimer = setTimeout(closePeek, 7000);
  }

  function closePeek() { clearTimeout(peekTimer); hide($('#peek')); }

  /* ------------------------------------------------------------- showdown -- */

  var sdTimers = [];

  function openShowdown() {
    var body = $('#showdown-body');
    body.innerHTML = '';
    $('#sd-summary').textContent = '';
    sdTimers.forEach(clearTimeout);
    sdTimers = [];

    $('#showdown-title').textContent = game.results.uncontested ? 'Everyone folded' : 'Showdown';
    $('#showdown-next').hidden = true;
    $('#showdown-skip').hidden = false;

    var contenders = game.players.filter(function (p) { return p.score !== null; });
    if (!contenders.length) { show($('#showdown')); finishShowdown(); return; }

    var best = Math.max.apply(null, contenders.map(function (p) { return p.score; }));
    var rows = [];
    var delay = 0, step = REDUCED ? 0 : 260;

    contenders.forEach(function (p) {
      var sec = el('div', 'sd-player');
      var head = el('div', 'sd-head');
      head.innerHTML = Art.sigil(p.sigil);
      head.appendChild(el('span', 'nm', p.name));
      sec.appendChild(head);

      var coins = el('div', 'sd-coins');
      var nodes = [];
      p.bits.forEach(function (bit) {
        var c = el('div', 'sd-coin ' + (bit ? 'hit' : 'miss'));
        c.innerHTML = bit ? Art.coinFace() : Art.coinSkull();
        coins.appendChild(c);
        nodes.push({ node: c, bit: bit });
      });
      sec.appendChild(coins);

      var rank = el('div', 'rank' + (p.score === 5 ? ' bloodmoon' : ''), '');
      sec.appendChild(rank);
      body.appendChild(sec);
      rows.push({ p: p, sec: sec, rank: rank, nodes: nodes });

      nodes.forEach(function (c) {
        delay += step;
        sdTimers.push(setTimeout(function () {
          c.node.classList.add('shown');
          if (c.bit) Sound.coin(true); else Sound.thud();
        }, delay));
      });
      delay += 140;
      sdTimers.push(setTimeout(function () {
        rank.innerHTML = E.rankName(p.score) + ' <span class="n">' + p.score + '</span>';
        if (p.score === best) sec.classList.add('leader');
        if (p.score === 5) Sound.bloodMoon();
      }, delay));
    });

    show($('#showdown'));
    delay += 380;
    sdTimers.push(setTimeout(finishShowdown, delay));

    $('#showdown-skip').onclick = function () {
      sdTimers.forEach(clearTimeout);
      sdTimers = [];
      rows.forEach(function (r) {
        r.nodes.forEach(function (c) { c.node.classList.add('shown'); });
        r.rank.innerHTML = E.rankName(r.p.score) + ' <span class="n">' + r.p.score + '</span>';
        if (r.p.score === best) r.sec.classList.add('leader');
      });
      finishShowdown();
    };
  }

  function finishShowdown() {
    $('#sd-summary').textContent = game.results.summary;
    Sound.win();
    $('#showdown-skip').hidden = true;
    var next = $('#showdown-next');
    next.hidden = false;
    next.textContent = game.gameOver() ? 'Settle up' : 'Next hand';
    next.onclick = function () {
      hide($('#showdown'));
      if (game.gameOver()) { Sound.bust(); openBank(); return; }
      curtainedSeat = -1;
      selectedCard = null; pickedCoins = []; hint = null;
      potShown = 0;
      game.nextHand();
      Sound.card();
      sync();
    };
    next.focus();
  }

  /* ----------------------------------------------------------------- bank -- */

  function openBank() {
    var body = $('#bank-body');
    body.innerHTML = '';
    var sorted = game.players.slice().sort(function (a, b) { return b.points - a.points; });
    var payouts = E.settlePool(sorted);

    sorted.forEach(function (p, i) {
      var row = el('div', 'bank-row');
      var sig = el('span');
      sig.innerHTML = Art.sigil(p.sigil);
      row.appendChild(sig);

      var mid = el('div');
      mid.appendChild(el('div', 'bank-name', p.name + (p.points > 0 && i === 0 ? ' — takes the table' : '')));
      var candy = el('div', 'bank-candy');
      var any = false;
      E.CANDY.forEach(function (c) {
        if (!payouts[i][c.key]) return;
        any = true;
        var s = el('span');
        s.innerHTML = Art.candy(c.key) + '<span>' + payouts[i][c.key] + '</span>';
        s.className = 'candy-' + c.key;
        candy.appendChild(s);
      });
      if (!any) candy.appendChild(el('span', '', 'nothing'));
      mid.appendChild(candy);
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

  /* ---------------------------------------------------------------- rules -- */

  function openRules() {
    var coinRow = function (cls, art, name, text) {
      return '<tr><td><span class="chip ' + cls + '">' + art + '</span>' + name + '</td><td>' + text + '</td></tr>';
    };
    $('#rules-body').innerHTML =
      '<div><h3>The point</h3><p>Five cursed coins lie on the table. At the end of the hand they all ' +
      'land. Every coin showing its <b>face</b> is one point, and the most points takes the pot. ' +
      'You bet candy between each coin, exactly as you would at poker.</p></div>' +

      '<div><h3>Reading a coin</h3><table class="rules-table">' +
      coinRow('up', Art.coinFace(), 'Face-up', 'A point, banked. Only your own card can spoil it.') +
      coinRow('down', Art.coinSkull(), 'Skull', 'Dead. Worth nothing unless you turn it.') +
      '<tr><td>↻ &nbsp;Spinning</td><td>Even money. Which way it turns decides which card can catch it.</td></tr>' +
      '<tr><td>⛓ &nbsp;Chained</td><td>Two coins bound together. They always land alike — or always opposed.</td></tr>' +
      '</table></div>' +

      '<div><h3>Your cards</h3><table class="rules-table">' +
      E.CARD_IDS.map(function (id) {
        var c = E.CARDS[id];
        return '<tr><td><span class="rules-mini">' + Art.cardArt(id) + '<b>' + c.name + '</b></span></td>' +
          '<td>' + c.blurb + '</td></tr>';
      }).join('') +
      '</table><p>Three each, dealt face down, played after the final bet. Flip, Haunt and Bind undo ' +
      'themselves — play one twice and nothing has happened. <b>Summon does not.</b> It walks a coin ' +
      'round a loop of four — dead, ↻, face-up, ↺ — so a second Summon throws away the point you just won.</p></div>' +

      '<div><h3>The candy</h3><table class="rules-table">' +
      E.CANDY.map(function (c) {
        return '<tr><td><span class="rules-mini candy-' + c.key + '">' + Art.candy(c.key) +
          '</span> ' + c.name + '</td><td class="val">' + c.value + '</td></tr>';
      }).join('') +
      '</table><p>Two hundred points each to start. Blinds double every six hands, so the night ends ' +
      'before the candy does. Keep score here; move the sweets for real.</p></div>' +

      '<div><h3>Hand ranks</h3><p>' +
      E.RANKS.map(function (r, i) { return i + ' → <b>' + r + '</b>'; }).join(' &nbsp;·&nbsp; ') +
      '</p></div>' +

      '<div><h3>Underneath</h3><p>The coins are qubits and the cards are quantum gates — Flip is X, ' +
      'Haunt is Hadamard, Summon is ZH, Bind is CNOT. Spinning is superposition; chained is ' +
      'entanglement. Press <b>Ψ</b> to see the real states. You need none of it to win.</p></div>' +

      '<div><h3>Rather be shown?</h3><p id="rules-watch-line">' +
      'There is a minute-and-a-half walk-through of all of this.</p></div>';

    var watch = el('button', 'btn');
    watch.type = 'button';
    watch.textContent = 'Watch the rules';
    watch.onclick = function () { hide($('#rules')); openFilm(); };
    $('#rules-watch-line').appendChild(document.createElement('br'));
    $('#rules-watch-line').appendChild(watch);

    show($('#rules'));
    $('#rules-close').onclick = function () { hide($('#rules')); };
  }

  /* ----------------------------------------------------------------- film -- */

  /**
   * The rules, as a short film. Watching is the default way in; the hands-on
   * practice hand is offered at the end for anyone who wants to try it before
   * sitting down with other people's candy.
   */
  function openFilm() {
    var midGame = !!game;
    global.Film.open({
      onDone: function (next) {
        store('tutorial', '1');
        if (midGame) return;              // already at a table; just go back to it
        if (next === 'practice') startTutorial();
        else if (next === true) startGame();
      }
    });
  }

  /* ------------------------------------------------------------- practice -- */

  var tut = null;

  var TUT_STEPS = [
    {
      title: 'The coins',
      text: 'Two cursed coins. The left one landed <b>face-up</b> — a point, already yours. ' +
            'The right one is still <b>spinning</b>: a coin flip, worth half a point on average.',
      next: 'Go on'
    },
    {
      title: 'What you want',
      text: 'Coins face-up when the spinning stops. A spinning coin is not bad luck — it is the ' +
            '<b>opening</b>, because the right card can catch it mid-turn.',
      next: 'Show me'
    },
    {
      title: 'Play a card',
      text: 'You hold a <b>Summon</b>. It catches a coin turning <b>clockwise ↻</b> and pins it face-up. ' +
            'Take the card, then tap the spinning coin.',
      interactive: true
    },
    {
      title: 'Both face-up',
      text: 'Two coins, two points. That is the whole game — the rest is betting candy on whether ' +
            'your coins will beat everyone else&rsquo;s.',
      next: 'Deal me in'
    }
  ];

  function startTutorial() {
    tut = { step: 0, state: new Q.QState(2), armed: false };
    tut.state.x(0);
    tut.state.h(1);
    show($('#tutorial'));
    renderTutorial();
    $('#tut-quit').onclick = function () { hide($('#tutorial')); tut = null; };
  }

  function renderTutorial() {
    var step = TUT_STEPS[tut.step];
    $('#tut-step').textContent = 'Step ' + (tut.step + 1) + ' of ' + TUT_STEPS.length;
    $('#tut-title').textContent = step.title;
    $('#tut-text').innerHTML = step.text;

    var row = $('#tut-coins');
    row.innerHTML = '';
    for (var i = 0; i < 2; i++) {
      (function (idx) {
        var info = Q.readCoin(tut.state, idx);
        var slot = el('button', 'coin-slot' + (step.interactive && tut.armed ? ' pickable' : ''));
        slot.type = 'button';
        slot.disabled = !(step.interactive && tut.armed);

        var shell = el('div', 'coin-shell');
        var coin = el('div', 'coin');
        coin.dataset.kind = info.kind;
        var d3 = el('div', 'coin-3d');
        var edge = el('div', 'coin-edge');
        var f = el('div', 'coin-face coin-front'); f.innerHTML = Art.coinFace();
        var b = el('div', 'coin-face coin-back'); b.innerHTML = Art.coinSkull();
        d3.appendChild(edge); d3.appendChild(f); d3.appendChild(b);
        coin.appendChild(d3); shell.appendChild(coin);

        var meta = el('div', 'coin-meta');
        meta.appendChild(el('span', 'coin-tag ' + tagClass(info.kind, null), tagText(info.kind, null)));
        slot.appendChild(shell); slot.appendChild(meta);

        slot.onclick = function () {
          if (idx !== 1) {
            $('#tut-text').innerHTML = 'That one is already face-up. Try the <b>spinning</b> coin.';
            return;
          }
          tut.state.zh(1);
          tut.armed = false;
          tut.step = 3;
          Sound.cast();
          renderTutorial();
          setTimeout(function () { Sound.coin(true); }, 320);
        };
        row.appendChild(slot);
      })(i);
    }

    var hand = $('#tut-hand');
    hand.innerHTML = '';
    if (step.interactive) {
      hand.appendChild(buildCard('SUMMON', 1, {
        selected: tut.armed, static: true,
        onPick: function () { tut.armed = !tut.armed; if (tut.armed) Sound.card(); renderTutorial(); }
      }));
    }

    var next = $('#tut-next');
    next.hidden = !!step.interactive;
    next.textContent = step.next || 'Next';
    next.onclick = function () {
      if (tut.step >= TUT_STEPS.length - 1) {
        hide($('#tutorial'));
        tut = null;
        store('tutorial', '1');
        startGame();
        return;
      }
      tut.step++;
      renderTutorial();
    };
  }

  /* ----------------------------------------------------------------- boot -- */

  var SPEAKER_ON = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  var SPEAKER_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';

  function paintSoundBtn() {
    var b = $('#btn-sound');
    b.innerHTML = Sound.isOn() ? SPEAKER_ON : SPEAKER_OFF;
    b.setAttribute('aria-pressed', Sound.isOn() ? 'true' : 'false');
    b.title = Sound.isOn() ? 'Sound on' : 'Sound off';
  }

  function boot() {
    initSetup();
    paintSoundBtn();

    $('#btn-sound').onclick = function () { Sound.toggle(); paintSoundBtn(); };
    $('#btn-nerd').onclick = function () {
      nerd = !nerd;
      store('nerd', nerd ? '1' : '0');
      render();
    };
    $('#btn-rules').onclick = openRules;
    $('#rules-close').onclick = function () { hide($('#rules')); };
    global.Film.boot();
    $('#peek-close').onclick = closePeek;

    global.addEventListener('resize', function () {
      if (game) render(); else requestAnimationFrame(drawChains);
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      ['#peek', '#rules', '#bank'].forEach(function (s) { hide($(s)); });
    });
  }

  global.UI = { boot: boot, sync: sync, render: render, get game() { return game; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
