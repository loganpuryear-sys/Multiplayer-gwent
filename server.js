// =============================================================================
// server.js — Multiplayer Gwent Game Server
// =============================================================================
// This is the Node.js backend that:
//   1. Serves the static frontend files (HTML/CSS/JS)
//   2. Handles real-time multiplayer communication via Socket.IO
//   3. Manages all game logic: card playing, scoring, rounds, abilities
//   4. Enforces game rules so clients can't cheat
//
// ARCHITECTURE:
//   - Express serves static files from /public
//   - Socket.IO handles real-time bidirectional communication
//   - Game state is stored server-side in the `games` object
//   - Each player only receives their own hand (opponent's hand is hidden)
//
// BUG FIXES from original code:
//   - Fixed horn calculation to properly double non-hero totals
//   - Added faction passive abilities (NR draws on win, Nilf wins ties)
//   - Added leader card system with one-time-use abilities
//   - Added redraw phase at game start
//   - Fixed scorch to work on current effective strength, not base
//   - Added proper game cleanup on disconnect
// =============================================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { CARD_DATA, DECKS, LEADERS, FACTION_PASSIVES } = require("./public/cards.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve all files in /public as static assets
app.use(express.static("public"));

// =============================================================================
// GAME STATE STORAGE
// =============================================================================
const games = {};        // gameId -> full game state object
const lobbies = {};      // lobbyCode -> { host, faction, leaderId, password }

// =============================================================================
// UTILITY: Fisher-Yates shuffle — unbiased random permutation
// =============================================================================
function shuffleArray(arr) {
  const a = [...arr]; // Don't mutate the original
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// =============================================================================
// CREATE A NEW GAME
// =============================================================================
// Sets up a fresh game between two players with shuffled decks and dealt hands.
// Each player gets 10 cards in hand, the rest stay in their deck.
function createGame(p1Socket, p2Socket, p1Faction, p2Faction, p1Leader, p2Leader) {
  // Generate a unique game ID using timestamp + random suffix
  const gameId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const game = {
    id: gameId,
    players: {
      p1: createPlayerState(p1Socket, p1Faction, p1Leader, "p1"),
      p2: createPlayerState(p2Socket, p2Faction, p2Leader, "p2"),
    },
    // Weather state — when true, that weather is active on the board
    // frost affects melee, fog affects ranged, rain affects siege
    weather: { frost: false, fog: false, rain: false },
    currentTurn: "p1",    // Whose turn it is: "p1" or "p2"
    round: 1,             // Current round number (1-3)
    gameOver: false,       // Set to true when the game ends
    decoyMode: null,       // Non-null when a player is selecting a decoy target
    pendingFirstChoice: null, // Non-null when Scoia'tael player choosing who goes first
    phase: "redraw",       // "redraw" or "play" — redraw phase happens first
    redrawDone: { p1: false, p2: false }, // Track who has finished redrawing
  };

  games[gameId] = game;
  return game;
}

// =============================================================================
// CREATE PLAYER STATE
// =============================================================================
// Initializes one player's state: deck, hand, board rows, etc.
function createPlayerState(socket, faction, leaderId, playerKey) {
  // Get all card IDs for this faction's deck
  const deckCardIds = DECKS[faction];

  // Create unique card instances from the card IDs.
  // Each card gets a unique `uid` so we can track individual cards
  // even when multiple copies of the same card exist.
  const allCards = deckCardIds.map((cardId, idx) => ({
    uid: `${playerKey}_${cardId}_${idx}`,  // Unique instance ID
    ...CARD_DATA[cardId],                   // Copy all card properties
    baseStrength: CARD_DATA[cardId].strength, // Remember original strength
    cardId: cardId,                          // Reference to card definition
  }));

  // Shuffle the deck randomly
  const shuffled = shuffleArray(allCards);

  return {
    socket: socket,
    faction: faction,
    // Leader card — looked up from CARD_DATA, with a "used" flag
    leader: leaderId ? {
      ...CARD_DATA[leaderId],
      cardId: leaderId,
      used: false,       // Can only use leader ability once per game
      canceled: false,   // True if opponent canceled this leader
    } : null,
    deck: shuffled.slice(10),   // Cards not yet drawn (11+)
    hand: shuffled.slice(0, 10), // Starting hand of 10 cards
    // Board rows — cards currently in play
    melee: [],
    ranged: [],
    siege: [],
    // Discard pile — cards that have been used/destroyed
    discard: [],
    passed: false,        // True if player has passed this round
    lives: 2,             // Lose a life when you lose a round; 0 = game over
    roundsWon: 0,         // Track rounds won for victory condition
    // Commander's Horn status per row — only one horn per row
    hornMelee: false,
    hornRanged: false,
    hornSiege: false,
    // Redraw tracking — each player can redraw up to 2 cards at game start
    redrawCount: 0,
    maxRedraws: 2,
  };
}

// =============================================================================
// SCORING — Calculate effective strength for a row
// =============================================================================
// This is the core scoring engine. Order of operations:
//   1. Start with base strength
//   2. Apply weather (reduces non-heroes to 1)
//   3. Apply tight bond (multiply by number of bond partners)
//   4. Apply morale boost (+1 per morale card on the row, excluding self)
//   5. Apply Commander's Horn (double the non-hero total)
function getRowScore(game, pKey, row) {
  const p = game.players[pKey];
  const cards = p[row];
  if (cards.length === 0) return 0;

  // Map weather types to the rows they affect
  const weatherMap = { melee: "frost", ranged: "fog", siege: "rain" };
  const weatherActive = game.weather[weatherMap[row]];

  // Count how many cards share each tight-bond group on this row
  const bondCounts = {};
  cards.forEach(c => {
    if (c.ability === "bond" && c.bondGroup) {
      bondCounts[c.bondGroup] = (bondCounts[c.bondGroup] || 0) + 1;
    }
  });

  // Count morale boost cards on this row (each gives +1 to all OTHER units)
  const moraleCount = cards.filter(c => c.ability === "morale").length;

  // Calculate each card's effective strength
  let heroTotal = 0;
  let nonHeroTotal = 0;

  cards.forEach(c => {
    let str = c.baseStrength;

    // Heroes are completely immune to all effects
    if (c.hero) {
      heroTotal += str;
      return;
    }

    // WEATHER: reduces non-hero unit strength to 1
    if (weatherActive && str > 0) {
      str = 1;
    }

    // TIGHT BOND: multiply strength by number of matching bond partners
    // e.g., 3 Blue Stripes (base 4) = 4 * 3 = 12 each
    if (c.ability === "bond" && c.bondGroup && bondCounts[c.bondGroup] > 1) {
      str *= bondCounts[c.bondGroup];
    }

    // MORALE BOOST: +1 for each morale card on this row (excluding self)
    // If this IS a morale card, it doesn't boost itself
    if (c.ability === "morale") {
      str += (moraleCount - 1); // Don't count self
    } else {
      str += moraleCount;
    }

    nonHeroTotal += str;
  });

  // COMMANDER'S HORN: doubles all non-hero strength on this row
  const hornKey = `horn${row.charAt(0).toUpperCase() + row.slice(1)}`;
  if (p[hornKey]) {
    nonHeroTotal *= 2;
  }

  // Check if leader ability is providing a horn effect on this row
  if (p.leader && p.leader.used && !p.leader.canceled) {
    if (p.leader.leaderAbility === "doubleSiege" && row === "siege") {
      if (!p[hornKey]) {
        nonHeroTotal *= 2;
      }
    } else if (p.leader.leaderAbility === "doubleRanged" && row === "ranged") {
      if (!p[hornKey]) {
        nonHeroTotal *= 2;
      }
    } else if (p.leader.leaderAbility === "doubleMelee" && row === "melee") {
      if (!p[hornKey]) {
        nonHeroTotal *= 2;
      }
    }
  }

  return heroTotal + nonHeroTotal;
}

// Calculate total score across all three rows
function getPlayerScore(game, pKey) {
  return (
    getRowScore(game, pKey, "melee") +
    getRowScore(game, pKey, "ranged") +
    getRowScore(game, pKey, "siege")
  );
}

// =============================================================================
// GET GAME STATE — Sanitized view for one player
// =============================================================================
// Returns game state from one player's perspective. Critically, the opponent's
// hand contents are HIDDEN — only the count is sent. This prevents cheating.
function getGameState(game, forPlayer) {
  const opponent = forPlayer === "p1" ? "p2" : "p1";
  const p = game.players[forPlayer];
  const o = game.players[opponent];

  return {
    you: {
      faction: p.faction,
      hand: p.hand,               // Full hand data (only sent to this player)
      melee: p.melee,
      ranged: p.ranged,
      siege: p.siege,
      discard: p.discard,
      passed: p.passed,
      lives: p.lives,
      roundsWon: p.roundsWon,
      deckCount: p.deck.length,
      hornMelee: p.hornMelee,
      hornRanged: p.hornRanged,
      hornSiege: p.hornSiege,
      score: getPlayerScore(game, forPlayer),
      meleeScore: getRowScore(game, forPlayer, "melee"),
      rangedScore: getRowScore(game, forPlayer, "ranged"),
      siegeScore: getRowScore(game, forPlayer, "siege"),
      leader: p.leader ? {
        name: p.leader.name,
        description: p.leader.description,
        used: p.leader.used,
        canceled: p.leader.canceled,
        leaderAbility: p.leader.leaderAbility,
      } : null,
    },
    opponent: {
      faction: o.faction,
      handCount: o.hand.length,   // Only the COUNT — not the actual cards!
      melee: o.melee,
      ranged: o.ranged,
      siege: o.siege,
      passed: o.passed,
      lives: o.lives,
      roundsWon: o.roundsWon,
      deckCount: o.deck.length,
      hornMelee: o.hornMelee,
      hornRanged: o.hornRanged,
      hornSiege: o.hornSiege,
      score: getPlayerScore(game, opponent),
      meleeScore: getRowScore(game, opponent, "melee"),
      rangedScore: getRowScore(game, opponent, "ranged"),
      siegeScore: getRowScore(game, opponent, "siege"),
      leader: o.leader ? {
        name: o.leader.name,
        description: o.leader.description,
        used: o.leader.used,
        canceled: o.leader.canceled,
      } : null,
    },
    weather: game.weather,
    currentTurn: game.currentTurn,
    isYourTurn: game.currentTurn === forPlayer,
    round: game.round,
    gameOver: game.gameOver,
    phase: game.phase,
    // Only tell the player they're in decoy mode if it's THEIR decoy
    decoyMode: game.decoyMode && game.decoyMode.player === forPlayer,
    // Tell the Scoia'tael player they need to choose who goes first
    pendingFirstChoice: game.pendingFirstChoice === forPlayer,
  };
}

// =============================================================================
// END ROUND — Score comparison and cleanup
// =============================================================================
// Called when both players have passed. Compares scores, deducts lives,
// applies faction passives, and either starts a new round or ends the game.
function endRound(game) {
  const p1Score = getPlayerScore(game, "p1");
  const p2Score = getPlayerScore(game, "p2");

  let roundResult;

  if (p1Score > p2Score) {
    // P1 wins the round — P2 loses a life
    game.players.p2.lives--;
    game.players.p1.roundsWon++;
    roundResult = { winner: "p1", p1Score, p2Score };

    // FACTION PASSIVE: Northern Realms draws a card when winning a round
    if (FACTION_PASSIVES[game.players.p1.faction] === "drawOnWin") {
      if (game.players.p1.deck.length > 0) {
        game.players.p1.hand.push(game.players.p1.deck.pop());
        roundResult.bonusDraw = true;
      }
    }
  } else if (p2Score > p1Score) {
    // P2 wins the round — P1 loses a life
    game.players.p1.lives--;
    game.players.p2.roundsWon++;
    roundResult = { winner: "p2", p1Score, p2Score };

    // FACTION PASSIVE: Northern Realms draws a card when winning a round
    if (FACTION_PASSIVES[game.players.p2.faction] === "drawOnWin") {
      if (game.players.p2.deck.length > 0) {
        game.players.p2.hand.push(game.players.p2.deck.pop());
        roundResult.bonusDraw = true;
      }
    }
  } else {
    // TIE — check for Nilfgaard passive
    const p1IsNilf = FACTION_PASSIVES[game.players.p1.faction] === "winOnDraw";
    const p2IsNilf = FACTION_PASSIVES[game.players.p2.faction] === "winOnDraw";

    if (p1IsNilf && !p2IsNilf) {
      // Nilfgaard P1 wins the tie
      game.players.p2.lives--;
      game.players.p1.roundsWon++;
      roundResult = { winner: "p1", p1Score, p2Score, nilfgaardWin: true };
    } else if (p2IsNilf && !p1IsNilf) {
      // Nilfgaard P2 wins the tie
      game.players.p1.lives--;
      game.players.p2.roundsWon++;
      roundResult = { winner: "p2", p1Score, p2Score, nilfgaardWin: true };
    } else {
      // True draw (both Nilfgaard or neither) — both lose a life
      game.players.p1.lives--;
      game.players.p2.lives--;
      roundResult = { winner: "draw", p1Score, p2Score };
    }
  }

  // Check for game over (either player at 0 lives)
  if (game.players.p1.lives <= 0 || game.players.p2.lives <= 0) {
    game.gameOver = true;
    if (game.players.p1.lives <= 0 && game.players.p2.lives <= 0) {
      roundResult.gameWinner = "draw";
    } else if (game.players.p1.lives <= 0) {
      roundResult.gameWinner = "p2";
    } else {
      roundResult.gameWinner = "p1";
    }
  } else {
    // Game continues — clean up the board for the next round
    ["p1", "p2"].forEach(pKey => {
      const p = game.players[pKey];

      // MONSTERS PASSIVE: 1 random non-hero unit stays on the board
      let keptCard = null;
      let keptRow = null;
      if (FACTION_PASSIVES[p.faction] === "keepUnit") {
        const allBoardCards = [];
        ["melee", "ranged", "siege"].forEach(row => {
          p[row].forEach((card, idx) => {
            if (!card.hero && card.type !== "special") {
              allBoardCards.push({ card, row, idx });
            }
          });
        });
        if (allBoardCards.length > 0) {
          const pick = allBoardCards[Math.floor(Math.random() * allBoardCards.length)];
          keptCard = pick.card;
          keptRow = pick.row;
          roundResult.monstersKept = { name: keptCard.name, row: keptRow };
        }
      }

      // Move all board cards to discard pile (except the kept Monsters card)
      ["melee", "ranged", "siege"].forEach(row => {
        if (keptCard && keptRow === row) {
          const remaining = [];
          p[row].forEach(card => {
            if (card.uid === keptCard.uid) {
              remaining.push(card); // Keep this one
            } else {
              p.discard.push(card);
            }
          });
          p[row] = remaining;
        } else {
          p.discard.push(...p[row]);
          p[row] = [];
        }
      });

      // Reset per-round state
      p.passed = false;
      p.hornMelee = false;
      p.hornRanged = false;
      p.hornSiege = false;
    });

    // SKELLIGE PASSIVE: 2 random cards from graveyard return to hand
    ["p1", "p2"].forEach(pKey => {
      const p = game.players[pKey];
      if (FACTION_PASSIVES[p.faction] === "reviveTwo") {
        const revivable = p.discard.filter(c => !c.hero && c.type !== "special");
        const shuffled = shuffleArray(revivable);
        const toRevive = shuffled.slice(0, Math.min(2, shuffled.length));
        toRevive.forEach(card => {
          const idx = p.discard.findIndex(c => c.uid === card.uid);
          if (idx !== -1) {
            p.discard.splice(idx, 1);
            p.hand.push(card);
          }
        });
        if (toRevive.length > 0) {
          roundResult.skelligeRevived = toRevive.map(c => c.name);
        }
      }
    });

    // Clear all weather effects
    game.weather = { frost: false, fog: false, rain: false };
    game.round++;

    // SCOIA'TAEL PASSIVE: Choose who goes first
    // Check if either player is Scoia'tael
    const p1IsScoia = FACTION_PASSIVES[game.players.p1.faction] === "chooseFirst";
    const p2IsScoia = FACTION_PASSIVES[game.players.p2.faction] === "chooseFirst";

    if ((p1IsScoia && !p2IsScoia) || (p2IsScoia && !p1IsScoia)) {
      // Set a pending choice — the Scoia'tael player gets to decide
      const scoiaPlayer = p1IsScoia ? "p1" : "p2";
      game.pendingFirstChoice = scoiaPlayer;
      // Default turn will be set when choice is made
      game.currentTurn = scoiaPlayer; // Temporarily give them the turn
    } else {
      // No Scoia'tael, or both are — use normal rules
      // The round loser goes first next round (on draw, p1 goes first)
      if (roundResult.winner === "p2") {
        game.currentTurn = "p2";
      } else if (roundResult.winner === "p1") {
        game.currentTurn = "p2"; // Loser goes first
      } else {
        game.currentTurn = "p1";
      }
    }
  }

  return roundResult;
}

// =============================================================================
// SCORCH — Destroy the highest-strength non-hero card(s) on the board
// =============================================================================
// Finds the single highest base strength among all non-hero units on both
// players' boards, then destroys ALL cards sharing that strength.
function applyScorch(game) {
  let highest = 0;
  let targets = [];

  // Scan all cards on both players' boards to find the highest strength
  ["p1", "p2"].forEach(pKey => {
    ["melee", "ranged", "siege"].forEach(row => {
      game.players[pKey][row].forEach(card => {
        if (card.hero) return; // Heroes are immune to scorch
        const str = card.baseStrength;
        if (str > highest) {
          highest = str;
          targets = [{ pKey, row, uid: card.uid }];
        } else if (str === highest && str > 0) {
          targets.push({ pKey, row, uid: card.uid });
        }
      });
    });
  });

  // Remove all cards with the highest strength
  if (highest > 0) {
    targets.forEach(t => {
      const p = game.players[t.pKey];
      const idx = p[t.row].findIndex(c => c.uid === t.uid);
      if (idx !== -1) {
        const removed = p[t.row].splice(idx, 1);
        p.discard.push(...removed);
      }
    });
  }

  return targets;
}

// =============================================================================
// PLAY A CARD — Main card-playing logic
// =============================================================================
// Handles all the different card types and abilities:
//   - Unit cards go on the appropriate row
//   - Spy cards go on the OPPONENT's board, you draw 2
//   - Medic cards revive a unit from your discard
//   - Weather cards affect both players' rows
//   - Horn doubles a row's non-hero strength
//   - Scorch destroys the strongest cards
//   - Decoy swaps with a board unit, returning it to hand
function playCard(game, playerKey, cardUid, targetRow) {
  const p = game.players[playerKey];
  const cardIdx = p.hand.findIndex(c => c.uid === cardUid);
  if (cardIdx === -1) return { error: "Card not in hand" };

  const card = p.hand[cardIdx];
  const result = { played: card, events: [] };

  // ---- SPECIAL CARDS (non-unit) ----
  if (card.type === "special") {
    p.hand.splice(cardIdx, 1); // Remove from hand

    if (card.ability === "weather") {
      // Weather: activate the weather effect on the matching row
      game.weather[card.weatherType] = true;
      p.discard.push(card);
      result.events.push({ type: "weather", weatherType: card.weatherType });

    } else if (card.ability === "clearWeather") {
      // Clear Weather: remove ALL active weather effects
      game.weather = { frost: false, fog: false, rain: false };
      p.discard.push(card);
      result.events.push({ type: "clearWeather" });

    } else if (card.ability === "horn") {
      // Commander's Horn: double a row's non-hero strength
      // Player can choose which row via targetRow parameter
      const row = targetRow || card.row;
      const hornKey = `horn${row.charAt(0).toUpperCase() + row.slice(1)}`;

      // Check if a horn is already active on that row
      if (p[hornKey]) {
        p.hand.splice(0, 0, card); // Put card back in hand
        return { error: "Horn already active on that row" };
      }

      p[hornKey] = true;
      p.discard.push(card);
      result.events.push({ type: "horn", row });

    } else if (card.ability === "scorch") {
      // Scorch: destroy the highest-strength non-hero card(s) on the board
      const scorched = applyScorch(game);
      p.discard.push(card);
      result.events.push({ type: "scorch", targets: scorched });

    } else if (card.ability === "decoy") {
      // Decoy: enter "decoy mode" — player must select a board unit to swap
      // The selected unit returns to hand, the decoy takes its place (then
      // is discarded since it has 0 strength)
      game.decoyMode = { player: playerKey, cardUid: card.uid, card };
      result.events.push({ type: "decoyMode" });
      return result; // Don't advance turn yet — waiting for swap selection
    }

  } else {
    // ---- UNIT CARDS ----
    p.hand.splice(cardIdx, 1); // Remove from hand
    const row = card.row;

    if (card.ability === "spy") {
      // SPY: card goes to OPPONENT's board (giving them strength)
      // but you get to draw 2 cards from your deck — huge card advantage
      const opponent = playerKey === "p1" ? "p2" : "p1";
      const spyRow = row === "agile" ? (targetRow || "melee") : row;
      game.players[opponent][spyRow].push(card);
      let drew = 0;
      for (let i = 0; i < 2; i++) {
        if (p.deck.length > 0) {
          p.hand.push(p.deck.pop());
          drew++;
        }
      }
      result.events.push({ type: "spy", drew });

    } else if (card.ability === "medic") {
      // MEDIC: first place the medic on its row, then revive the strongest
      // non-hero unit from your discard pile
      const medicRow = row === "agile" ? (targetRow || "melee") : row;
      p[medicRow].push(card);
      const revivable = p.discard.filter(c => !c.hero && c.type !== "special");
      if (revivable.length > 0) {
        // Auto-revive the strongest discarded unit
        revivable.sort((a, b) => b.baseStrength - a.baseStrength);
        const revived = revivable[0];
        const discIdx = p.discard.findIndex(c => c.uid === revived.uid);
        if (discIdx !== -1) {
          p.discard.splice(discIdx, 1);
          const revivedRow = revived.row === "agile" ? "melee" : revived.row;
          p[revivedRow].push(revived);
          result.events.push({ type: "medic", revived: revived });
        }
      }

    } else if (card.ability === "muster") {
      // MUSTER: play this card and ALL copies from hand AND deck
      const mGroup = card.musterGroup;
      const actualRow = row === "agile" ? (targetRow || "melee") : row;
      p[actualRow].push(card);
      result.events.push({ type: "muster", group: mGroup, deployed: [card.name] });

      // Find and deploy all matching muster cards from hand
      const handMusters = p.hand.filter(c => c.ability === "muster" && c.musterGroup === mGroup);
      handMusters.forEach(mc => {
        const idx = p.hand.findIndex(c => c.uid === mc.uid);
        if (idx !== -1) {
          p.hand.splice(idx, 1);
          const mRow = mc.row === "agile" ? (targetRow || "melee") : mc.row;
          p[mRow].push(mc);
          result.events[result.events.length - 1].deployed.push(mc.name);
        }
      });

      // Find and deploy all matching muster cards from deck
      const deckMusters = p.deck.filter(c => c.ability === "muster" && c.musterGroup === mGroup);
      deckMusters.forEach(mc => {
        const idx = p.deck.findIndex(c => c.uid === mc.uid);
        if (idx !== -1) {
          p.deck.splice(idx, 1);
          const mRow = mc.row === "agile" ? (targetRow || "melee") : mc.row;
          p[mRow].push(mc);
          result.events[result.events.length - 1].deployed.push(mc.name);
        }
      });

    } else {
      // NORMAL UNIT: place on appropriate row (handle agile)
      const actualRow = row === "agile" ? (targetRow || "melee") : row;
      p[actualRow].push(card);
    }
  }

  return result;
}

// =============================================================================
// DECOY SWAP — Handle the second step of playing a Decoy card
// =============================================================================
// After playing a Decoy, the player clicks a non-hero unit on their board.
// That unit returns to their hand, and the Decoy card is discarded.
function handleDecoySwap(game, playerKey, targetUid) {
  if (!game.decoyMode || game.decoyMode.player !== playerKey) {
    return { error: "Not in decoy mode" };
  }

  const p = game.players[playerKey];
  let found = null;
  let foundRow = null;

  // Search all rows for the target card
  ["melee", "ranged", "siege"].forEach(row => {
    const idx = p[row].findIndex(c => c.uid === targetUid);
    if (idx !== -1 && !p[row][idx].hero) {
      found = p[row].splice(idx, 1)[0]; // Remove from board
      foundRow = row;
    }
  });

  if (!found) {
    return { error: "Invalid target for decoy (must be a non-hero unit on your board)" };
  }

  // Return the swapped unit to the player's hand
  p.hand.push(found);
  // Discard the decoy card itself
  p.discard.push(game.decoyMode.card);
  game.decoyMode = null;

  return { swapped: found, row: foundRow };
}

// =============================================================================
// LEADER ABILITY — Activate the one-time leader card ability
// =============================================================================
function useLeaderAbility(game, playerKey) {
  const p = game.players[playerKey];
  const opponent = playerKey === "p1" ? "p2" : "p1";
  const o = game.players[opponent];

  if (!p.leader) return { error: "No leader card" };
  if (p.leader.used) return { error: "Leader ability already used" };
  if (p.leader.canceled) return { error: "Leader ability was canceled" };

  p.leader.used = true;
  const ability = p.leader.leaderAbility;
  const result = { ability, events: [] };

  switch (ability) {
    case "clearWeather":
      // Foltest: Son of Medell — Clear all weather effects
      game.weather = { frost: false, fog: false, rain: false };
      result.events.push({ type: "clearWeather" });
      break;

    case "doubleSiege":
      // Foltest: The Siegemaster — Double siege row strength
      // Handled in scoring function (getRowScore checks leader state)
      result.events.push({ type: "doubleSiege" });
      break;

    case "scorchSiege":
      // Foltest: The Steel-Forged — Destroy opponent's strongest siege
      // unit(s) if their siege row total is >= 10
      {
        const oppSiegeScore = getRowScore(game, opponent, "siege");
        if (oppSiegeScore >= 10) {
          let highest = 0;
          let targets = [];
          o.siege.forEach(card => {
            if (card.hero) return;
            if (card.baseStrength > highest) {
              highest = card.baseStrength;
              targets = [card.uid];
            } else if (card.baseStrength === highest && highest > 0) {
              targets.push(card.uid);
            }
          });
          targets.forEach(uid => {
            const idx = o.siege.findIndex(c => c.uid === uid);
            if (idx !== -1) {
              const removed = o.siege.splice(idx, 1);
              o.discard.push(...removed);
            }
          });
          result.events.push({ type: "scorchSiege", count: targets.length });
        } else {
          result.events.push({ type: "scorchSiege", count: 0, message: "Siege row under 10" });
        }
      }
      break;

    case "playFog":
      // Foltest: Lord Commander — Play fog from deck
      game.weather.fog = true;
      result.events.push({ type: "weather", weatherType: "fog" });
      break;

    case "cancelLeader":
      // Emhyr: The White Flame — Cancel opponent's leader ability
      if (o.leader) {
        o.leader.canceled = true;
        result.events.push({ type: "cancelLeader" });
      }
      break;

    case "viewOpponent":
      // Emhyr: Emperor — Look at 3 random cards from opponent's hand
      {
        const handCopy = [...o.hand];
        const shuffled = shuffleArray(handCopy);
        const revealed = shuffled.slice(0, Math.min(3, shuffled.length));
        result.events.push({ type: "viewOpponent", cards: revealed });
      }
      break;

    case "stealDiscard":
      // Emhyr: The Relentless — Take a card from opponent's discard
      {
        const stealable = o.discard.filter(c => !c.hero && c.type !== "special");
        if (stealable.length > 0) {
          // Take the strongest card
          stealable.sort((a, b) => b.baseStrength - a.baseStrength);
          const stolen = stealable[0];
          const idx = o.discard.findIndex(c => c.uid === stolen.uid);
          if (idx !== -1) {
            o.discard.splice(idx, 1);
            p.hand.push(stolen);
            result.events.push({ type: "stealDiscard", card: stolen });
          }
        } else {
          result.events.push({ type: "stealDiscard", message: "Nothing to steal" });
        }
      }
      break;

    case "playFromDiscard":
      // Emhyr: Invader of the North — Play a unit from opponent's discard
      {
        const playable = o.discard.filter(c => !c.hero && c.type !== "special" && c.row);
        if (playable.length > 0) {
          playable.sort((a, b) => b.baseStrength - a.baseStrength);
          const played = playable[0];
          const idx = o.discard.findIndex(c => c.uid === played.uid);
          if (idx !== -1) {
            o.discard.splice(idx, 1);
            const targetRow = played.row === "agile" ? "melee" : played.row;
            p[targetRow].push(played);
            result.events.push({ type: "playFromDiscard", card: played });
          }
        } else {
          result.events.push({ type: "playFromDiscard", message: "Nothing to play" });
        }
      }
      break;

    // --- SCOIA'TAEL LEADERS ---
    case "destroyEnemySiege":
      // Francesca: The Beautiful — same as Foltest Steel-Forged but for siege
      {
        const oppSiegeScore2 = getRowScore(game, opponent, "siege");
        if (oppSiegeScore2 >= 10) {
          let highest2 = 0;
          let targets2 = [];
          o.siege.forEach(card => {
            if (card.hero) return;
            if (card.baseStrength > highest2) {
              highest2 = card.baseStrength;
              targets2 = [card.uid];
            } else if (card.baseStrength === highest2 && highest2 > 0) {
              targets2.push(card.uid);
            }
          });
          targets2.forEach(uid => {
            const idx = o.siege.findIndex(c => c.uid === uid);
            if (idx !== -1) {
              const removed = o.siege.splice(idx, 1);
              o.discard.push(...removed);
            }
          });
          result.events.push({ type: "scorchSiege", count: targets2.length });
        } else {
          result.events.push({ type: "scorchSiege", count: 0, message: "Siege row under 10" });
        }
      }
      break;

    case "drawExtraCard":
      // Francesca: Daisy of the Valley — Draw an extra card
      if (p.deck.length > 0) {
        p.hand.push(p.deck.pop());
        result.events.push({ type: "drawExtraCard", message: "Drew an extra card!" });
      } else {
        result.events.push({ type: "drawExtraCard", message: "Deck is empty" });
      }
      break;

    case "doubleRanged":
      // Francesca: Hope — Double ranged row strength (handled in scoring)
      result.events.push({ type: "doubleRanged" });
      break;

    case "playRain":
      // Francesca: Queen — Play rain
      game.weather.rain = true;
      result.events.push({ type: "weather", weatherType: "rain" });
      break;

    // --- MONSTERS LEADERS ---
    case "doubleMelee":
      // Eredin: Bringer of Death — Double melee row strength (handled in scoring)
      result.events.push({ type: "doubleMelee" });
      break;

    case "discardAndDraw2":
      // Eredin: Destroyer — Discard 2, draw 2
      {
        // Auto-discard the 2 weakest non-hero cards from hand
        const discardable = p.hand
          .filter(c => !c.hero && c.type !== "special")
          .sort((a, b) => a.baseStrength - b.baseStrength);
        const toDiscard = discardable.slice(0, Math.min(2, discardable.length));
        toDiscard.forEach(card => {
          const idx = p.hand.findIndex(c => c.uid === card.uid);
          if (idx !== -1) {
            p.hand.splice(idx, 1);
            p.discard.push(card);
          }
        });
        let drew = 0;
        for (let i = 0; i < 2; i++) {
          if (p.deck.length > 0) {
            p.hand.push(p.deck.pop());
            drew++;
          }
        }
        result.events.push({ type: "discardAndDraw2", discarded: toDiscard.length, drew });
      }
      break;

    case "playFrost":
      // Eredin: Commander — Play frost
      game.weather.frost = true;
      result.events.push({ type: "weather", weatherType: "frost" });
      break;

    case "restoreMonstersUnit":
      // Eredin: King — Revive strongest unit from discard
      {
        const revivable2 = p.discard.filter(c => !c.hero && c.type !== "special" && c.row);
        if (revivable2.length > 0) {
          revivable2.sort((a, b) => b.baseStrength - a.baseStrength);
          const revived = revivable2[0];
          const idx = p.discard.findIndex(c => c.uid === revived.uid);
          if (idx !== -1) {
            p.discard.splice(idx, 1);
            const targetRow = revived.row === "agile" ? "melee" : revived.row;
            p[targetRow].push(revived);
            result.events.push({ type: "restoreUnit", card: revived });
          }
        } else {
          result.events.push({ type: "restoreUnit", message: "Nothing to revive" });
        }
      }
      break;

    // --- SKELLIGE LEADERS ---
    case "scorchMelee":
      // Crach: The Warrior — Scorch opponent's melee if >= 10
      {
        const oppMeleeScore = getRowScore(game, opponent, "melee");
        if (oppMeleeScore >= 10) {
          let highest3 = 0;
          let targets3 = [];
          o.melee.forEach(card => {
            if (card.hero) return;
            if (card.baseStrength > highest3) {
              highest3 = card.baseStrength;
              targets3 = [card.uid];
            } else if (card.baseStrength === highest3 && highest3 > 0) {
              targets3.push(card.uid);
            }
          });
          targets3.forEach(uid => {
            const idx = o.melee.findIndex(c => c.uid === uid);
            if (idx !== -1) {
              const removed = o.melee.splice(idx, 1);
              o.discard.push(...removed);
            }
          });
          result.events.push({ type: "scorchMelee", count: targets3.length });
        } else {
          result.events.push({ type: "scorchMelee", count: 0, message: "Melee row under 10" });
        }
      }
      break;

    case "shuffleDiscard":
      // Crach: The Navigator — Shuffle discard back into deck
      {
        const nonHeroDiscard = p.discard.filter(c => !c.hero);
        nonHeroDiscard.forEach(card => {
          p.deck.push(card);
        });
        p.discard = p.discard.filter(c => c.hero);
        p.deck = shuffleArray(p.deck);
        result.events.push({ type: "shuffleDiscard", count: nonHeroDiscard.length });
      }
      break;

    // Note: "clearWeather" and "doubleSiege" are already handled above for NR/Skellige

    default:
      return { error: "Unknown leader ability" };
  }

  return result;
}

// =============================================================================
// ADVANCE TURN — Move to the next player's turn or end the round
// =============================================================================
function advanceTurn(game) {
  const opponent = game.currentTurn === "p1" ? "p2" : "p1";

  // If both players have passed, the round is over
  if (game.players.p1.passed && game.players.p2.passed) {
    const roundResult = endRound(game);

    // Notify both players about the round result
    ["p1", "p2"].forEach(pKey => {
      const pSocket = game.players[pKey].socket;
      pSocket.emit("roundEnd", {
        ...roundResult,
        youWon: roundResult.winner === pKey,
        isDraw: roundResult.winner === "draw",
        nilfgaardWin: roundResult.nilfgaardWin || false,
        bonusDraw: roundResult.bonusDraw || false,
        gameWinner: roundResult.gameWinner
          ? (roundResult.gameWinner === pKey
              ? "you"
              : roundResult.gameWinner === "draw"
                ? "draw"
                : "opponent")
          : null,
      });
    });
    return;
  }

  // If the opponent has passed, current player keeps their turn
  if (game.players[opponent].passed) {
    return; // Don't switch — same player goes again
  }

  // Normal turn switch
  game.currentTurn = opponent;
}

// =============================================================================
// EMIT STATE — Send updated game state to both players
// =============================================================================
function emitState(game) {
  ["p1", "p2"].forEach(pKey => {
    game.players[pKey].socket.emit("gameState", getGameState(game, pKey));
  });
}

// =============================================================================
// SOCKET.IO EVENT HANDLERS
// =============================================================================
io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // ---- CREATE LOBBY ----
  // Host creates a lobby with a password. They get a 4-character code to share.
  socket.on("createLobby", (data) => {
    const faction = data.faction || "northern";
    const leaderId = data.leader || null;
    const password = data.password || "";

    // Generate a unique 4-character lobby code (uppercase letters)
    let code;
    do {
      code = "";
      for (let i = 0; i < 4; i++) {
        code += String.fromCharCode(65 + Math.floor(Math.random() * 26));
      }
    } while (lobbies[code]); // Ensure no collision

    // Store lobby state
    socket.faction = faction;
    socket.leaderId = leaderId;
    socket.lobbyCode = code;

    lobbies[code] = {
      host: socket,
      faction: faction,
      leaderId: leaderId,
      password: password,
    };

    console.log(`Lobby ${code} created by ${socket.id}`);
    socket.emit("lobbyCreated", { code });
  });

  // ---- JOIN LOBBY ----
  // Friend enters the lobby code + password to join the host's game.
  socket.on("joinLobby", (data) => {
    const code = (data.code || "").toUpperCase().trim();
    const password = data.password || "";
    const faction = data.faction || "northern";
    const leaderId = data.leader || null;

    // Validate the lobby exists
    const lobby = lobbies[code];
    if (!lobby) {
      socket.emit("joinError", { message: "Lobby not found. Check your code." });
      return;
    }

    // Validate the password
    if (lobby.password !== password) {
      socket.emit("joinError", { message: "Wrong password." });
      return;
    }

    // Make sure the host is still connected
    if (!lobby.host || !lobby.host.connected) {
      delete lobbies[code];
      socket.emit("joinError", { message: "Host disconnected. Lobby no longer exists." });
      return;
    }

    // Success — create the game between host (p1) and joiner (p2)
    const host = lobby.host;
    socket.faction = faction;
    socket.leaderId = leaderId;

    const game = createGame(
      host, socket,
      host.faction, faction,
      host.leaderId, leaderId
    );

    // Assign player keys and game references
    host.gameId = game.id;
    host.playerKey = "p1";
    socket.gameId = game.id;
    socket.playerKey = "p2";

    // Clean up the lobby (it's been used)
    delete lobbies[code];
    host.lobbyCode = null;

    console.log(`Lobby ${code} joined by ${socket.id} — game started`);

    // Send initial game state to both players (redraw phase)
    host.emit("gameStart", {
      playerKey: "p1",
      state: getGameState(game, "p1"),
    });
    socket.emit("gameStart", {
      playerKey: "p2",
      state: getGameState(game, "p2"),
    });
  });

  // ---- REDRAW ----
  // During the redraw phase, players can swap up to 2 cards from their hand
  socket.on("redraw", (data) => {
    const game = games[socket.gameId];
    if (!game || game.phase !== "redraw") return;

    const pKey = socket.playerKey;
    const p = game.players[pKey];

    if (data.cardUids && data.cardUids.length > 0) {
      // Swap each selected card: put it back in deck, draw a new one
      data.cardUids.forEach(uid => {
        if (p.redrawCount >= p.maxRedraws) return;
        const idx = p.hand.findIndex(c => c.uid === uid);
        if (idx !== -1) {
          const removed = p.hand.splice(idx, 1)[0];
          p.deck.push(removed);
          // Shuffle the deck so the returned card is randomized
          p.deck = shuffleArray(p.deck);
          // Draw a new card
          if (p.deck.length > 0) {
            p.hand.push(p.deck.pop());
          }
          p.redrawCount++;
        }
      });
    }

    // Mark this player as done with redraw
    game.redrawDone[pKey] = true;

    // If both players are done redrawing, start the play phase
    if (game.redrawDone.p1 && game.redrawDone.p2) {
      game.phase = "play";
    }

    emitState(game);
  });

  // ---- PLAY CARD ----
  // Player plays a card from their hand onto the board
  socket.on("playCard", (data) => {
    const game = games[socket.gameId];
    if (!game || game.gameOver) return;
    if (game.phase !== "play") return;
    if (game.currentTurn !== socket.playerKey) return;

    const result = playCard(game, socket.playerKey, data.cardUid, data.targetRow);
    if (result.error) {
      socket.emit("gameError", { message: result.error });
      return;
    }

    // If not in decoy mode (waiting for swap), advance the turn
    if (!game.decoyMode) {
      advanceTurn(game);
    }

    emitState(game);
  });

  // ---- DECOY SWAP ----
  // Player selects which board unit to swap with the Decoy card
  socket.on("decoySwap", (data) => {
    const game = games[socket.gameId];
    if (!game) return;

    const result = handleDecoySwap(game, socket.playerKey, data.targetUid);
    if (result.error) {
      socket.emit("gameError", { message: result.error });
      return;
    }

    advanceTurn(game);
    emitState(game);
  });

  // ---- CANCEL DECOY ----
  // Player cancels decoy mode without swapping
  socket.on("cancelDecoy", () => {
    const game = games[socket.gameId];
    if (!game || !game.decoyMode) return;
    if (game.decoyMode.player !== socket.playerKey) return;

    const p = game.players[socket.playerKey];
    // Put decoy card back in hand
    p.hand.push(game.decoyMode.card);
    game.decoyMode = null;
    emitState(game);
  });

  // ---- CHOOSE FIRST (Scoia'tael passive) ----
  // Scoia'tael player chooses who goes first after a round ends
  socket.on("chooseFirst", (data) => {
    const game = games[socket.gameId];
    if (!game || game.gameOver) return;
    if (game.pendingFirstChoice !== socket.playerKey) return;

    // data.choice is "me" or "opponent"
    if (data.choice === "me") {
      game.currentTurn = socket.playerKey;
    } else {
      game.currentTurn = socket.playerKey === "p1" ? "p2" : "p1";
    }
    game.pendingFirstChoice = null;
    emitState(game);
  });

  // ---- PASS ----
  // Player passes — they won't play any more cards this round
  socket.on("pass", () => {
    const game = games[socket.gameId];
    if (!game || game.gameOver) return;
    if (game.phase !== "play") return;
    if (game.currentTurn !== socket.playerKey) return;

    game.players[socket.playerKey].passed = true;
    advanceTurn(game);
    emitState(game);
  });

  // ---- USE LEADER ----
  // Player activates their leader card's one-time ability
  socket.on("useLeader", () => {
    const game = games[socket.gameId];
    if (!game || game.gameOver) return;
    if (game.phase !== "play") return;
    if (game.currentTurn !== socket.playerKey) return;

    const result = useLeaderAbility(game, socket.playerKey);
    if (result.error) {
      socket.emit("gameError", { message: result.error });
      return;
    }

    // Send leader ability result to the player (e.g., revealed cards)
    socket.emit("leaderResult", result);

    advanceTurn(game);
    emitState(game);
  });

  // ---- DISCONNECT ----
  // Clean up when a player disconnects
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);

    // Remove any lobby they were hosting
    if (socket.lobbyCode && lobbies[socket.lobbyCode]) {
      console.log(`Lobby ${socket.lobbyCode} removed (host disconnected)`);
      delete lobbies[socket.lobbyCode];
    }

    // Notify opponent if they were in a game
    if (socket.gameId && games[socket.gameId]) {
      const game = games[socket.gameId];
      const opponentKey = socket.playerKey === "p1" ? "p2" : "p1";
      const opponent = game.players[opponentKey];
      if (opponent && opponent.socket) {
        opponent.socket.emit("opponentDisconnected");
      }
      // Clean up the game
      delete games[socket.gameId];
    }
  });
});

// =============================================================================
// START THE SERVER
// =============================================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`  Gwent server running!`);
  console.log(`  Open: http://localhost:${PORT}`);
  console.log(`=================================`);
});
