# Quantum Poker

> ### 🎃 IBM Quantum Fall Fest 2026
> This repository is a project made for **IBM Quantum Fall Fest 2026**.
> It is a fork of the original [Quantum Poker](https://github.com/sintefmath/QuantumPoker)
> by SINTEF, brought up to date so that it runs on current versions of Qiskit,
> NumPy, Matplotlib and Jupyter. Full attribution to the original authors and to
> the paper the game comes from is in
> [Credits and original work](#credits-and-original-work) at the bottom of this file.

This repository contains all the necessary components to learn and play quantum poker. The game works in the same way as Texas hold 'em poker with the main difference being that the community cards are replaced by qubits and the player cards are replaced by quantum logic gates. Don't fear if you don't understand the jargon, you can play the game anyway.
This implementation is a proof-of-concept, but it is fully possible to create apps for mobile phones or tablets.
We hope that you will enjoy the game and get curious to look "under the hood" and learn quantum computing!

![Quantum Poker](quantumpoker.jpg)

## Basic Rules to get started
In order to play the basic version of this game, one does not have to learn any quantum physics, or have a rigorous understanding of poker rules.  Even if this game involves only rudimentary essentials of quantum computing, people that are new to the field will find that it takes some time to get used to the rule set. Just as with any other game, one has to learn the rules of the game, which are described in the following.

At the start of every round of quantum poker, each player is given a randomized set of personal cards drawn from a deck of available cards. These personal cards can be viewed by pressing the button marked with "View Hand", and are shown in the leftmost coloumn. The rightmost coloumn shows the original deck of cards. These cards are not to be used until later in the game, and their use will be explained shortly.

Before any more information is revealed to the players, a round of betting takes place. Each player has a set amount of money at the start of the game, which switches hands as the game progresses. In each round of betting one needs to at least match the current highest bet to continue playing, but you could also raise the bet by putting more money on the table. This is done by either hitting the "Check"/"Call" button to match the bet, or entering an amount to raise the bet in the "Bet:" box and hitting enter. You can also fold and forfeit all the money you have betted so far in this round by hitting the "Fold" button. Note that two of the players automatically start with some money on the table, called blinds.

Three community cards are then revealed on the table. These cards have labels |0>, |1>, |->, or |+> as well as some probabilities. The P(1)-probability determines the chance that the card gets the value 1 at the end of the round. The goal for each player is to get as many 1's as possible at the end of the round. _Later_ in the game, the players will be able to apply their personal cards to these cards to change them. The community cards on the table can change their labels in a given way. For example the personal card X changes |0> to |1>, and H changes |-> to |1>. For a full list of transformations, see the table at the end of this file. If two community cards are marked with "Pair A", they influence each other. This can be undone by playing the CX card.

After the first three cards have been revealed, a second round of betting takes place, before another card is revealed. Then a third round of betting takes place, before the fifth and final card is revealed. Finally, a last round of betting takes place. After all players have finished betting, the players take turns applying their personal cards to the community cards, by first clicking on the personal card and the on the desired card. To apply the CX card the player needs to click on two qubits. Note that each player has their own cards, but that their initial values are shared by all players. After a player has used all their personal cards she wants to, she presses the "End" button to end her turn. Once all players are finished, each player's cards are giving either the value 0 or the value 1 based on the P(1)-probability shown on the card. The player(s) whose cards give the most 1's then wins the round, and takes all the money on the table. 

If a player has no money left on the table, he is out of the game, and the winner is the last person to have any money left.

## How to get started
The game needs Python 3.9 or newer and Qiskit. Every dependency is listed in
[requirements.txt](requirements.txt):

```bash
git clone https://github.com/abenehra21/QuantumPoker.git
cd QuantumPoker
python -m pip install -r requirements.txt
```

There are three ways to play or read about the game:

* **Run it locally** (fastest, recommended):

  ```bash
  python Python/runPoker.py
  ```

  A Matplotlib window opens and the terminal asks for the number of players and their initials.

* **Read the walkthrough.** The notebook [runPokerJN.ipynb](Python/runPokerJN.ipynb)
  plays through one complete round with commentary, explaining the quantum
  mechanics as it goes. It is the best place to start if you have never seen a
  qubit before.

* **Play in a notebook.** Open [runInteractivePokerJN.ipynb](Python/runInteractivePokerJN.ipynb)
  in Jupyter and run every cell. The interactive board is drawn with
  [ipympl](https://matplotlib.org/ipympl/), so make sure it is installed
  (it is in `requirements.txt`). Running the game in a notebook is noticeably
  slower than running `runPoker.py` directly. The notebook can also be opened
  straight from
  [Google Colab](https://colab.research.google.com/github/abenehra21/QuantumPoker/blob/master/Python/runInteractivePokerJN.ipynb),
  where it installs its own dependencies.

The game runs entirely on the local state-vector simulator built into Qiskit —
no IBM Quantum account, API token or hardware access is needed.

## Detailed description the game
Note that this section assumes rudementary knowledge of how to play the game. We advise trying a couple of rounds before reading this section.

The basic entity of a quantum computer is called a quantum bit or qubit. While a classical bit can be either 0 or 1, a qubit can also exist in a combination of both 0 and 1. This is called a "superposition". The "value" of a qubit is called a qubit state, and qubit states are often written in bra-ket notation, i.e. a qubit which has the value 1 would be written as being in the state |1>. An example of states that are in a superposition is the states denoted by |+> = |0> + |1> and |-> = |0> - |1>.

In order to obtain information on the state of qubits, they have to be measured. A measurement will collapse the state to a classical bit and return either 0 or 1.

When measuring a qubit in state |0> one will get the classical state 0 with 100% probability, and for |1> one will get 1 with 100% probability. When one measures a qubit in state |+> or |-> however, one will either get the classical value 0 or the value 1 with equal probability for each, i.e. 50% each.

At the start of the game, a set of 5 qubits is created, where each qubit is in a randomized state. Each player is then given a copy of this set, so that all players have an identical set of 5 qubits. The goal of the game is then to change the state of your own qubits, so that as many as possible of the qubits collapse to 1 upon being measured. Remember that a qubit in state |1> has a 100% chance to collapse to 1, while a qubit in state |0> has a 0% to collapse to 1. Note that the states of the qubits in the set are gradually revealed to the players between each round of betting.

This brings us to next important topic, how to change the state of the qubits. This can be achieved by applying a "gate" to one or more qubits. In this game there a total of 4 gates. 

The first gate is the X gate which changes |1> to |0> and |0> to |1>, but does nothing to |+> and |-> (The interested reader can check this against the definition of |+> and |->. Note that the phase is of no interested, i.e. -|->=|->). We write this as X|0>=|1> and X|1>=|0>.

We also have the Z gate which does nothing to the states |0> and |1>, but interchanges |+> and |->, i.e. Z|+>=|-> and Z|->=|+>, and the H gate which interchanges |0> and |+>, and |1> and |->. For a full breakdown see the table below.

Each player is dealt three random gates at the start of the game, which need not be the same as for any other player. When betting ends, each player uses his/her gates to change their qubits, to maximize the chance of measuring 1 for each qubit. The winner of the round is then the player with the most measured 1 between the 5 qubits. 

Another important effect in quantum computing is called entanglement. By this is meant that the measured value of two or more qubits is dependent on one another. For example both qubits might have a 50% chance to be measured to either 1 or to 0, but they will always be measured to the _same_ value. However, there is no way to know which value they will collapse to until one actually performs a measurment on at least one of the qubits. 

Two-qubit states are written as |q<sub>1</sub>q<sub>2</sub>>, where |q<sub>1</sub>> is the state of the first qubit, and |q<sub>2</sub>> is the state of the second. For example the state |00> means both the first and second qubit is in the state |0>. The entangled state described in the previous paragraph could be written as |00> + |11> or |00> - |11>. Both states look identical if you try to measure them directly, but will behave differently when you start applying gates. One could also have the entangled states |01> + |10> or |01> - |10>, in this case the two qubits will always be measured to different values, but again there is an equal probability for the two possibilities.

The last gate implemented in this game is the controlled NOT (CX) gate. This applies an X gate to the second qubit if the first qubit is in the state |1>, and does nothing when the first qubit is in the state |0>. For example the state |00> is unchanged upon apllying a CX gate as the first qubit is int the state |0>, but the state |10> changes to the state |11>. See the table below for a full overview of different possibilities when applying a CX gate.

The last thing is to note that all gates used here are their own inverse, i.e. applying a gate twice to a state will give the initial state again. However this is not the case for all possible gates.

## Table for effects of the different gates

#### Not gate X <br />
X|0> = |1> <br />
X|1> = |0> <br />
X|+> = |+> <br />
X|-> = |-> <br />

#### Hadamard gate H <br />
H|0> = |+> <br />
H|1> = |-> <br />
H|+> = |0> <br />
H|-> = |1> <br />

#### Phase flip gate Z <br />
Z|0> = |0> <br />
Z|1> = |1> <br />
Z|+> = |-> <br />
Z|-> = |+> <br />

#### Controlled Not gate CX<br />
CX|00> = |00> <br />
CX|01> = |01> <br />
CX|10> = |11> <br />
CX|11> = |10> <br />

CX|+0> = |00> + |11> <br />
CX|+1> = |01> + |10> <br />
CX|-0> = |00> - |11> <br />
CX|-1> = |01> - |10> <br />

CX|++> = |++> <br />
CX|+-> = |--> <br />
CX|-+> = |-+> <br />
CX|--> = |+-> <br />

CX|0+> = |0+> <br />
CX|0-> = |0-> <br />
CX|1+> = |1+> <br />
CX|1-> = |1-> <br />

A related game (by name) has been proposed here https://github.com/danielbultrini/Quantum-Hold-em-.

## Credits and original work

Quantum Poker was designed and written by **Franz G. Fuchs**, **Vemund Falch** and
**Christian Johnsen** at [SINTEF](https://www.sintef.no/). All of the game design,
the quantum mechanics behind it and the original implementation are theirs; this
repository is a fork that updates their code for current library versions.

**The paper.** The game is described in:

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

**The original project.** [github.com/sintefmath/QuantumPoker](https://github.com/sintefmath/QuantumPoker),
released under the GNU General Public License v3.0. This fork keeps the same
license, and the per-file copyright headers naming the original authors are left
intact.

### What this fork changes

Only the parts that had stopped working were touched — the rules, the board
layout and the physics are unchanged:

* Ported off the Qiskit APIs removed in Qiskit 1.0: `execute()`, `BasicAer` and
  `Aer` are gone, so the state vector now comes from
  `qiskit.quantum_info.Statevector` and the final measurement is sampled from it.
  The game no longer needs `qiskit-aer` at all.
* Replaced the removed `u3` gate with its modern equivalent, `u`.
* Replaced `numpy.in1d`, removed in NumPy 2.0, with `numpy.isin`.
* Fixed the `sys.path` setup so the modules import both from the repository root
  and from inside `Python/`, and dropped an unused `tkinter` import (`tkinter`
  is not always present in a Python build, and the game never used it).
* Made the deal reproducible: the same `seed` now always deals the same hands,
  independently of how much randomness Qiskit happens to consume internally.
* Updated the notebooks for Jupyter Notebook 7 / JupyterLab, where
  `%matplotlib notebook` no longer exists — the interactive board now uses
  `ipympl`. The walkthrough notebook was re-run so its figures match its text.
* Added [requirements.txt](requirements.txt).
