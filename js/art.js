/*
 * Candy Coven — art.js
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

  // A struck jack-o'-lantern, cut so the light falls through it.
  var FACE =
    '<path d="M20.5 32.5 L46 41.5 L22.5 53 Z"/>' +
    '<path d="M79.5 32.5 L54 41.5 L77.5 53 Z"/>' +
    '<path d="M50 44 L41.5 61 L58.5 61 Z"/>' +
    '<path d="M19 63.5 L31.5 69 L37.5 61.5 L45.5 70 L54.5 61.5 L62.5 69 L68.5 61.5 L81 64.5 ' +
      'L73.5 81.5 Q50 92 26.5 81.5 Z"/>';

  var SKULL =
    '<path d="M50 16c-18 0-29 12-29 28 0 9 4 15 8 19v10c0 4 3 6 6 6h30c3 0 6-2 6-6V63c4-4 8-10 8-19 0-16-11-28-29-28z" opacity=".22"/>' +
    '<ellipse cx="36" cy="45" rx="10" ry="10.5"/>' +
    '<ellipse cx="64" cy="45" rx="10" ry="10.5"/>' +
    '<path d="M50 53 L43 66 L57 66 Z"/>' +
    '<rect x="34.5" y="72" width="31" height="10.5" rx="2.5"/>' +
    '<rect x="44.3" y="72" width="2.8" height="10.5" fill="var(--coin-cut)"/>' +
    '<rect x="52.9" y="72" width="2.8" height="10.5" fill="var(--coin-cut)"/>';

  function coinFace() { return svg('0 0 100 100', FACE, 'ink'); }
  function coinSkull() { return svg('0 0 100 100', SKULL, 'ink'); }

  /* ---------------- the four cards ---------------- */

  var CARD_ART = {
    // Flip — a bat, wings spread.
    FLIP:
      '<path d="M50 30 L44 19 L37 27 Z"/><path d="M50 30 L56 19 L63 27 Z"/>' +
      '<ellipse cx="50" cy="45" rx="7.5" ry="14"/>' +
      '<path d="M43 37 C29 28 16 31 5 42 C14 42 17 48 15 55 C24 48 31 51 35 58 ' +
        'C39 50 41 45 43 49 Z"/>' +
      '<path d="M57 37 C71 28 84 31 95 42 C86 42 83 48 85 55 C76 48 69 51 65 58 ' +
        'C61 50 59 45 57 49 Z"/>' +
      '<path d="M47 58 L50 68 L53 58 Z"/>',

    // Haunt — a wisp rising off the table.
    HAUNT:
      '<path d="M50 14c-16 0-26 12-26 27v41l7-8 7 8 6-8 6 8 7-8 7 8V41c0-15-10-27-14-27z" opacity="0"/>' +
      '<path d="M50 13c-15 0-25 12-25 27v43l7.5-8.5 6.5 8.5 5.5-8 5.5 8 6.5-8.5 7.5 8.5V40c0-15-10-27-14-27z"/>' +
      '<ellipse cx="41" cy="40" rx="5" ry="6.5" fill="var(--card-ground)"/>' +
      '<ellipse cx="59" cy="40" rx="5" ry="6.5" fill="var(--card-ground)"/>' +
      '<path d="M44 56 q6 6 12 0" stroke="var(--card-ground)" stroke-width="3.5" fill="none" stroke-linecap="round"/>',

    // Summon — a lit candle. The flame is the only warm thing on the card.
    SUMMON:
      '<rect x="41" y="44" width="18" height="40" rx="2"/>' +
      '<path d="M34 84 h32 l3 8 h-38 z"/>' +
      '<rect x="48.5" y="36" width="3" height="9"/>' +
      '<path class="flame" d="M50 8 c7 12 12 17 12 24 a12 12 0 0 1-24 0 c0-7 5-12 12-24z"/>' +
      '<path class="flame-core" d="M50 22 c3 5 5 7 5 10 a5 5 0 0 1-10 0 c0-3 2-5 5-10z"/>' +
      '<path d="M41 50 q6 5 0 10 M59 58 q-5 5 0 10" stroke="var(--card-ground)" stroke-width="2.5" fill="none" opacity=".5"/>',

    // Bind — two links that will not come apart.
    BIND:
      '<g fill="none" stroke-width="9" stroke-linecap="round">' +
      '<ellipse cx="36" cy="38" rx="15" ry="23" transform="rotate(-28 36 38)"/>' +
      '<ellipse cx="64" cy="62" rx="15" ry="23" transform="rotate(-28 64 62)"/>' +
      '</g>'
  };

  function cardArt(id) {
    return svg('0 0 100 100', CARD_ART[id] || '', 'card-art');
  }

  /* ---------------- player sigils ---------------- */

  var SIGILS = {
    moon:      '<path d="M62 14a38 38 0 1 0 4 72 30 30 0 1 1-4-72z"/>' +
               '<circle cx="74" cy="30" r="3.5"/><circle cx="83" cy="46" r="2.5"/>',
    key:       '<circle cx="50" cy="27" r="15" fill="none" stroke-width="8"/>' +
               '<rect x="45.5" y="40" width="9" height="46" rx="2"/>' +
               '<rect x="54.5" y="58" width="14" height="8" rx="1.5"/>' +
               '<rect x="54.5" y="72" width="10" height="8" rx="1.5"/>',
    spider:    '<ellipse cx="50" cy="56" rx="15" ry="19"/><circle cx="50" cy="34" r="9"/>' +
               '<g fill="none" stroke-width="4.5" stroke-linecap="round">' +
               '<path d="M36 46 L18 34 L10 44"/><path d="M36 54 L14 54 L6 62"/>' +
               '<path d="M37 64 L18 74 L12 86"/><path d="M42 72 L34 86 L30 94"/>' +
               '<path d="M64 46 L82 34 L90 44"/><path d="M64 54 L86 54 L94 62"/>' +
               '<path d="M63 64 L82 74 L88 86"/><path d="M58 72 L66 86 L70 94"/></g>',
    eye:       '<path d="M6 50 C22 24 78 24 94 50 C78 76 22 76 6 50z" fill="none" stroke-width="7"/>' +
               '<circle cx="50" cy="50" r="17"/>' +
               '<circle cx="50" cy="50" r="7" fill="var(--seat-ground)"/>',
    hourglass: '<path d="M22 10 h56 v8 h-6 c0 16-14 24-14 32 s14 16 14 32 h6 v8 h-56 v-8 h6 ' +
               'c0-16 14-24 14-32 s-14-16-14-32 h-6z"/>' +
               '<path d="M38 68 q12-9 24 0 c0 8-24 8-24 0z" opacity=".55"/>'
  };

  var SIGIL_KEYS = ['moon', 'key', 'spider', 'eye', 'hourglass'];

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
    coinFace: coinFace,
    coinSkull: coinSkull,
    cardArt: cardArt,
    sigil: sigil,
    SIGIL_KEYS: SIGIL_KEYS,
    rule: rule,
    candy: candy
  };
})(window);
