/*
 * Quantum Hold'em — ui.js
 * Screens and interaction. The engine owns the rules; this file only shows
 * them. Coins and seats are built once and updated in place so that flips
 * and chip movements can animate.
 */
(function (root) {
  'use strict';

  const Q = root.Q, E = root.Engine, Bots = root.Bots, Art = root.Art, Sound = root.Sound;

  /* ------------------------------------------------------------- helpers -- */

  const $ = (sel) => document.querySelector(sel);
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function btn(cls, text, onClick) {
    const b = el('button', 'btn ' + cls, text);
    b.type = 'button';
    b.onclick = onClick;
    return b;
  }
  const show = (n) => { n.hidden = false; };
  const hide = (n) => { n.hidden = true; };
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const REDUCED = root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load(key, fallback) {
    try { const v = localStorage.getItem('qh_' + key); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem('qh_' + key, JSON.stringify(value)); } catch (e) { /* private window */ }
  }

  let toastTimer = null;
  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    show(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hide(t), 2600);
  }

  /* --------------------------------------------------------------- state -- */

  let game = null;
  let mode = null;            // 'daily' | 'quick' | 'hot'
  let dailyPractice = false;  // replaying a daily that is already recorded
  let selectedCard = null;    // card id being played
  let selectedIdx = -1;       // which copy in the hand, so twins do not both light up
  let picked = [];
  let hint = null;
  let nerd = load('nerd', false);
  let curtained = -1;
  let botTimer = null;
  let coinNodes = [];
  let seatNodes = {};
  let potShown = 0, potTimer = null;
  let peekTimer = null, peeking = false;
  let challengeSeed = null;

  const HOT_NAMES = ['Ada', 'Max', 'Ines', 'Theo', 'Nova'];

  /* ---------------------------------------------------------------- daily -- */

  const EPOCH = Date.UTC(2026, 8, 1); // 1 Sep 2026 is Daily #1

  function dailyNumber() {
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.floor((today - EPOCH) / 86400000) + 1;
  }
  const dailySeed = (n) => Q.mix(n, 0xDA117);

  /* ---------------------------------------------------------------- stats -- */

  function stats() {
    return load('stats', { games: 0, hands: 0, handsWon: 0, bestStack: 0, coherences: 0, streak: 0, lastDaily: 0, daily: {} });
  }

  function recordHand() {
    if (mode === 'hot') return;
    const s = stats(), me = game.players[0];
    s.hands++;
    if (me.won > 0) s.handsWon++;
    if (me.score === 5) s.coherences++;
    s.bestStack = Math.max(s.bestStack, me.chips);
    save('stats', s);
  }

  function recordGame() {
    if (mode === 'hot') return;
    const s = stats();
    s.games++;
    if (mode === 'daily' && !dailyPractice) {
      const n = dailyNumber();
      s.daily[n] = dailySummary();
      s.streak = s.lastDaily === n - 1 ? s.streak + 1 : 1;
      s.lastDaily = n;
    }
    save('stats', s);
  }

  function dailySummary() {
    const me = game.players[0];
    const place = game.standings().findIndex((p) => p.seat === 0) + 1;
    const grid = game.history.map((h) => h.winners.includes(0) ? (h.score === 5 ? '⭐' : '🟧') : '⬛').join('');
    return { chips: me.chips, place, won: me.handsWon, hands: game.history.length, grid };
  }

  function renderStats() {
    const s = stats();
    const box = $('#stats');
    box.innerHTML = '';
    if (!s.games && !s.hands) { hide(box); return; }
    show(box);
    const cells = [
      ['Games', s.games], ['Hands won', s.hands ? Math.round(100 * s.handsWon / s.hands) + '%' : '–'],
      ['Best stack', fmt(s.bestStack)], ['Daily streak', s.streak], ['Coherences', s.coherences]
    ];
    cells.forEach(([k, v]) => {
      const c = el('div', 'stat');
      c.appendChild(el('b', 'mono', String(v)));
      c.appendChild(el('span', '', k));
      box.appendChild(c);
    });
  }

  /* ----------------------------------------------------------------- home -- */

  let quickBots = load('quickBots', 3);
  let hotSeats = load('hotSeats', null) || [0, 1, 2].map((i) => HOT_NAMES[i]);

  function initHome() {
    root.Explainer.mount($('#explainer'));

    // A challenge link (?seed=…&bots=…) sits you straight down at that deal.
    const params = new URLSearchParams(location.search);
    if (params.get('seed') && !params.has('test')) {
      challengeSeed = parseInt(params.get('seed'), 10) >>> 0;
      if (params.get('bots')) quickBots = Math.max(1, Math.min(4, parseInt(params.get('bots'), 10) || 3));
      history.replaceState(null, '', location.pathname);
      setTimeout(startQuick, 0);
    }

    $('#quick-name').value = load('name', '');
    $('#quick-name').oninput = () => save('name', $('#quick-name').value.trim());
    $('#quick-less').onclick = () => { quickBots = Math.max(1, quickBots - 1); paintQuick(); };
    $('#quick-more').onclick = () => { quickBots = Math.min(4, quickBots + 1); paintQuick(); };
    $('#btn-quick').onclick = startQuick;
    $('#btn-daily').onclick = startDaily;
    $('#hot-less').onclick = () => { if (hotSeats.length > 2) { hotSeats.pop(); paintHot(); } };
    $('#hot-more').onclick = () => { if (hotSeats.length < 5) { hotSeats.push(HOT_NAMES[hotSeats.length]); paintHot(); } };
    $('#btn-hot').onclick = startHot;
    $('#home-rules').onclick = openRules;

    paintQuick(); paintHot(); paintDaily(); renderStats();
  }

  function paintQuick() {
    $('#quick-bots').textContent = quickBots;
    save('quickBots', quickBots);
  }

  function paintHot() {
    const list = $('#hot-seats');
    list.innerHTML = '';
    hotSeats.forEach((name, i) => {
      const row = el('label', 'seat-row');
      row.innerHTML = Art.avatar(i + 1);
      const input = document.createElement('input');
      input.value = name; input.maxLength = 12;
      input.setAttribute('aria-label', 'Name for player ' + (i + 1));
      input.oninput = () => { hotSeats[i] = input.value; save('hotSeats', hotSeats); };
      row.appendChild(input);
      list.appendChild(row);
    });
    $('#hot-count').textContent = hotSeats.length + ' players';
    save('hotSeats', hotSeats);
  }

  function paintDaily() {
    const n = dailyNumber();
    $('#daily-no').textContent = '#' + n;
    const done = stats().daily[n];
    const status = $('#daily-status');
    if (done) {
      status.innerHTML = 'Done today: <b class="mono">' + fmt(done.chips) + '</b> chips, ' + ordinal(done.place) +
        ' place. <span class="grid">' + done.grid + '</span>';
      $('#btn-daily').textContent = 'Play it again (practice)';
    } else {
      status.textContent = 'Not played yet. Resets at midnight UTC.';
      $('#btn-daily').textContent = 'Play today’s deal';
    }
  }

  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function yourName() { return ($('#quick-name').value || '').trim() || 'You'; }

  function startDaily() {
    const n = dailyNumber();
    dailyPractice = !!stats().daily[n];
    const bots = Bots.PERSONAS.slice(0, 3);
    startGame('daily', {
      seats: [{ name: yourName(), avatar: 0 }].concat(bots.map((b) => ({ name: b.name, avatar: b.avatar, bot: b }))),
      seed: dailySeed(n), maxHands: 10
    });
  }

  function startQuick() {
    const bots = Bots.PERSONAS.slice(0, quickBots);
    startGame('quick', {
      seats: [{ name: yourName(), avatar: 0 }].concat(bots.map((b) => ({ name: b.name, avatar: b.avatar, bot: b }))),
      seed: challengeSeed
    });
    challengeSeed = null;
  }

  function startHot() {
    startGame('hot', {
      seats: hotSeats.map((name, i) => ({ name: name.trim() || 'Player ' + (i + 1), avatar: i + 1 }))
    });
  }

  /* ------------------------------------------------------------ the game -- */

  function startGame(m, opts) {
    mode = m;
    game = new E.Game(opts);
    curtained = -1; selectedCard = null; selectedIdx = -1; picked = []; hint = null;
    coinNodes = []; seatNodes = {}; potShown = 0;
    $('#seats').innerHTML = ''; $('#coins').innerHTML = '';
    hide($('#home')); show($('#table'));
    window.scrollTo(0, 0);
    Sound.card();
    sync();
  }

  function goHome() {
    clearTimeout(botTimer);
    game = null;
    ['#showdown', '#results', '#curtain', '#rules'].forEach((s) => hide($(s)));
    hide($('#table')); show($('#home'));
    paintDaily(); renderStats();
  }

  /** The seat whose cards and board the bottom of the screen shows. */
  function focusSeat() {
    if (mode !== 'hot') return 0;
    const p = game.current();
    if (p && !p.bot) return p.seat;
    return curtained >= 0 ? curtained : game.liveSeats()[0];
  }

  function sync() {
    if (!game) return;
    clearTimeout(botTimer);
    if (game.phase === 'over') { render(); openShowdown(); return; }
    const p = game.current();
    if (!p) { render(); return; }
    if (p.bot) {
      render();
      const humanIn = game.humans().some((h) => !h.folded && !h.out && !h.allIn);
      const delay = REDUCED ? 60 : humanIn ? (game.phase === 'gates' ? 900 : 550 + Math.random() * 500) : 220;
      botTimer = setTimeout(() => { Bots.step(game); Sound.chip(); sync(); }, delay);
      return;
    }
    if (mode === 'hot' && game.phase === 'gates' && curtained !== p.seat) {
      render();
      openCurtain(p, () => { curtained = p.seat; sync(); });
      return;
    }
    render();
  }

  function render() {
    if (!game) return;
    renderTop(); renderSeats(); renderCoins(); renderPot(); renderRead(); renderPrompt(); renderYou();
    requestAnimationFrame(drawLinks);
  }

  function renderTop() {
    $('#street').textContent = game.street();
    $('#street-meta').textContent = 'Hand ' + game.handNo + (game.maxHands ? '/' + game.maxHands : '') +
      ' · blinds ' + game.smallBlind + '/' + game.bigBlind;
    $('#btn-nerd').setAttribute('aria-pressed', nerd ? 'true' : 'false');
  }

  /* ---------------------------------------------------------------- seats -- */

  function renderSeats() {
    const box = $('#seats');
    const focus = focusSeat();
    game.players.forEach((p) => {
      let node = seatNodes[p.seat];
      if (!node) {
        node = buildSeat(p);
        seatNodes[p.seat] = node;
        box.appendChild(node.root);
      }
      node.root.hidden = p.seat === focus;
      paintSeat(node, p);
    });
  }

  function buildSeat(p) {
    const rootEl = el('div', 'seat');
    const head = el('div', 'seat-head');
    head.innerHTML = Art.avatar(p.avatar);
    head.appendChild(el('span', 'seat-name', p.name));
    const chips = el('div', 'seat-chips mono');
    const bet = el('div', 'seat-bet mono');
    const flag = el('div', 'seat-flag');
    rootEl.appendChild(head); rootEl.appendChild(chips); rootEl.appendChild(bet); rootEl.appendChild(flag);
    return { root: rootEl, chips, bet, flag };
  }

  function paintSeat(node, p) {
    node.root.classList.toggle('acting', p.seat === game.actor && game.phase !== 'over');
    node.root.classList.toggle('folded', p.folded && !p.out);
    node.root.classList.toggle('out', p.out);
    node.chips.textContent = p.out ? 'out' : fmt(p.chips);
    node.bet.textContent = p.bet > 0 ? fmt(p.bet) : '';
    node.bet.hidden = !(p.bet > 0);
    const flag = p.out ? '' : p.folded ? 'folded' : p.allIn ? 'all in'
      : p.seat === game.dealer ? 'dealer' : '';
    node.flag.textContent = flag;
    node.flag.hidden = !flag;
  }

  /* ---------------------------------------------------------------- coins -- */

  function activeBoard() { return game.players[focusSeat()].board; }

  function renderCoins() {
    const row = $('#coins');
    if (row.children.length !== game.coins) {
      row.innerHTML = ''; coinNodes = [];
      for (let i = 0; i < game.coins; i++) {
        const n = Art.coinNode(String(i + 1));
        n.setAttribute('role', 'button');
        coinNodes.push(n); row.appendChild(n);
      }
    }
    const board = activeBoard();
    const links = Q.findLinks(board);
    for (let i = 0; i < game.coins; i++) {
      const n = coinNodes[i];
      const revealed = i < game.revealed;
      const info = revealed ? Q.readCoin(board, i) : { kind: 'hidden' };
      const link = revealed ? links.find((l) => l.a === i || l.b === i) : null;
      const linkInfo = link ? { partner: link.a === i ? link.b : link.a, same: link.same } : null;
      const prevKind = n.dataset.kind;
      Art.paintCoin(n, { kind: info.kind, link: linkInfo, ket: info.ket, up: info.up }, nerd);
      if (prevKind !== info.kind && prevKind !== 'hidden' && (info.kind === 'one' || info.kind === 'zero')) Sound.thud();
      if (prevKind === 'hidden' && info.kind !== 'hidden') Sound.card();
      n.setAttribute('aria-label', coinAria(i, revealed, info, linkInfo));
      wireCoin(n, i, revealed);
    }
  }

  function coinAria(i, revealed, info, link) {
    if (!revealed) return 'Coin ' + (i + 1) + ', not shown yet';
    const words = { one: 'settled on 1', zero: 'settled on 0', plus: 'spinning plus, 50/50', minus: 'spinning minus, 50/50', mixed: 'undecided' };
    return 'Coin ' + (i + 1) + ', ' + words[info.kind] +
      (link ? ', linked to coin ' + (link.partner + 1) + (link.same ? ', lands the same' : ', lands opposite') : '');
  }

  function wireCoin(n, i, revealed) {
    const live = game.phase === 'gates' && selectedCard && revealed && !game.current().bot;
    n.classList.toggle('pickable', !!live);
    n.classList.toggle('picked', picked.includes(i));
    n.classList.toggle('hinted', !!(hint && hint.targets.includes(i)));
    n.tabIndex = live ? 0 : -1;
    n.onclick = live ? () => pickCoin(i) : null;
    n.onkeydown = live ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pickCoin(i); } } : null;
    n.onmouseenter = live ? () => previewOn(i) : null;
    n.onmouseleave = live ? () => renderRead() : null;
  }

  function previewOn(i) {
    const card = E.CARDS[selectedCard];
    const targets = picked.concat([i]);
    if (targets.length !== card.arity || (card.arity === 2 && targets[0] === targets[1])) return;
    const pv = E.previewCard(activeBoard(), selectedCard, targets, game.coins);
    if (!pv) return;
    const swing = pv.delta > 0.001 ? ' <b class="up">+' + pv.delta.toFixed(1) + '</b>'
      : pv.delta < -0.001 ? ' <b class="down">' + pv.delta.toFixed(1) + '</b>' : '';
    $('#read').innerHTML = '<b>' + card.name + '</b> → ' + pv.text + swing;
  }

  function pickCoin(i) {
    const card = E.CARDS[selectedCard];
    if (picked.includes(i)) { picked = picked.filter((x) => x !== i); render(); return; }
    picked.push(i);
    if (picked.length < card.arity) { hint = null; render(); renderRead(); return; }
    const res = game.playCard(selectedCard, picked.slice());
    const wasCollapse = selectedCard === 'M';
    selectedCard = null; selectedIdx = -1; picked = []; hint = null;
    if (res.ok) {
      if (wasCollapse) {
        Sound.collapse();
        toast('Coin ' + (res.play.targets[0] + 1) + ' landed on ' + res.outcome + (res.outcome ? ' — a point.' : '.'));
      } else Sound.play();
      const p = game.current();
      if (p.hand.length === 0) toast('No cards left — press Done.');
    }
    render();
    if (!res.ok) $('#read').textContent = res.why;
  }

  function drawLinks() {
    const svg = $('#links');
    if (!svg || !game) return;
    svg.innerHTML = '';
    const wrap = svg.parentNode.getBoundingClientRect();
    if (!wrap.width) return;
    svg.setAttribute('viewBox', '0 0 ' + wrap.width + ' ' + wrap.height);
    Q.findLinks(activeBoard()).forEach((l) => {
      if (l.a >= game.revealed || l.b >= game.revealed) return;
      const A = coinNodes[l.a], B = coinNodes[l.b];
      const ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
      const x1 = ra.left + ra.width / 2 - wrap.left, x2 = rb.left + rb.width / 2 - wrap.left;
      const y = ra.top + 4 - wrap.top;
      const lift = Math.min(44, 14 + Math.abs(x2 - x1) * 0.12);
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M' + x1 + ' ' + y + ' Q' + ((x1 + x2) / 2) + ' ' + (y - lift) + ' ' + x2 + ' ' + y);
      p.setAttribute('class', 'link-arc ' + (l.same ? 'same' : 'opp'));
      svg.appendChild(p);
    });
  }

  /* ------------------------------------------------------------------ pot -- */

  function renderPot() {
    const target = game.potTotal();
    const node = $('#pot-value');
    if (potTimer) { clearInterval(potTimer); potTimer = null; }
    if (REDUCED || Math.abs(target - potShown) < 4) { potShown = target; node.textContent = fmt(target); return; }
    const step = Math.max(1, Math.round(Math.abs(target - potShown) / 10));
    potTimer = setInterval(() => {
      potShown += potShown < target ? step : -step;
      if (Math.abs(target - potShown) <= step) potShown = target;
      node.textContent = fmt(potShown);
      if (potShown === target) { clearInterval(potTimer); potTimer = null; }
    }, 24);
  }

  /* -------------------------------------------------------- read + prompt -- */

  function renderRead() {
    const node = $('#read');
    if (hint) { node.innerHTML = '<b class="up">Hint:</b> ' + hint.label; return; }
    if (selectedCard) {
      const c = E.CARDS[selectedCard];
      node.innerHTML = '<b>' + c.name + '</b> — ' + c.blurb + (c.arity === 2 && !picked.length ? ' Pick the control coin first.' : '');
      return;
    }
    if (game.revealed === 0) { node.textContent = 'No coins showing yet. Bet on your cards.'; return; }
    const board = activeBoard();
    let sure = 0;
    for (let i = 0; i < game.revealed; i++) if (Q.readCoin(board, i).kind === 'one') sure++;
    const parts = [sure === 0 ? 'Nothing on 1 yet' : sure === 1 ? 'One coin on 1' : sure + ' coins on 1'];
    Q.findLinks(board).filter((l) => l.a < game.revealed && l.b < game.revealed)
      .forEach((l) => parts.push('coins ' + (l.a + 1) + ' & ' + (l.b + 1) + (l.same ? ' land the same' : ' land opposite')));
    let text = parts.join(' · ');
    if (nerd) text += ' · ⟨n⟩ = ' + Q.expectedScore(board, game.revealed).toFixed(2);
    node.textContent = text;
  }

  function renderPrompt() {
    const node = $('#prompt');
    const p = game.current();
    if (!p) { node.textContent = game.message; return; }
    if (p.bot) { node.innerHTML = '<em>' + p.name + '</em> is thinking…'; return; }
    const who = mode === 'hot' ? '<em>' + p.name + '</em> — ' : '';
    if (game.phase === 'gates') node.innerHTML = who + 'Pick a card, then a coin. Press <b>Done</b> when finished.';
    else {
      const owe = game.toCall(p.seat);
      node.innerHTML = who + (owe > 0 ? 'Call <b class="mono">' + fmt(owe) + '</b>, raise, or fold.' : 'Check, bet, or fold.');
    }
  }

  /* ------------------------------------------------------------------ you -- */

  function renderYou() {
    const seat = focusSeat(), p = game.players[seat];
    const box = $('#you-seat');
    box.innerHTML = Art.avatar(p.avatar) +
      '<span class="you-name">' + p.name + '</span>' +
      '<b class="mono you-chips">' + (p.out ? 'out' : fmt(p.chips)) + '</b>' +
      (p.bet > 0 ? '<span class="seat-bet mono">' + fmt(p.bet) + '</span>' : '') +
      (p.seat === game.dealer && !p.out ? '<span class="seat-flag">dealer</span>' : '') +
      (p.folded && !p.out ? '<span class="seat-flag">folded</span>' : '') +
      (p.allIn ? '<span class="seat-flag">all in</span>' : '');
    box.classList.toggle('acting', game.actor === seat && game.phase !== 'over');
    renderHand(p);
    renderActions(p);
  }

  function renderHand(p) {
    const hand = $('#hand');
    hand.innerHTML = '';
    // Pass & play: cards stay face-down while betting (peek to look) and
    // until the curtain has been acknowledged before playing them.
    const hidden = mode === 'hot' && ((game.phase === 'betting' && !peeking) || (game.phase === 'gates' && curtained !== p.seat));
    const mine = game.actor === p.seat && !p.bot;
    p.hand.forEach((id, k) => {
      const n = Art.cardNode(id, E.CARDS[id]);
      n.classList.toggle('back', hidden);
      if (hidden) { n.innerHTML = ''; n.title = ''; }
      n.classList.toggle('selected', selectedIdx === k && !hidden);
      n.classList.toggle('hinted', !!(hint && hint.card === id && p.hand.indexOf(id) === k));
      n.classList.toggle('lit', game.phase === 'gates' && mine);
      n.disabled = !(game.phase === 'gates' && mine);
      n.onclick = () => {
        const off = selectedIdx === k;
        selectedCard = off ? null : id;
        selectedIdx = off ? -1 : k;
        picked = []; hint = null;
        if (selectedCard) Sound.card();
        render();
      };
      hand.appendChild(n);
    });
    if (!p.hand.length) hand.appendChild(el('span', 'muted small', game.phase === 'gates' ? 'All cards played' : ''));
    if (hidden) {
      const peek = btn('ghost small', 'Peek at your cards', () => {
        peeking = true; render();
        clearTimeout(peekTimer);
        peekTimer = setTimeout(() => { peeking = false; render(); }, 5000);
      });
      hand.appendChild(peek);
    }
  }

  function renderActions(p) {
    const box = $('#actions');
    box.innerHTML = '';
    if (game.phase === 'over' || game.actor !== p.seat || p.bot) return;
    if (game.phase === 'betting') renderBetting(box, p);
    else if (game.phase === 'gates') renderGates(box, p);
  }

  function afterBet() { selectedCard = null; selectedIdx = -1; picked = []; hint = null; peeking = false; sync(); }

  function renderBetting(box, p) {
    const seat = p.seat, owe = game.toCall(seat);
    const maxTo = game.maxRaiseTo(seat), minTo = game.minRaiseTo(seat);
    const canRaise = maxTo > game.currentBet;

    const row = el('div', 'row');
    row.appendChild(btn('danger', 'Fold', () => { Sound.fold(); game.fold(); afterBet(); }));
    row.appendChild(btn('primary', owe === 0 ? 'Check' : owe >= p.chips ? 'Call all in ' + fmt(owe) : 'Call ' + fmt(owe),
      () => { if (owe > 0) Sound.chip(); game.call(); afterBet(); }));
    box.appendChild(row);

    if (!canRaise) return;
    const pot = game.potTotal();
    const raiseRow = el('div', 'raise-row');
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = String(minTo); slider.max = String(maxTo); slider.step = '1';
    slider.value = String(Math.min(maxTo, Math.max(minTo, game.currentBet + Math.round(pot * 0.6))));
    slider.setAttribute('aria-label', 'Raise to');
    const amt = el('b', 'mono raise-amt', fmt(slider.value));
    slider.oninput = () => { amt.textContent = fmt(slider.value); };

    const presets = el('div', 'presets');
    [['Min', minTo], ['½ pot', game.currentBet + Math.round(pot / 2)], ['Pot', game.currentBet + pot], ['All in', maxTo]]
      .forEach(([label, v]) => {
        const clamped = Math.min(maxTo, Math.max(minTo, v));
        presets.appendChild(btn('tiny ghost', label, () => { slider.value = String(clamped); amt.textContent = fmt(clamped); }));
      });

    const go = btn('', owe === 0 ? 'Bet' : 'Raise to', () => {
      const r = game.raiseTo(parseInt(slider.value, 10));
      if (!r.ok) { toast(r.why); return; }
      Sound.chip(); afterBet();
    });
    go.classList.add('raise-go');
    go.appendChild(amt);

    raiseRow.appendChild(presets);
    raiseRow.appendChild(slider);
    raiseRow.appendChild(go);
    box.appendChild(raiseRow);
  }

  function renderGates(box, p) {
    const row = el('div', 'row');
    const h = btn('ghost', 'Hint', () => {
      const best = game.hint(p.seat);
      if (!best) { hint = null; toast('Nothing left that helps — press Done.'); return; }
      hint = { card: best.card, targets: best.targets,
        label: E.CARDS[best.card].name + ' on coin ' + best.targets.map((t) => t + 1).join(' then ') + ' — ' + best.text };
      selectedCard = null; selectedIdx = -1; picked = [];
      render();
    });
    h.disabled = !p.hand.length;
    row.appendChild(h);
    row.appendChild(btn('primary', 'Done', () => {
      selectedCard = null; selectedIdx = -1; picked = []; hint = null;
      Sound.card();
      game.endTurn();
      sync();
    }));
    box.appendChild(row);
  }

  /* -------------------------------------------------------------- curtain -- */

  function openCurtain(p, done) {
    $('#curtain-name').textContent = p.name;
    show($('#curtain'));
    const go = $('#curtain-go');
    go.onclick = () => { hide($('#curtain')); Sound.card(); done(); };
    go.focus();
  }

  /* ------------------------------------------------------------- showdown -- */

  let sdTimers = [];

  function openShowdown() {
    recordHand();
    const body = $('#sd-body');
    body.innerHTML = '';
    $('#sd-summary').textContent = '';
    sdTimers.forEach(clearTimeout); sdTimers = [];
    $('#sd-title').textContent = game.results.uncontested ? 'Everyone folded' : 'Showdown';
    hide($('#sd-next')); show($('#sd-skip'));

    const contenders = game.players.filter((p) => p.score !== null);
    if (!contenders.length) {
      const w = game.players[game.results.pots[0].winners[0]];
      body.appendChild(el('p', 'muted', w.name + ' takes the pot without a fight.'));
      show($('#showdown')); finishShowdown(); return;
    }

    const bestKey = Math.max(...contenders.map((p) => p.rankKey));
    const rows = [];
    let delay = 0;
    const step = REDUCED ? 0 : 230;

    contenders.forEach((p) => {
      const sec = el('div', 'sd-player');
      const head = el('div', 'sd-head');
      head.innerHTML = Art.avatar(p.avatar);
      head.appendChild(el('span', 'nm', p.name));
      const plays = el('span', 'sd-plays');
      if (p.plays.length) p.plays.forEach((pl) => plays.appendChild(el('span', 'play-chip', E.describePlay(pl.card, pl.targets))));
      else plays.appendChild(el('span', 'play-chip none', 'no cards played'));
      head.appendChild(plays);
      sec.appendChild(head);

      const coins = el('div', 'sd-coins');
      const nodes = [];
      p.bits.forEach((bit, i) => {
        const c = Art.coinNode(String(i + 1));
        c.classList.add('mini');
        coins.appendChild(c);
        nodes.push({ node: c, bit });
      });
      sec.appendChild(coins);
      const rank = el('div', 'rank');
      sec.appendChild(rank);
      body.appendChild(sec);
      const row = { p, sec, rank, nodes };
      rows.push(row);

      nodes.forEach((c) => {
        delay += step;
        sdTimers.push(setTimeout(() => {
          Art.paintCoin(c.node, { kind: c.bit ? 'one' : 'zero' }, false);
          if (c.bit) Sound.coin(true); else Sound.thud();
        }, delay));
      });
      delay += 120;
      sdTimers.push(setTimeout(() => revealRank(row, bestKey), delay));
    });

    show($('#showdown'));
    delay += 360;
    sdTimers.push(setTimeout(finishShowdown, delay));

    $('#sd-skip').onclick = () => {
      sdTimers.forEach(clearTimeout); sdTimers = [];
      rows.forEach((r) => {
        r.nodes.forEach((c) => Art.paintCoin(c.node, { kind: c.bit ? 'one' : 'zero' }, false));
        revealRank(r, bestKey);
      });
      finishShowdown();
    };
  }

  function revealRank(r, bestKey) {
    r.rank.innerHTML = E.rankName(r.p.score) + ' <b class="mono">' + r.p.score + '</b>';
    r.rank.classList.toggle('coherence', r.p.score === 5);
    if (r.p.rankKey === bestKey) r.sec.classList.add('leader');
    if (r.p.won > 0) r.rank.appendChild(el('span', 'won mono', '+' + fmt(r.p.won)));
    if (r.p.score === 5) Sound.coherence();
  }

  function finishShowdown() {
    $('#sd-summary').textContent = game.results.summary;
    Sound.win();
    hide($('#sd-skip'));
    const next = $('#sd-next');
    show(next);
    const done = game.finished();
    next.textContent = done ? 'See results' : 'Next hand';
    next.onclick = () => {
      hide($('#showdown'));
      if (done) { openResults(done); return; }
      curtained = -1; selectedCard = null; selectedIdx = -1; picked = []; hint = null; peeking = false; potShown = 0;
      game.nextHand();
      Sound.card();
      sync();
    };
    next.focus();
  }

  /* -------------------------------------------------------------- results -- */

  function openResults(reason) {
    recordGame();
    const me = game.players[0];
    const standings = game.standings();
    const place = standings.findIndex((p) => p.seat === 0) + 1;
    const body = $('#res-body');
    body.innerHTML = '';

    if (mode === 'daily') {
      $('#res-eyebrow').textContent = 'Daily Deal #' + dailyNumber() + (dailyPractice ? ' · practice' : '');
      $('#res-title').textContent = place === 1 ? 'You took the table' : ordinal(place) + ' of ' + game.n;
    } else if (mode === 'quick') {
      $('#res-eyebrow').textContent = 'Quick game · deal #' + game.seed;
      $('#res-title').textContent = reason === 'busted' ? 'Busted on hand ' + game.handNo
        : place === 1 ? 'You took the table' : ordinal(place) + ' of ' + game.n;
    } else {
      $('#res-eyebrow').textContent = 'Pass & play';
      $('#res-title').textContent = standings[0].name + ' takes the table';
    }

    const list = el('div', 'standings');
    standings.forEach((p, i) => {
      const row = el('div', 'stand-row' + (p.seat === 0 && mode !== 'hot' ? ' me' : ''));
      row.innerHTML = '<span class="mono place">' + (i + 1) + '</span>' + Art.avatar(p.avatar) +
        '<span class="nm">' + p.name + '</span>' +
        '<span class="muted small">' + p.handsWon + ' hand' + (p.handsWon === 1 ? '' : 's') + ' won</span>' +
        '<b class="mono">' + fmt(p.chips) + '</b>';
      list.appendChild(row);
    });
    body.appendChild(list);

    if (mode !== 'hot') {
      const grid = el('p', 'grid big');
      grid.textContent = game.history.map((h) => h.winners.includes(0) ? (h.score === 5 ? '⭐' : '🟧') : '⬛').join('');
      grid.title = 'Orange: you won the hand. Star: with Coherence.';
      body.appendChild(grid);
    }

    const share = $('#res-share');
    share.hidden = mode === 'hot';
    share.textContent = mode === 'daily' ? 'Share result' : 'Copy challenge link';
    share.onclick = () => {
      const url = location.origin + location.pathname;
      const text = mode === 'daily'
        ? 'Quantum Hold’em · Daily #' + dailyNumber() + '\n' + (place === 1 ? '🏆 ' : '') + fmt(me.chips) + ' chips · ' +
          ordinal(place) + ' of ' + game.n + '\n' + $('.grid.big').textContent + '\n' + url
        : 'Beat my ' + fmt(me.chips) + ' chips on the same deals: ' + url + '?seed=' + game.seed + '&bots=' + (game.n - 1);
      if (navigator.share && /Mobi/.test(navigator.userAgent)) navigator.share({ text }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard'), () => toast(text));
      else toast(text);
    };
    $('#res-again').onclick = () => {
      hide($('#results'));
      if (mode === 'daily') startDaily();
      else if (mode === 'quick') { startQuick(); }
      else startHot();
    };
    $('#res-home').onclick = goHome;
    show($('#results'));
    $('#res-again').focus();
  }

  /* ---------------------------------------------------------------- rules -- */

  function openRules() {
    const coinRow = (kind, badge, name, text) =>
      '<tr><td><span class="coin mini static" data-kind="' + kind + '"><span class="coin-disc"><span class="coin-face front">1</span>' +
      '<span class="coin-face back">0</span></span><span class="coin-badge"' + (badge ? '' : ' hidden') + '>' + badge + '</span></span>' +
      '<b>' + name + '</b></td><td>' + text + '</td></tr>';

    $('#rules-body').innerHTML =
      '<section><h3>The goal</h3><p>Five coins are dealt to the table. At showdown every coin lands on a 1 or a 0. ' +
      'Each 1 is a point; most points takes the pot. You bet chips between reveals exactly as in Texas Hold’em.</p></section>' +

      '<section><h3>Reading a coin</h3><table>' +
      coinRow('one', '', 'Settled on 1', 'A sure point. Only your own card can spoil it.') +
      coinRow('zero', '', 'Settled on 0', 'Worth nothing unless you change it.') +
      coinRow('plus', '+', 'Spinning +', '50/50. A qubit in superposition. Its + tilt decides what Spin does to it.') +
      coinRow('minus', '−', 'Spinning −', '50/50 too, but tilted the other way. Spin lands this one on 1.') +
      coinRow('mixed', '= 2', 'Linked', 'Entangled with another coin: they always land the same, or always opposite.') +
      '</table></section>' +

      '<section><h3>Your cards</h3><table class="cards-table">' +
      E.CARD_ORDER.map((id) => {
        const c = E.CARDS[id];
        return '<tr><td><span class="rules-card">' + Art.gate(id) + '</span><b>' + c.name + '</b>' +
          '<span class="mono tiny-gate">' + c.gate + '</span></td><td>' + c.blurb + '</td></tr>';
      }).join('') +
      '</table><p>Three cards each, dealt before the first bet. After the river, every player still in plays any of ' +
      'their cards on <b>their own copy</b> of the five coins. Hover a coin with a card selected and the table tells you ' +
      'exactly what will happen. <b>Hint</b> plays the best card for you.</p></section>' +

      '<section><h3>A hand</h3><ol>' +
      '<li><b>Deal</b> — blinds go in, three cards each, first bets. No coins showing yet.</li>' +
      '<li><b>Flop</b> — three coins turn over. Bets.</li>' +
      '<li><b>Turn</b> — a fourth coin. Bets.</li>' +
      '<li><b>River</b> — the fifth. Last bets.</li>' +
      '<li><b>Cards</b> — everyone left rigs their own copy of the coins.</li>' +
      '<li><b>Showdown</b> — every copy lands. Count the 1s.</li></ol></section>' +

      '<section><h3>Ranks</h3><p>' +
      E.RANKS.map((r, i) => '<span class="rank-pill"><b class="mono">' + i + '</b> ' + r + '</span>').join(' ') +
      '</p><p>Tied on count? A 1 further left wins — coin 1 is the ace. Identical boards split the pot. ' +
      'Blinds double every five hands so a game ends.</p></section>' +

      '<section><h3>Underneath</h3><p>The coins are qubits and the cards are gates: Flip is <span class="mono">X</span>, ' +
      'Spin is the Hadamard <span class="mono">H</span>, Twist is <span class="mono">Z</span>, Link is <span class="mono">CNOT</span> ' +
      'and Collapse is a projective measurement. Spinning is superposition, the ± tilt is relative phase, ' +
      'linked is a Bell pair, and Spin landing a + on 0 is interference. Press <b>Ψ</b> at the table for the kets and ' +
      'probabilities. You need none of it to win.</p></section>';

    show($('#rules'));
    $('#rules-close').onclick = () => hide($('#rules'));
    $('#rules-close').focus();
  }

  /* ----------------------------------------------------------------- boot -- */

  function paintSoundBtn() {
    const b = $('#btn-sound');
    b.innerHTML = Art.icon(Sound.isOn() ? 'sound' : 'muted');
    b.setAttribute('aria-pressed', Sound.isOn() ? 'true' : 'false');
    b.title = Sound.isOn() ? 'Sound on' : 'Sound off';
  }

  function boot() {
    initHome();
    paintSoundBtn();
    $('#btn-home').innerHTML = Art.icon('home');
    $('#btn-home').onclick = () => {
      if (!game || game.phase === 'over' || confirm('Leave the table? This game will not be saved.')) goHome();
    };
    $('#btn-sound').onclick = () => { Sound.toggle(); paintSoundBtn(); };
    $('#btn-nerd').onclick = () => { nerd = !nerd; save('nerd', nerd); render(); };
    $('#btn-rules').onclick = openRules;

    window.addEventListener('resize', () => { if (game) requestAnimationFrame(drawLinks); });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { hide($('#rules')); if (selectedCard) { selectedCard = null; selectedIdx = -1; picked = []; render(); } return; }
      if (!game || ev.target.tagName === 'INPUT' || document.querySelector('.overlay:not([hidden])')) return;
      const p = game.current();
      if (!p || p.bot || p.seat !== focusSeat()) return;
      const k = ev.key.toLowerCase();
      if (game.phase === 'betting') {
        if (k === 'f') { game.fold(); afterBet(); }
        else if (k === 'c' || ev.key === 'Enter') { game.call(); afterBet(); }
      } else if (game.phase === 'gates') {
        if (ev.key === 'Enter') { game.endTurn(); sync(); }
        else if (k === 'h') { const b = $('#actions .ghost'); if (b) b.click(); }
      }
    });
  }

  root.UI = { boot, get game() { return game; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
