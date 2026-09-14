/*
 * Quantum Poker — sound.js
 * Synthesised on the fly with WebAudio. No audio files, nothing to download.
 *
 * Everything is short, dry and low in the mix. A card game wants the click of
 * a chip and the ring of a coin, not a soundtrack.
 */
(function (global) {
  'use strict';

  var ctx = null;
  var master = null;
  var enabled = true;

  try { enabled = localStorage.getItem('cc_sound') !== '0'; } catch (e) { /* fine */ }

  /** Browsers only allow audio after a gesture, so build lazily on first play. */
  function audio() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    return ctx;
  }

  function ready() {
    if (!enabled) return null;
    var c = audio();
    if (!c) return null;
    if (c.state === 'suspended') c.resume();
    return c;
  }

  function tone(freq, start, dur, type, peak, endFreq) {
    var c = ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, start);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak || 0.3, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(master);
    o.start(start); o.stop(start + dur + 0.02);
  }

  /** Filtered noise — the body of every paper and fabric sound. */
  function noise(start, dur, freq, q, peak, type) {
    var c = ctx;
    var frames = Math.ceil(c.sampleRate * dur);
    var buf = c.createBuffer(1, frames, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    var src = c.createBufferSource(); src.buffer = buf;
    var filt = c.createBiquadFilter();
    filt.type = type || 'bandpass';
    filt.frequency.value = freq; filt.Q.value = q || 1;
    var g = c.createGain(); g.gain.value = peak || 0.3;
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(start);
  }

  var S = {
    /** A card sliding off the deck. */
    card: function () {
      var c = ready(); if (!c) return;
      noise(c.currentTime, 0.16, 2600, 0.8, 0.34, 'bandpass');
    },

    /** A coin struck and ringing. */
    coin: function (high) {
      var c = ready(); if (!c) return;
      var t = c.currentTime, base = high ? 1180 : 880;
      tone(base, t, 0.5, 'triangle', 0.22);
      tone(base * 2.76, t, 0.34, 'sine', 0.11);
      noise(t, 0.05, 5200, 2, 0.16);
    },

    /** A coin landing dead on the felt. */
    thud: function () {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      tone(150, t, 0.16, 'sine', 0.2, 70);
      noise(t, 0.09, 420, 0.7, 0.2, 'lowpass');
    },

    /** Candy pushed into the middle. */
    chip: function () {
      var c = ready(); if (!c) return;
      var t = c.currentTime, i;
      for (i = 0; i < 3; i++) noise(t + i * 0.035, 0.07, 1500 + i * 350, 3, 0.2);
    },

    /** Cards folded and pushed away. */
    fold: function () {
      var c = ready(); if (!c) return;
      noise(c.currentTime, 0.28, 900, 0.6, 0.26, 'lowpass');
    },

    /** A card played onto a coin. */
    cast: function () {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      tone(520, t, 0.22, 'triangle', 0.16, 1040);
      noise(t, 0.12, 3200, 1.2, 0.2);
    },

    /** The pot sliding to the winner. */
    win: function () {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      [523.25, 659.25, 783.99].forEach(function (f, i) {
        tone(f, t + i * 0.09, 0.55, 'triangle', 0.19);
      });
      noise(t + 0.18, 0.5, 1800, 0.6, 0.14);
    },

    /** A measurement. Everything in superposition stops being possible. */
    observe: function () {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      tone(1760, t, 0.14, 'sine', 0.14, 440);          // the wavefunction falling in
      noise(t + 0.04, 0.45, 900, 0.5, 0.2, 'lowpass');
      tone(110, t + 0.06, 0.7, 'triangle', 0.16);
    },

    /** Five ones. Everything came up coherent. */
    coherence: function () {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      [261.63, 311.13, 392.00, 466.16].forEach(function (f, i) {
        tone(f, t + i * 0.055, 1.5, 'sawtooth', 0.1);
        tone(f / 2, t + i * 0.055, 1.5, 'sine', 0.09);
      });
    },

    /** Knocked out. */
    bust: function () {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      tone(220, t, 0.7, 'sawtooth', 0.13, 70);
    },

    isOn: function () { return enabled; },

    toggle: function () {
      enabled = !enabled;
      try { localStorage.setItem('cc_sound', enabled ? '1' : '0'); } catch (e) { /* fine */ }
      if (enabled) S.coin();
      return enabled;
    }
  };

  global.Sound = S;
})(window);
