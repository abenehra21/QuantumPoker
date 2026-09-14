# Quantum Poker

**A card game of qubits, played for candy.** Built for **IBM Quantum Fall Fest 2026**.

Five qubits sit on the table as coins. At the end of the hand they all settle — on a 1
or a 0. Every coin showing a 1 is a point, most points takes the pot, and the pot is
made of chocolate. You bet, you bluff, you fold — exactly like poker.

The coins really are qubits and the cards really are quantum gates. Two of the cards
carry the circuit symbol a physicist would draw. You will not be told any of that while
you play unless you ask.

![The states a qubit on the table can be in](docs/coins.svg)

---

## Play it

No install, no build step, no server. Clone and open the file:

```bash
git clone https://github.com/abenehra21/QuantumPoker.git
cd QuantumPoker
open index.html          # or: python3 -m http.server, then visit localhost:8000
```

It runs entirely in the browser — two to five players, one device, passed around the
table. The table turns as play moves, so whoever is acting always sits at the near rail,
and a curtain covers the screen between turns so nobody sees a hand they shouldn't.
There is nothing to sign into and no IBM Quantum account needed; the quantum mechanics
is simulated locally in about sixty lines of JavaScript.

First time? Hit **Never played** on the title screen. A walk-through of about a minute and a half
plays: the coins land, the cards come out one at a time and do their thing, candy goes
into the pot, and the whole game is explained without a single ket. It can be paused,
scrubbed, and jumped by chapter, and it ends by offering either a practice hand or a
real one. It is also on the **?** menu at the table, for whoever wanders up halfway
through the evening.

It is not a video file. Every frame is the game's own art animated live, so it stays
sharp on a projector, loads instantly, and its captions are real selectable text rather
than burned-in pixels.

> Playing on a laptop with a projector works well for a crowd; playing on one phone
> passed around the table works better for four friends and a bowl of sweets.

---

## The candy

Everyone starts with **200 points** of real, physical candy:

| Sweet | Worth | You start with |
|---|--:|--:|
| Chocolate bar | 25 | 4 |
| Fun-size bar | 10 | 5 |
| Lollipop | 5 | 6 |
| Candy corn | 1 | 20 |

The app keeps score. The candy moves for real. Blinds start at 5/10 and **double every
six hands**, so a table finishes in twenty minutes or so instead of passing the same
lollipop around until midnight.

When someone finally busts, the **Settle up** screen tells you exactly which sweets
change hands — and it only ever hands out candy the table actually brought.

---

## The coins

Never mind kets and amplitudes. A coin is in one of four states, and you can see which
at a glance:

| Coin | Means | Odds |
|---|---|---|
| **Settled on 1** | Banked. A point in your pocket. | 100% |
| **Settled on 0** | Worth nothing, unless you turn it. | 0% |
| ↻ **Spinning clockwise** | Still undecided. | 50% |
| ↺ **Spinning counter-clockwise** | Also undecided — but the other way round. | 50% |

Which way a coin spins matters, because it decides which card can catch it. A settled
coin lies still; a spinning one turns, showing you its 1 face and its 0 face in turn,
because it is genuinely both until something measures it.

Two coins can also be **linked** — entangled — drawn with a glowing arc between them.
Linked coins always settle the same way, or always opposite. Link a coin you can control
to one you cannot, and you get two points for the price of one.

---

## Your cards

Three cards each, dealt face-down, played after the last round of betting.

| Card | Does | Gate |
|---|---|---|
| **Flip** | Turns a settled coin over. A spinning coin shrugs it off. | `X` |
| **Haunt** | Sets a settled coin spinning — or stops one that already is. | `H` |
| **Summon** | Catches a **clockwise** spin and pins it on 1. Your best card. | `ZH` |
| **Bind** | Links two coins so they settle together — or breaks a link. | `CNOT` |

Flip, Haunt and Bind undo themselves: play one twice on the same coin and nothing has
happened. **Summon is different.** It walks a coin around a four-step loop —
0 → ↻ → 1 → ↺ — so a second Summon on the same coin throws away the point you just won.

### And then there is the Observer

There is exactly one, and most hands do not contain it at all.

The Observer does not change a coin. It **measures** one — on every board at the table
at once. Whatever each player's copy of that coin was doing, it stops: superposition
gone, links broken, the value fixed where it fell.

Play it on a coin you have already settled on 1, and you keep your point while everyone
still holding that coin in superposition gets a coin toss and no way back. It is the
only card in the deck that reaches across the table, and it is the reason to stay in a
hand you are quietly winning.

Its face is the measurement gate from any quantum circuit diagram, because that is
exactly what it is.

Hovering a card over a coin tells you the exact outcome before you commit. If you would
rather not think, the **Hint** button plays the best card for you.

---

## A hand, start to finish

1. **The Deal** — blinds go in, cards are dealt face-down, first round of betting.
   No coins on the table yet; you are betting on nerve.
2. **The Reveal** — three coins turn over. Bet again.
3. **The Turn** — a fourth coin. Bet again.
4. **The Collapse** — the fifth and last coin. Final bet.
5. **Cards on the coins** — each player in turn plays whatever cards they like on
   *their own* copy of the board, behind a privacy curtain.
6. **Showdown** — every coin settles, one at a time. Count the ones.

| Coins on 1 | Rank |
|--:|---|
| 0 | Null |
| 1 | Spark |
| 2 | Pair |
| 3 | Cascade |
| 4 | Surge |
| 5 | **Coherence** |

---

## For the physicists

Press **ψ** at any time. Nerd Mode overlays the actual states — |0⟩, |1⟩, |+⟩, |−⟩, the
exact probabilities, and the gate behind each card:

Spinning is superposition, spin direction is relative phase, linked is a Bell pair, and
the Observer is a projective measurement — the branch that disagrees with the outcome is
zeroed and what remains renormalised, which is why it destroys entanglement it touches.
`js/quantum.js` is an exact state-vector simulator — 2ⁿ complex amplitudes with the real
unitaries applied to them, no shortcuts — so everything the table shows you is the true
quantum answer, including the entanglement detection, which projects each pair onto the
four Bell states.

Append `?seed=28521` to the URL to replay a specific game, and `?test` to run the
self-checks.

---

## What is in here

```
index.html          the game
css/style.css       the table — wood, felt, candlelight
js/quantum.js       state-vector simulator + board dealing
js/engine.js        candy, betting rounds, side pots, showdown
js/art.js           every mark on the table, drawn as SVG
js/sound.js         sound effects, synthesised — no audio files
js/tutorial.js      the how-to-play film: a cue timeline, not a video
js/ui.js            screens and interaction
js/tests.js         67 self-checks — open index.html?test
docs/coins.svg      the illustration at the top of this file
Python/             the original Qiskit implementation (see below)
```

Nothing is loaded from anywhere except the two fonts. The coins, the cards, the
sigils and the sweets are all SVG drawn in `art.js`; every sound is generated by
a WebAudio oscillator at the moment it plays. There is no image, no sprite sheet
and no audio file in the repository.

### Running the checks

Open **[index.html?test](index.html?test)** in a browser. It verifies the gate algebra
against the coin metaphor, that probability is conserved across ten thousand random
gates, that chained coins really do always land together, that side pots split correctly,
that 4 000 random finishes pay out in candy the table actually owns, and that 60
bot-played games conserve every last piece of it.

The tutorial film is checked too — that its cues are in order, that every card and coin
it shows is one the game really has, that a caption is on screen at every moment of its
running time, and that it ends on the pay-off.

---

## Credits and original work

This is a reworking of **Quantum Poker**, designed and written by **Franz G. Fuchs**,
**Vemund Falch** and **Christian Johnsen** at [SINTEF](https://www.sintef.no/). The
original game design and the quantum mechanics behind it are theirs. What is new here is
the presentation — the coin metaphor, the table, the candy stakes, a browser
implementation that needs no Python — and one addition to the rules: the Observer card,
which is not in the original.

**The paper:**

> Franz G. Fuchs, Vemund Falch and Christian Johnsen,
> *"Quantum Poker – a game for quantum computers suitable for benchmarking error
> mitigation techniques on NISQ devices"*,
> The European Physical Journal Plus **135**, 353 (2020).
> [doi:10.1140/epjp/s13360-020-00360-5](https://doi.org/10.1140/epjp/s13360-020-00360-5)
> · [arXiv:1908.00044](https://arxiv.org/abs/1908.00044)

```bibtex
@article{fuchs2020quantumpoker,
  title   = {Quantum Poker -- a game for quantum computers suitable for
             benchmarking error mitigation techniques on NISQ devices},
  author  = {Fuchs, Franz G. and Falch, Vemund and Johnsen, Christian},
  journal = {The European Physical Journal Plus},
  volume  = {135},
  number  = {4},
  pages   = {353},
  year    = {2020},
  doi     = {10.1140/epjp/s13360-020-00360-5},
  eprint  = {1908.00044},
  archivePrefix = {arXiv},
  primaryClass  = {quant-ph}
}
```

**The original project:**
[github.com/sintefmath/QuantumPoker](https://github.com/sintefmath/QuantumPoker).

### The original implementation lives on

`Python/` still holds the authors' Qiskit version, ported to run on current libraries
(Qiskit 2.x, NumPy 2.x, Matplotlib 3.x). It is the reference implementation and the one
tied to the paper's error-mitigation benchmarking, so it has been left intact rather than
replaced:

```bash
python -m pip install -r requirements.txt
python Python/runPoker.py
```

The notebook [Python/runPokerJN.ipynb](Python/runPokerJN.ipynb) walks through a complete
round with the physics explained properly. If this version gets someone curious, that is
where to send them next.

### What changed in the browser version

The rules are the same game; the framing is not.

- Qubits became coins struck with the value they would read, gates became cards, and
  every ket moved behind the Ψ toggle.
- The +/− basis toggle and the Bell-state inspector panels are gone — spin direction and
  a drawn chain say the same thing without a control panel.
- The unused `CH`, `SWAP`, `CCX`, `SRX`, `SRZ` and `Z` gates were dropped; the deck was
  always just four cards.
- Betting is now for candy, with escalating blinds and a settle-up screen.
- Hands got names, the showdown got an animation, and the rules got a tutorial.
- The Matplotlib window became a felt table under a candle: seats that orbit as the
  turn passes, cards that lean toward the cursor, coins that drop and ring when they
  land, and a pot that counts up rather than jumping.
- The rules got a film instead of a wall of text.
- A fifth card, the Observer, was added: the only one that reaches other players.

---

## License

GNU General Public License v3.0, the same as the original project. The per-file copyright
headers naming the original authors have been left where they are.
