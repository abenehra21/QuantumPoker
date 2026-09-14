/*
 * Quantum Poker — art.js
 * Every mark on the table, drawn as SVG. No emoji, no icon font.
 *
 * The line work is deliberately heavy and a little irregular: this is meant to
 * look struck into metal or cut into a woodblock, not vector-smooth.
 */
(function (global) {
  'use strict';

  function svg(viewBox, body, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="' + viewBox + '" aria-hidden="true" focusable="false">' +
      body + '</svg>';
  }

  /* ---------------- the coin ---------------- */

  // A struck qubit. The Bloch meridian is the ring; the numeral is the value
  // it will read if you measure it now. Beginners see a 1 and know it is good;
  // anyone who knows what a qubit is sees exactly what it is.
  var MERIDIAN =
    '<circle cx="50" cy="50" r="39" fill="none" stroke="currentColor" stroke-width="2.6" opacity=".5"/>' +
    '<ellipse cx="50" cy="50" rx="15" ry="39" fill="none" stroke="currentColor" stroke-width="2" opacity=".32"/>' +
    '<path d="M11 50 H89" stroke="currentColor" stroke-width="1.6" opacity=".22"/>';

  var GLYPH_ONE =
    '<path d="M38 33 L57 22 L57 78 L46 78 L46 39 Z"/>' +
    '<rect x="34" y="78" width="34" height="9" rx="1.5"/>';

  var GLYPH_ZERO =
    '<path d="M50 20 c11 0 19 13 19 30 s-8 30-19 30 -19-13-19-30 8-30 19-30z' +
    'M50 32 c-5 0-8 8-8 18 s3 18 8 18 8-8 8-18 -3-18-8-18z" fill-rule="evenodd"/>';

  function coinOne()  { return svg('0 0 100 100', MERIDIAN + GLYPH_ONE, 'ink'); }
  function coinZero() { return svg('0 0 100 100', MERIDIAN + GLYPH_ZERO, 'ink'); }

  /* ---------------- the cards ---------------- */

  // Where a real circuit symbol exists, the card uses it. Bind is the CNOT of
  // every quantum-computing textbook; Observer is the measurement gate.
  var CARD_ART = {
    // Flip — a Bloch vector turned end over end.
    FLIP:
      '<circle cx="50" cy="52" r="30" fill="none" stroke-width="4" opacity=".35"/>' +
      '<path d="M50 82 L50 26" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M50 18 L60 34 L40 34 Z"/>' +
      '<path d="M22 40 A32 32 0 0 1 78 40" fill="none" stroke-width="4" opacity=".55"/>' +
      '<path d="M78 40 L84 27 L67 31 Z" opacity=".55"/>',

    // Haunt — one path in, two out. Superposition, drawn as interference.
    HAUNT:
      '<path d="M8 50 H34" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M34 50 C48 50 50 24 64 24 H92" fill="none" stroke-width="5.5" stroke-linecap="round"/>' +
      '<path d="M34 50 C48 50 50 76 64 76 H92" fill="none" stroke-width="5.5" stroke-linecap="round"/>' +
      '<circle cx="34" cy="50" r="7"/>',

    // Summon — the vector snapped to the north pole and pinned there.
    SUMMON:
      '<circle cx="50" cy="54" r="29" fill="none" stroke-width="4" opacity=".35"/>' +
      '<ellipse cx="50" cy="54" rx="11" ry="29" fill="none" stroke-width="3" opacity=".25"/>' +
      '<path d="M50 54 L50 22" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M50 12 L61 30 L39 30 Z"/>' +
      '<circle cx="50" cy="54" r="5"/>' +
      '<path d="M26 82 H74" stroke-width="5" stroke-linecap="round" opacity=".6"/>',

    // Bind — the CNOT symbol: control dot, wire, target ring.
    BIND:
      '<circle cx="50" cy="22" r="8.5"/>' +
      '<path d="M50 22 V64" stroke-width="5"/>' +
      '<circle cx="50" cy="70" r="17" fill="none" stroke-width="5"/>' +
      '<path d="M33 70 H67 M50 53 V87" stroke-width="5" stroke-linecap="round"/>',

    // Observer — the measurement gate: a meter in a box.
    OBSERVER:
      '<rect x="14" y="22" width="72" height="58" rx="5" fill="none" stroke-width="5"/>' +
      '<path d="M28 68 A22 22 0 0 1 72 68" fill="none" stroke-width="4.5"/>' +
      '<path d="M50 68 L70 42" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="50" cy="68" r="4.5"/>'
  };

  function cardArt(id) {
    var body = CARD_ART[id] || '';
    return '<svg class="card-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false" ' +
      'stroke="currentColor" fill="currentColor" stroke-linejoin="round">' + body + '</svg>';
  }

  /* ---------------- player sigils ---------------- */

  var SIGILS = {
    moon:      '<path d="M62 14a38 38 0 1 0 4 72 30 30 0 1 1-4-72z"/>' +
               '<circle cx="74" cy="30" r="3.5"/><circle cx="83" cy="46" r="2.5"/>',
    key:       '<circle cx="50" cy="27" r="15" fill="none" stroke-width="8"/>' +
               '<rect x="45.5" y="40" width="9" height="46" rx="2"/>' +
               '<rect x="54.5" y="58" width="14" height="8" rx="1.5"/>' +
               '<rect x="54.5" y="72" width="10" height="8" rx="1.5"/>',
    orbit:     '<circle cx="50" cy="50" r="9"/>' +
               '<g fill="none" stroke-width="5">' +
               '<ellipse cx="50" cy="50" rx="44" ry="17"/>' +
               '<ellipse cx="50" cy="50" rx="44" ry="17" transform="rotate(60 50 50)"/>' +
               '<ellipse cx="50" cy="50" rx="44" ry="17" transform="rotate(120 50 50)"/></g>',
    eye:       '<path d="M6 50 C22 24 78 24 94 50 C78 76 22 76 6 50z" fill="none" stroke-width="7"/>' +
               '<circle cx="50" cy="50" r="17"/>' +
               '<circle cx="50" cy="50" r="7" fill="var(--seat-ground)"/>',
    hourglass: '<path d="M22 10 h56 v8 h-6 c0 16-14 24-14 32 s14 16 14 32 h6 v8 h-56 v-8 h6 ' +
               'c0-16 14-24 14-32 s-14-16-14-32 h-6z"/>' +
               '<path d="M38 68 q12-9 24 0 c0 8-24 8-24 0z" opacity=".55"/>'
  };

  var SIGIL_KEYS = ['orbit', 'key', 'moon', 'eye', 'hourglass'];

  function sigil(name) { return svg('0 0 100 100', SIGILS[name] || SIGILS.moon, 'sigil'); }

  /* ---------------- ornament ---------------- */

  function rule() {
    return svg('0 0 200 12',
      '<path d="M4 6 H78" stroke-width="1.2" stroke-linecap="round"/>' +
      '<path d="M122 6 H196" stroke-width="1.2" stroke-linecap="round"/>' +
      '<path d="M100 1 L106 6 L100 11 L94 6 Z" />' +
      '<circle cx="88" cy="6" r="1.6"/><circle cx="112" cy="6" r="1.6"/>',
      'rule');
  }

  /* ---------------- candy tokens ---------------- */

  // Bets are shown as the sweets themselves, not a number with a chip icon.
  var CANDY_ART = {
    bar:  '<rect x="8" y="20" width="84" height="60" rx="5"/>' +
          '<path d="M31 20 v60 M52 20 v60 M73 20 v60" stroke="var(--felt)" stroke-width="3" fill="none" opacity=".5"/>',
    fun:  '<rect x="20" y="32" width="60" height="36" rx="5"/>' +
          '<path d="M20 44 L8 38 L8 62 L20 56z M80 44 L92 38 L92 62 L80 56z"/>',
    pop:  '<circle cx="50" cy="36" r="26"/><rect x="46.5" y="58" width="7" height="36" rx="3"/>',
    corn: '<path d="M50 8 L72 88 Q50 96 28 88 Z"/>'
  };

  function candy(kind) { return svg('0 0 100 100', CANDY_ART[kind] || '', 'candy-ico'); }

  global.Art = {
    coinOne: coinOne,
    coinZero: coinZero,
    cardArt: cardArt,
    sigil: sigil,
    SIGIL_KEYS: SIGIL_KEYS,
    rule: rule,
    candy: candy
  };
})(window);
