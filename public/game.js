// =============================================================================
// public/game.js — Client-Side Game Logic for Multiplayer Gwent
// =============================================================================
// This file handles:
//   1. Socket.IO connection to the game server
//   2. Lobby UI: faction selection, leader selection, matchmaking
//   3. Redraw phase: swapping up to 2 starting cards
//   4. Game rendering: displaying the board, hands, scores, weather
//   5. Player interactions: clicking cards, passing, using leader abilities
//   6. Modals: horn row selection, round end, game over, leader reveals
//   7. Decoy mode: selecting a board card to swap
//
// All game logic runs on the SERVER — the client only sends actions and
// renders the state it receives. This prevents cheating.
// =============================================================================

// Connect to the Socket.IO server
const socket = io();

// =============================================================================
// CLIENT STATE — Track what the client knows
// =============================================================================
let myPlayerKey = null;     // "p1" or "p2" — assigned by server
let currentState = null;    // Latest game state from server
let selectedFaction = null; // Chosen faction for matchmaking
let selectedLeader = null;  // Chosen leader card ID
let pendingHornUid = null;  // Card UID when waiting for horn row selection
let redrawSelected = [];    // Card UIDs selected for redraw
let pendingAgileUid = null; // Card UID when waiting for agile row selection

// Faction display names lookup
const FACTION_NAMES = {
  northern: "Northern Realms",
  nilfgaard: "Nilfgaard",
  scoiatael: "Scoia'tael",
  monsters: "Monsters",
  skellige: "Skellige",
};

// =============================================================================
// DOM ELEMENT REFERENCES
// =============================================================================
const lobbyEl = document.getElementById("lobby");
const factionSelectEl = document.getElementById("faction-select");
const leaderSelectEl = document.getElementById("leader-select");
const leaderOptionsEl = document.getElementById("leader-options");
const lobbyModeEl = document.getElementById("lobby-mode");
const createLobbyScreen = document.getElementById("create-lobby-screen");
const joinLobbyScreen = document.getElementById("join-lobby-screen");
const lobbyWaitingEl = document.getElementById("lobby-waiting");
const redrawScreen = document.getElementById("redraw-screen");
const redrawHand = document.getElementById("redraw-hand");
const redrawCountEl = document.getElementById("redraw-count");
const redrawDoneBtn = document.getElementById("redraw-done-btn");
const gameBoardEl = document.getElementById("game-board");
const handEl = document.getElementById("hand");
const hornModal = document.getElementById("horn-modal");
const roundOverlay = document.getElementById("round-overlay");
const gameoverOverlay = document.getElementById("gameover-overlay");
const leaderOverlay = document.getElementById("leader-overlay");
const decoyBanner = document.getElementById("decoy-banner");
const agileModal = document.getElementById("agile-modal");
const chooseFirstModal = document.getElementById("choose-first-modal");

// =============================================================================
// LOBBY — FACTION SELECTION
// =============================================================================
// When a player clicks a faction button, show the leader selection for that faction
document.querySelectorAll(".faction-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedFaction = btn.dataset.faction;
    showLeaderSelect(selectedFaction);
  });
});

// Back button to return to faction selection
document.getElementById("back-to-faction").addEventListener("click", () => {
  leaderSelectEl.style.display = "none";
  factionSelectEl.style.display = "flex";
});

// =============================================================================
// LOBBY — LEADER SELECTION
// =============================================================================
// Show available leaders for the chosen faction
function showLeaderSelect(faction) {
  factionSelectEl.style.display = "none";
  leaderSelectEl.style.display = "flex";
  leaderOptionsEl.innerHTML = "";

  // Get leader IDs for this faction from the shared cards.js data
  const leaderIds = LEADERS[faction];
  leaderIds.forEach(leaderId => {
    const leader = CARD_DATA[leaderId];
    const btn = document.createElement("button");
    btn.className = "leader-btn-option";
    btn.innerHTML = `
      <strong>${leader.name}</strong>
      <span class="leader-desc">${leader.description}</span>
    `;
    btn.addEventListener("click", () => {
      selectedLeader = leaderId;
      showLobbyMode();
    });
    leaderOptionsEl.appendChild(btn);
  });
}

// =============================================================================
// LOBBY — CREATE / JOIN MODE SELECTION
// =============================================================================
// After picking faction + leader, the player chooses to host or join a lobby
function showLobbyMode() {
  leaderSelectEl.style.display = "none";
  lobbyModeEl.style.display = "flex";
}

// "Create Lobby" button — show the password form
document.getElementById("create-lobby-btn").addEventListener("click", () => {
  lobbyModeEl.style.display = "none";
  createLobbyScreen.style.display = "flex";
  document.getElementById("create-password").value = "";
  document.getElementById("create-password").focus();
});

// "Join Lobby" button — show the code + password form
document.getElementById("join-lobby-btn").addEventListener("click", () => {
  lobbyModeEl.style.display = "none";
  joinLobbyScreen.style.display = "flex";
  document.getElementById("join-code").value = "";
  document.getElementById("join-password").value = "";
  document.getElementById("join-error").style.display = "none";
  document.getElementById("join-code").focus();
});

// Back buttons for lobby screens
document.getElementById("back-to-lobby-mode-create").addEventListener("click", () => {
  createLobbyScreen.style.display = "none";
  lobbyModeEl.style.display = "flex";
});

document.getElementById("back-to-lobby-mode-join").addEventListener("click", () => {
  joinLobbyScreen.style.display = "none";
  lobbyModeEl.style.display = "flex";
});

document.getElementById("back-to-leader").addEventListener("click", () => {
  lobbyModeEl.style.display = "none";
  leaderSelectEl.style.display = "flex";
});

// =============================================================================
// CREATE LOBBY — Send to server, wait for code
// =============================================================================
document.getElementById("create-lobby-confirm").addEventListener("click", () => {
  const password = document.getElementById("create-password").value;
  createLobbyScreen.style.display = "none";
  lobbyWaitingEl.style.display = "flex";

  socket.emit("createLobby", {
    faction: selectedFaction,
    leader: selectedLeader,
    password: password,
  });
});

// Server responds with the lobby code
socket.on("lobbyCreated", (data) => {
  document.getElementById("lobby-code-display").textContent = data.code;
});

// =============================================================================
// JOIN LOBBY — Send code + password to server
// =============================================================================
document.getElementById("join-lobby-confirm").addEventListener("click", () => {
  const code = document.getElementById("join-code").value;
  const password = document.getElementById("join-password").value;
  document.getElementById("join-error").style.display = "none";

  socket.emit("joinLobby", {
    code: code,
    password: password,
    faction: selectedFaction,
    leader: selectedLeader,
  });
});

// Handle join errors (wrong code, wrong password, host disconnected)
socket.on("joinError", (data) => {
  const errorEl = document.getElementById("join-error");
  errorEl.textContent = data.message;
  errorEl.style.display = "block";
});

// =============================================================================
// SOCKET EVENT: gameStart — Game found! Show redraw phase
// =============================================================================
socket.on("gameStart", (data) => {
  myPlayerKey = data.playerKey;
  currentState = data.state;
  lobbyEl.style.display = "none";

  // Show the redraw screen
  if (currentState.phase === "redraw") {
    showRedrawPhase();
  } else {
    showGameBoard();
  }
});

// =============================================================================
// REDRAW PHASE — Swap up to 2 cards before the game begins
// =============================================================================
function showRedrawPhase() {
  redrawScreen.style.display = "flex";
  gameBoardEl.style.display = "none";
  redrawSelected = [];
  renderRedrawHand();
}

// Render the hand during redraw phase — cards are clickable to toggle selection
function renderRedrawHand() {
  redrawHand.innerHTML = "";
  const hand = currentState.you.hand;

  hand.forEach(card => {
    const el = createCardElement(card);
    el.classList.add("hand-card");

    // Check if this card is selected for redraw
    if (redrawSelected.includes(card.uid)) {
      el.classList.add("selected");
    }

    el.addEventListener("click", () => {
      const idx = redrawSelected.indexOf(card.uid);
      if (idx !== -1) {
        // Deselect — remove from redraw list
        redrawSelected.splice(idx, 1);
      } else if (redrawSelected.length < 2) {
        // Select — add to redraw list (max 2)
        redrawSelected.push(card.uid);
      }
      renderRedrawHand();
    });

    redrawHand.appendChild(el);
  });

  redrawCountEl.textContent = `Selected: ${redrawSelected.length} / 2`;
}

// "Done" button — send redraw choices to server
redrawDoneBtn.addEventListener("click", () => {
  socket.emit("redraw", { cardUids: redrawSelected });
  redrawSelected = [];
  // Show a brief "waiting for opponent" message if they haven't finished yet
  redrawDoneBtn.textContent = "Waiting for opponent...";
  redrawDoneBtn.disabled = true;
});

// =============================================================================
// SOCKET EVENT: gameState — Main state update (received after every action)
// =============================================================================
socket.on("gameState", (state) => {
  currentState = state;

  // Transition from redraw to play phase when both players are done
  if (state.phase === "play" && redrawScreen.style.display !== "none") {
    redrawScreen.style.display = "none";
    gameBoardEl.style.display = "flex";
  }

  // If still in redraw phase, update the redraw hand
  if (state.phase === "redraw") {
    renderRedrawHand();
    return;
  }

  // Render the full game board
  renderBoard(state);
});

// =============================================================================
// RENDER THE GAME BOARD — Update all visual elements from state
// =============================================================================
function renderBoard(state) {
  const you = state.you;
  const opp = state.opponent;

  // ---- OPPONENT INFO BAR ----
  document.getElementById("opp-faction").textContent =
    FACTION_NAMES[opp.faction] || opp.faction;
  document.getElementById("opp-score").textContent = opp.score;
  document.getElementById("opp-lives").textContent =
    Array(opp.lives).fill("\u2764").join(""); // Red hearts
  document.getElementById("opp-hand-count").textContent = `Hand: ${opp.handCount}`;
  document.getElementById("opp-deck-count").textContent = `Deck: ${opp.deckCount}`;

  // Show/hide opponent passed indicator
  const oppPassedEl = document.getElementById("opp-passed");
  oppPassedEl.style.display = opp.passed ? "inline" : "none";

  // Opponent leader info
  const oppLeaderEl = document.getElementById("opp-leader-info");
  if (opp.leader) {
    oppLeaderEl.textContent = opp.leader.used
      ? `${opp.leader.name} (Used)`
      : opp.leader.canceled
        ? `${opp.leader.name} (Canceled)`
        : opp.leader.name;
  }

  // ---- YOUR INFO BAR ----
  document.getElementById("your-faction").textContent =
    FACTION_NAMES[you.faction] || you.faction;
  document.getElementById("your-score").textContent = you.score;
  document.getElementById("your-lives").textContent =
    Array(you.lives).fill("\u2764").join("");
  document.getElementById("your-deck-count").textContent = `Deck: ${you.deckCount}`;

  // Turn indicator
  const turnEl = document.getElementById("turn-indicator");
  if (state.isYourTurn) {
    turnEl.textContent = "YOUR TURN";
    turnEl.className = "turn-indicator";
  } else {
    turnEl.textContent = "OPPONENT'S TURN";
    turnEl.className = "turn-indicator not-your-turn";
  }

  // Show/hide your passed indicator
  const yourPassedEl = document.getElementById("your-passed");
  yourPassedEl.style.display = you.passed ? "inline" : "none";

  // Pass button — only enabled on your turn and if you haven't passed
  const passBtn = document.getElementById("pass-btn");
  passBtn.disabled = !state.isYourTurn || you.passed;

  // Leader button — enabled if it's your turn and leader hasn't been used
  const leaderBtn = document.getElementById("leader-btn");
  if (you.leader) {
    leaderBtn.title = you.leader.description;
    leaderBtn.disabled = !state.isYourTurn || you.leader.used || you.leader.canceled;
    leaderBtn.textContent = you.leader.used
      ? "LEADER (Used)"
      : you.leader.canceled
        ? "LEADER (Canceled)"
        : "LEADER";
  } else {
    leaderBtn.disabled = true;
  }

  // ---- ROW SCORES ----
  document.getElementById("opp-melee-score").textContent = opp.meleeScore;
  document.getElementById("opp-ranged-score").textContent = opp.rangedScore;
  document.getElementById("opp-siege-score").textContent = opp.siegeScore;
  document.getElementById("your-melee-score").textContent = you.meleeScore;
  document.getElementById("your-ranged-score").textContent = you.rangedScore;
  document.getElementById("your-siege-score").textContent = you.siegeScore;

  // ---- HORN INDICATORS ----
  setHornIndicator("opp-melee-horn", opp.hornMelee);
  setHornIndicator("opp-ranged-horn", opp.hornRanged);
  setHornIndicator("opp-siege-horn", opp.hornSiege);
  setHornIndicator("your-melee-horn", you.hornMelee);
  setHornIndicator("your-ranged-horn", you.hornRanged);
  setHornIndicator("your-siege-horn", you.hornSiege);

  // ---- WEATHER INDICATORS ----
  const w = state.weather;
  document.getElementById("weather-frost").style.display = w.frost ? "inline" : "none";
  document.getElementById("weather-fog").style.display = w.fog ? "inline" : "none";
  document.getElementById("weather-rain").style.display = w.rain ? "inline" : "none";
  document.getElementById("weather-clear").style.display =
    (!w.frost && !w.fog && !w.rain) ? "inline" : "none";

  // Apply weather visual effect to affected rows
  applyWeatherVisual("opp-melee-row", w.frost);
  applyWeatherVisual("opp-ranged-row", w.fog);
  applyWeatherVisual("opp-siege-row", w.rain);
  applyWeatherVisual("your-melee-row", w.frost);
  applyWeatherVisual("your-ranged-row", w.fog);
  applyWeatherVisual("your-siege-row", w.rain);

  // ---- RENDER BOARD CARDS ----
  renderRow("opp-melee-cards", opp.melee, false);
  renderRow("opp-ranged-cards", opp.ranged, false);
  renderRow("opp-siege-cards", opp.siege, false);
  renderRow("your-melee-cards", you.melee, state.decoyMode);
  renderRow("your-ranged-cards", you.ranged, state.decoyMode);
  renderRow("your-siege-cards", you.siege, state.decoyMode);

  // ---- RENDER HAND ----
  renderHand(you.hand, state.isYourTurn && !you.passed && !state.decoyMode);

  // ---- DECOY BANNER ----
  decoyBanner.style.display = state.decoyMode ? "flex" : "none";

  // ---- SCOIA'TAEL CHOOSE FIRST ----
  if (state.pendingFirstChoice) {
    chooseFirstModal.style.display = "flex";
  }
}

// =============================================================================
// RENDER FUNCTIONS — Build card elements and populate the DOM
// =============================================================================

// Create a visual card element from card data
function createCardElement(card) {
  const el = document.createElement("div");
  el.className = "card";
  el.dataset.uid = card.uid;

  // Apply visual class based on card type/ability
  if (card.hero) el.classList.add("hero");
  if (card.ability === "spy") el.classList.add("spy");
  if (card.ability === "medic" && !card.hero) el.classList.add("medic-card");
  if (card.ability === "bond") el.classList.add("bond-card");
  if (card.ability === "muster") el.classList.add("muster-card");
  if (card.type === "special" && card.ability === "weather") el.classList.add("weather-card");
  if (card.type === "special" && card.ability !== "weather") el.classList.add("special-card");

  // Card art image background
  const cardId = card.cardId || card.uid;
  const imgEl = document.createElement("img");
  imgEl.className = "card-art";
  imgEl.src = `/images/cards/${cardId}.png`;
  imgEl.alt = "";
  imgEl.loading = "lazy";
  // Hide broken images gracefully
  imgEl.onerror = function() { this.style.display = "none"; };
  el.appendChild(imgEl);

  // Overlay container for text on top of the image
  const overlay = document.createElement("div");
  overlay.className = "card-overlay";

  // Strength badge (hidden for 0-strength special cards)
  if (card.baseStrength > 0 || card.type !== "special") {
    const strEl = document.createElement("div");
    strEl.className = "card-strength";
    strEl.textContent = card.baseStrength;
    overlay.appendChild(strEl);
  }

  // Card name
  const nameEl = document.createElement("div");
  nameEl.className = "card-name";
  nameEl.textContent = card.name;
  overlay.appendChild(nameEl);

  // Ability label
  if (card.ability && card.ability !== "hero") {
    const abilEl = document.createElement("div");
    abilEl.className = "card-ability";
    const abilityNames = {
      spy: "Spy",
      medic: "Medic",
      bond: "Bond",
      morale: "Morale",
      muster: "Muster",
      weather: card.weatherType || "Weather",
      clearWeather: "Clear",
      horn: "Horn",
      scorch: "Scorch",
      decoy: "Decoy",
    };
    abilEl.textContent = abilityNames[card.ability] || card.ability;
    overlay.appendChild(abilEl);
  }

  // Row indicator for unit cards
  if (card.row && card.type !== "special") {
    const rowEl = document.createElement("div");
    rowEl.className = "card-row-indicator";
    const rowNames = { melee: "Melee", ranged: "Ranged", siege: "Siege", agile: "Agile" };
    rowEl.textContent = rowNames[card.row] || card.row;
    overlay.appendChild(rowEl);
  }

  el.appendChild(overlay);

  // Tooltip on hover showing full card info
  let tooltip = card.name;
  if (card.baseStrength > 0) tooltip += ` (${card.baseStrength})`;
  if (card.ability) tooltip += ` [${card.ability}]`;
  if (card.hero) tooltip += " [HERO]";
  if (card.row === "agile") tooltip += " [AGILE: melee/ranged]";
  el.title = tooltip;

  return el;
}

// Render cards in a board row
function renderRow(containerId, cards, isDecoyMode) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  cards.forEach(card => {
    const el = createCardElement(card);

    // In decoy mode, non-hero units on YOUR board are clickable swap targets
    if (isDecoyMode && !card.hero && card.type !== "special") {
      el.classList.add("decoy-target");
      el.addEventListener("click", () => {
        socket.emit("decoySwap", { targetUid: card.uid });
      });
    }

    container.appendChild(el);
  });
}

// Render the player's hand — cards are clickable only when it's your turn
function renderHand(hand, interactive) {
  handEl.innerHTML = "";

  hand.forEach(card => {
    const el = createCardElement(card);

    if (interactive) {
      el.classList.add("hand-card");
      el.addEventListener("click", () => handleCardClick(card));
    }

    handEl.appendChild(el);
  });
}

// Set horn indicator visual
function setHornIndicator(elementId, active) {
  const el = document.getElementById(elementId);
  if (active) {
    el.classList.add("active");
    el.textContent = "\u266B"; // Musical note icon for horn
  } else {
    el.classList.remove("active");
    el.textContent = "";
  }
}

// Apply weather visual effect to a row
function applyWeatherVisual(rowId, active) {
  const el = document.getElementById(rowId);
  if (active) {
    el.classList.add("weather-affected");
  } else {
    el.classList.remove("weather-affected");
  }
}

// =============================================================================
// CARD CLICK HANDLER — Decides what to do when a hand card is clicked
// =============================================================================
function handleCardClick(card) {
  // Commander's Horn needs a row selection, so show the modal
  if (card.ability === "horn") {
    pendingHornUid = card.uid;
    hornModal.style.display = "flex";
    return;
  }

  // Agile units can choose melee or ranged row
  if (card.row === "agile") {
    pendingAgileUid = card.uid;
    agileModal.style.display = "flex";
    return;
  }

  // All other cards are played directly
  socket.emit("playCard", { cardUid: card.uid });
}

// =============================================================================
// HORN MODAL — Let the player choose which row to buff
// =============================================================================
document.querySelectorAll("#horn-modal .modal-btn[data-row]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (pendingHornUid) {
      socket.emit("playCard", {
        cardUid: pendingHornUid,
        targetRow: btn.dataset.row,
      });
      pendingHornUid = null;
      hornModal.style.display = "none";
    }
  });
});

// Cancel horn selection
document.getElementById("horn-cancel").addEventListener("click", () => {
  pendingHornUid = null;
  hornModal.style.display = "none";
});

// =============================================================================
// AGILE MODAL — Let the player choose melee or ranged for agile units
// =============================================================================
document.querySelectorAll("#agile-modal .modal-btn[data-row]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (pendingAgileUid) {
      socket.emit("playCard", {
        cardUid: pendingAgileUid,
        targetRow: btn.dataset.row,
      });
      pendingAgileUid = null;
      agileModal.style.display = "none";
    }
  });
});

document.getElementById("agile-cancel").addEventListener("click", () => {
  pendingAgileUid = null;
  agileModal.style.display = "none";
});

// =============================================================================
// CHOOSE FIRST MODAL — Scoia'tael passive: pick who starts the round
// =============================================================================
document.getElementById("choose-first-me").addEventListener("click", () => {
  socket.emit("chooseFirst", { choice: "me" });
  chooseFirstModal.style.display = "none";
});

document.getElementById("choose-first-opp").addEventListener("click", () => {
  socket.emit("chooseFirst", { choice: "opponent" });
  chooseFirstModal.style.display = "none";
});

// =============================================================================
// PASS BUTTON — End your turn-taking for this round
// =============================================================================
document.getElementById("pass-btn").addEventListener("click", () => {
  socket.emit("pass");
});

// =============================================================================
// LEADER BUTTON — Activate your leader's one-time ability
// =============================================================================
document.getElementById("leader-btn").addEventListener("click", () => {
  socket.emit("useLeader");
});

// =============================================================================
// DECOY CANCEL — Cancel decoy swap mode
// =============================================================================
document.getElementById("decoy-cancel").addEventListener("click", () => {
  socket.emit("cancelDecoy");
});

// =============================================================================
// SOCKET EVENT: roundEnd — Show round result overlay
// =============================================================================
socket.on("roundEnd", (data) => {
  const resultText = document.getElementById("round-result-text");
  const scoresText = document.getElementById("round-scores-text");

  if (data.gameWinner) {
    // Game is over — show game over overlay instead
    const goText = document.getElementById("gameover-text");
    const goScores = document.getElementById("gameover-scores");

    if (data.gameWinner === "you") {
      goText.textContent = "VICTORY!";
      goText.style.color = "#c9a84c";
    } else if (data.gameWinner === "draw") {
      goText.textContent = "DRAW!";
      goText.style.color = "#aaa";
    } else {
      goText.textContent = "DEFEAT";
      goText.style.color = "#e74c3c";
    }

    goScores.textContent = `Final scores: ${data.p1Score} vs ${data.p2Score}`;
    gameoverOverlay.style.display = "flex";
    return;
  }

  // Round result (game continues)
  if (data.youWon) {
    resultText.textContent = "You won the round!";
    resultText.style.color = "#c9a84c";
  } else if (data.isDraw) {
    resultText.textContent = "Round drawn!";
    resultText.style.color = "#aaa";
  } else {
    resultText.textContent = "You lost the round.";
    resultText.style.color = "#e74c3c";
  }

  let scoreMsg = `Scores: ${data.p1Score} vs ${data.p2Score}`;
  if (data.nilfgaardWin) scoreMsg += " (Nilfgaard wins ties)";
  if (data.bonusDraw) scoreMsg += " (+1 card drawn)";
  scoresText.textContent = scoreMsg;

  roundOverlay.style.display = "flex";
});

// Continue button after round end
document.getElementById("round-continue-btn").addEventListener("click", () => {
  roundOverlay.style.display = "none";
});

// =============================================================================
// SOCKET EVENT: leaderResult — Show result of leader ability
// =============================================================================
socket.on("leaderResult", (result) => {
  const title = document.getElementById("leader-overlay-title");
  const cardsDiv = document.getElementById("leader-overlay-cards");
  const text = document.getElementById("leader-overlay-text");
  cardsDiv.innerHTML = "";

  // Handle different leader abilities
  if (result.ability === "viewOpponent" && result.events[0] && result.events[0].cards) {
    // Show the revealed opponent cards
    title.textContent = "Opponent's Cards Revealed";
    result.events[0].cards.forEach(card => {
      cardsDiv.appendChild(createCardElement(card));
    });
    text.textContent = "";
    leaderOverlay.style.display = "flex";
  } else if (result.events[0]) {
    // Show a text description of what happened
    title.textContent = "Leader Ability Activated";
    const evt = result.events[0];
    let msg = "";
    switch (evt.type) {
      case "clearWeather": msg = "All weather effects cleared!"; break;
      case "doubleSiege": msg = "Siege row strength doubled!"; break;
      case "scorchSiege": msg = `Destroyed ${evt.count} siege unit(s)!`; break;
      case "weather": msg = `${evt.weatherType} activated!`; break;
      case "cancelLeader": msg = "Opponent's leader ability canceled!"; break;
      case "stealDiscard": msg = evt.card ? `Stole ${evt.card.name}!` : evt.message; break;
      case "playFromDiscard": msg = evt.card ? `Played ${evt.card.name} from opponent's discard!` : evt.message; break;
      case "drawExtraCard": msg = evt.message; break;
      case "doubleRanged": msg = "Ranged row strength doubled!"; break;
      case "doubleMelee": msg = "Melee row strength doubled!"; break;
      case "discardAndDraw2": msg = `Discarded ${evt.discarded} cards, drew ${evt.drew} new ones!`; break;
      case "restoreUnit": msg = evt.card ? `Revived ${evt.card.name}!` : evt.message; break;
      case "scorchMelee": msg = `Destroyed ${evt.count} melee unit(s)!`; break;
      case "shuffleDiscard": msg = `Shuffled ${evt.count} cards back into deck!`; break;
      default: msg = "Ability activated!";
    }
    text.textContent = msg;
    leaderOverlay.style.display = "flex";
  }
});

// Close leader overlay
document.getElementById("leader-overlay-close").addEventListener("click", () => {
  leaderOverlay.style.display = "none";
});

// =============================================================================
// SOCKET EVENT: gameError — Show error messages from server
// =============================================================================
socket.on("gameError", (data) => {
  showToast(data.message);
});

// =============================================================================
// SOCKET EVENT: opponentDisconnected — Handle opponent leaving
// =============================================================================
socket.on("opponentDisconnected", () => {
  const goText = document.getElementById("gameover-text");
  const goScores = document.getElementById("gameover-scores");
  goText.textContent = "Opponent Disconnected";
  goText.style.color = "#aaa";
  goScores.textContent = "You win by default!";
  gameoverOverlay.style.display = "flex";
});

// =============================================================================
// TOAST NOTIFICATION — Brief message at top of screen
// =============================================================================
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  // Auto-remove after animation completes
  setTimeout(() => toast.remove(), 2600);
}
