/*
 * Quantum Hold'em — art.js
 * The few marks that are drawn rather than typed: circuit symbols for the
 * cards and avatars for the seats. Everything else on the table is CSS.
 */
(function (root) {
  'use strict';

  function svg(body, cls, viewBox) {
    return '<svg class="' + (cls || '') + '" viewBox="' + (viewBox || '0 0 100 100') +
      '" aria-hidden="true" focusable="false" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
      body + '</svg>';
  }

  /* Cards carry the symbol a circuit diagram would use for that gate. */
  const GATE = {
    X:  '<path d="M6 50 H26 M74 50 H94" stroke-width="6" fill="none"/>' +
        '<circle cx="50" cy="50" r="24" fill="none" stroke-width="6"/>' +
        '<path d="M50 26 V74 M26 50 H74" stroke-width="6"/>',
    H:  '<path d="M6 50 H22 M78 50 H94" stroke-width="6" fill="none"/>' +
        '<rect x="22" y="22" width="56" height="56" rx="6" fill="none" stroke-width="6"/>' +
        '<path d="M38 34 V66 M62 34 V66 M38 50 H62" stroke-width="7" fill="none"/>',
    Z:  '<path d="M6 50 H22 M78 50 H94" stroke-width="6" fill="none"/>' +
        '<rect x="22" y="22" width="56" height="56" rx="6" fill="none" stroke-width="6"/>' +
        '<path d="M38 35 H62 L38 65 H62" stroke-width="7" fill="none"/>',
    CX: '<path d="M6 28 H94 M6 72 H94" stroke-width="5" fill="none" opacity=".55"/>' +
        '<circle cx="50" cy="28" r="9"/>' +
        '<path d="M50 28 V72" stroke-width="6"/>' +
        '<circle cx="50" cy="72" r="18" fill="none" stroke-width="6"/>' +
        '<path d="M32 72 H68 M50 54 V90" stroke-width="6"/>',
    M:  '<path d="M6 50 H16" stroke-width="6" fill="none"/>' +
        '<rect x="16" y="22" width="68" height="56" rx="6" fill="none" stroke-width="6"/>' +
        '<path d="M30 66 A20 20 0 0 1 70 66" fill="none" stroke-width="5"/>' +
        '<path d="M50 66 L68 44" stroke-width="6"/>' +
        '<circle cx="50" cy="66" r="4"/>' +
        '<path d="M84 44 H94 M84 56 H94" stroke-width="5" fill="none"/>'
  };

  function gate(id) { return svg(GATE[id] || '', 'gate'); }

  /* Seat avatars. Index 0 is the human. */
  const AVATARS = [
    '<path d="M50 10 L61 38 L91 40 L67 58 L75 88 L50 71 L25 88 L33 58 L9 40 L39 38 Z"/>',                            // star
    '<circle cx="50" cy="50" r="9"/><g fill="none" stroke-width="5"><ellipse cx="50" cy="50" rx="42" ry="16"/>' +
      '<ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(60 50 50)"/>' +
      '<ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(120 50 50)"/></g>',                                  // orbit
    '<path d="M62 12a38 38 0 1 0 4 76 30 30 0 1 1-4-76z"/><circle cx="76" cy="30" r="4"/>',                           // moon
    '<path d="M8 50 C24 24 76 24 92 50 C76 76 24 76 8 50z" fill="none" stroke-width="7"/><circle cx="50" cy="50" r="15"/>', // eye
    '<circle cx="50" cy="28" r="15" fill="none" stroke-width="8"/><rect x="45.5" y="40" width="9" height="46" rx="2"/>' +
      '<rect x="54.5" y="58" width="14" height="8" rx="1.5"/><rect x="54.5" y="72" width="10" height="8" rx="1.5"/>', // key
    '<path d="M22 10 h56 v8 h-6 c0 16-14 24-14 32 s14 16 14 32 h6 v8 h-56 v-8 h6 c0-16 14-24 14-32 s-14-16-14-32 h-6z"/>' // hourglass
  ];

  function avatar(i) { return svg(AVATARS[i % AVATARS.length], 'avatar'); }

  const ICON = {
    sound:    '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke-width="1.8"/>',
    muted:    '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9.5l5 5m0-5l-5 5" fill="none" stroke-width="1.9"/>',
    play:     '<path d="M8 5v14l11-7z"/>',
    pause:    '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
    replay:   '<path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/>',
    home:     '<path d="M4 11 L12 4 L20 11 V20 H14 V14 H10 V20 H4 Z" fill="none" stroke-width="1.9"/>'
  };

  function icon(name) { return svg(ICON[name] || '', 'icon', '0 0 24 24'); }

  /* ---- DOM builders shared by the table and the explainer ---- */

  const BADGE = { plus: '+', minus: '−', mixed: '', one: '', zero: '', hidden: '' };

  /** A coin. Paint it with paintCoin(); the node persists so flips animate. */
  function coinNode(label) {
    const n = document.createElement('div');
    n.className = 'coin';
    n.dataset.kind = 'hidden';
    n.innerHTML =
      '<div class="coin-disc"><span class="coin-face front">1</span><span class="coin-face back">0</span></div>' +
      '<span class="coin-badge"></span>' +
      '<span class="coin-label">' + (label || '') + '</span>' +
      '<span class="coin-ket"></span>';
    return n;
  }

  /**
   * info: { kind, link: {partner, same} | null, ket, up }
   * `up` and `ket` are shown only when nerd mode asks for them.
   */
  const FACE = { plus: '+', minus: '−', mixed: '?' };

  function paintCoin(n, info, nerd) {
    const kind = info.kind || 'hidden';
    if (n.dataset.kind !== kind) {
      n.dataset.kind = kind;
      // A spinning coin shows its tilt on both faces, so a still frame never
      // looks like a settled 1 or 0.
      n.querySelector('.front').textContent = FACE[kind] || '1';
      n.querySelector('.back').textContent = FACE[kind] || '0';
    }
    const badge = n.querySelector('.coin-badge');
    if (info.link) {
      badge.textContent = (info.link.same ? '= ' : '≠ ') + (info.link.partner + 1);
      badge.dataset.link = info.link.same ? 'same' : 'opp';
    } else {
      badge.textContent = BADGE[kind] || '';
      delete badge.dataset.link;
    }
    badge.hidden = !badge.textContent;
    const ket = n.querySelector('.coin-ket');
    ket.textContent = nerd && kind !== 'hidden'
      ? (info.ket || '') + (info.up !== undefined ? '  ' + Math.round(info.up * 100) + '%' : '') : '';
  }

  function cardNode(id, card) {
    const n = document.createElement('button');
    n.type = 'button';
    n.className = 'card';
    n.dataset.id = id;
    n.innerHTML =
      '<span class="card-gate">' + card.gate + '</span>' +
      gate(id) +
      '<span class="card-name">' + card.name + '</span>';
    n.title = card.blurb;
    return n;
  }

  root.Art = { gate, avatar, icon, AVATARS, coinNode, paintCoin, cardNode };
})(typeof window !== 'undefined' ? window : globalThis);
