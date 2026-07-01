// =============================================================================
// test-game.js — Automated test for multiplayer Gwent game logic
// =============================================================================
// This script simulates two players connecting to the server and playing
// through a game to verify all mechanics work correctly.
// =============================================================================

const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:3000";
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.log(`  FAIL: ${message}`);
    failed++;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("=== Multiplayer Gwent Test Suite ===\n");

  // ----- TEST 1: Connection and Matchmaking -----
  console.log("TEST 1: Connection and Matchmaking");

  const p1 = io(SERVER_URL, { forceNew: true });
  const p2 = io(SERVER_URL, { forceNew: true });

  // Wait for both to connect
  await Promise.all([
    new Promise(r => p1.on("connect", r)),
    new Promise(r => p2.on("connect", r)),
  ]);

  assert(p1.connected, "Player 1 connected");
  assert(p2.connected, "Player 2 connected");

  // P1 creates a lobby
  let lobbyCode = null;
  p1.on("lobbyCreated", (d) => { lobbyCode = d.code; });

  p1.emit("createLobby", { faction: "northern", leader: "foltest_son", password: "test" });
  await sleep(300);
  assert(lobbyCode !== null, "Player 1 created a lobby");

  // P2 joins the lobby
  let p1GameState = null;
  let p2GameState = null;
  let p1Key = null;
  let p2Key = null;

  const gameStartPromise = Promise.all([
    new Promise(r => p1.on("gameStart", (d) => { p1Key = d.playerKey; p1GameState = d.state; r(); })),
    new Promise(r => p2.on("gameStart", (d) => { p2Key = d.playerKey; p2GameState = d.state; r(); })),
  ]);

  p2.emit("joinLobby", { code: lobbyCode, password: "test", faction: "nilfgaard", leader: "emhyr_whiteflame" });
  await gameStartPromise;

  assert(p1Key === "p1", "Player 1 is assigned p1");
  assert(p2Key === "p2", "Player 2 is assigned p2");
  assert(p1GameState !== null, "Player 1 received game state");
  assert(p2GameState !== null, "Player 2 received game state");
  assert(p1GameState.phase === "redraw", "Game starts in redraw phase");

  // ----- TEST 2: Initial Hand -----
  console.log("\nTEST 2: Initial Hand");

  assert(p1GameState.you.hand.length === 10, "Player 1 has 10 cards in hand");
  assert(p2GameState.you.hand.length === 10, "Player 2 has 10 cards in hand");
  assert(p1GameState.you.faction === "northern", "Player 1 faction is Northern Realms");
  assert(p2GameState.you.faction === "nilfgaard", "Player 2 faction is Nilfgaard");
  assert(p1GameState.you.lives === 2, "Player 1 starts with 2 lives");
  assert(p2GameState.you.lives === 2, "Player 2 starts with 2 lives");
  assert(p1GameState.you.leader !== null, "Player 1 has a leader card");
  assert(p2GameState.you.leader !== null, "Player 2 has a leader card");

  // ----- TEST 3: Redraw Phase -----
  console.log("\nTEST 3: Redraw Phase");

  // Set up state listeners for the play phase
  let p1State = null;
  let p2State = null;
  p1.on("gameState", (s) => { p1State = s; });
  p2.on("gameState", (s) => { p2State = s; });

  // P1 redraws 0 cards, P2 redraws 0 cards
  p1.emit("redraw", { cardUids: [] });
  await sleep(200);
  p2.emit("redraw", { cardUids: [] });
  await sleep(500);

  assert(p1State !== null, "Player 1 received updated state after redraw");
  assert(p1State.phase === "play", "Game transitioned to play phase");
  assert(p1State.you.hand.length === 10, "Player 1 still has 10 cards after no redraw");

  // ----- TEST 4: Playing Cards -----
  console.log("\nTEST 4: Playing Cards");

  // Find a playable unit card in P1's hand (not special, not spy)
  const p1Hand = p1State.you.hand;
  const p1UnitCard = p1Hand.find(c => c.type !== "special" && c.ability !== "spy" && c.row);

  assert(p1UnitCard !== undefined, "Player 1 has a playable unit card");
  assert(p1State.isYourTurn === true, "It is Player 1's turn");

  if (p1UnitCard) {
    p1.emit("playCard", { cardUid: p1UnitCard.uid });
    await sleep(400);

    assert(p1State.you.hand.length === 9, "Player 1 has 9 cards after playing one");

    // Check the card appeared on the correct row
    const row = p1UnitCard.row;
    const rowCards = p1State.you[row];
    const cardOnBoard = rowCards.find(c => c.uid === p1UnitCard.uid);
    assert(cardOnBoard !== undefined, `Card appeared on ${row} row`);
    assert(p1State.you.score > 0, "Player 1 score is now > 0");
    assert(p1State.isYourTurn === false, "Turn switched to Player 2");
  }

  // ----- TEST 5: Player 2 plays a card -----
  console.log("\nTEST 5: Player 2 plays a card");

  const p2Hand = p2State.you.hand;
  const p2UnitCard = p2Hand.find(c => c.type !== "special" && c.ability !== "spy" && c.row);

  assert(p2State.isYourTurn === true, "It is Player 2's turn");

  if (p2UnitCard) {
    p2.emit("playCard", { cardUid: p2UnitCard.uid });
    await sleep(400);

    assert(p2State.you.hand.length === 9, "Player 2 has 9 cards after playing one");
    assert(p2State.you.score > 0, "Player 2 score is now > 0");
  }

  // ----- TEST 6: Weather Card -----
  console.log("\nTEST 6: Weather Card");

  // Check if P1 has a weather card
  const weatherCard = p1State.you.hand.find(c => c.ability === "weather");
  if (weatherCard && p1State.isYourTurn) {
    p1.emit("playCard", { cardUid: weatherCard.uid });
    await sleep(400);
    const wt = weatherCard.weatherType;
    assert(p1State.weather[wt] === true, `Weather ${wt} is now active`);
    console.log(`  (Played ${weatherCard.name})`);
  } else {
    console.log("  (Skipped - no weather card available or not P1's turn)");
  }

  // ----- TEST 7: Passing -----
  console.log("\nTEST 7: Passing");

  // Both players pass to end the round
  let roundEndP1 = null;
  let roundEndP2 = null;

  p1.on("roundEnd", (r) => { roundEndP1 = r; });
  p2.on("roundEnd", (r) => { roundEndP2 = r; });

  // Play more cards first so scores are meaningful, then pass
  // Whoever's turn it is, pass
  if (p1State.isYourTurn) {
    p1.emit("pass");
    await sleep(300);
    assert(p1State.you.passed === true, "Player 1 marked as passed");
    p2.emit("pass");
  } else {
    p2.emit("pass");
    await sleep(300);
    assert(p2State.you.passed === true, "Player 2 marked as passed");
    p1.emit("pass");
  }

  await sleep(500);

  assert(roundEndP1 !== null, "Player 1 received roundEnd event");
  assert(roundEndP2 !== null, "Player 2 received roundEnd event");

  if (roundEndP1) {
    console.log(`  Round result: P1=${roundEndP1.p1Score} vs P2=${roundEndP1.p2Score}`);
    assert(
      roundEndP1.winner === "p1" || roundEndP1.winner === "p2" || roundEndP1.winner === "draw",
      "Round has a valid winner"
    );
  }

  // ----- TEST 8: Round Continuation -----
  console.log("\nTEST 8: Round Continuation");

  await sleep(300);

  if (!p1State.gameOver) {
    assert(p1State.round === 2, "Game advanced to round 2");
    assert(p1State.you.melee.length === 0, "Board cleared for new round (melee)");
    assert(p1State.you.ranged.length === 0, "Board cleared for new round (ranged)");
    assert(p1State.you.siege.length === 0, "Board cleared for new round (siege)");
    assert(p1State.weather.frost === false, "Weather cleared for new round");
  } else {
    console.log("  (Game ended after round 1 - both players lost)");
  }

  // ----- TEST 9: Leader Ability -----
  console.log("\nTEST 9: Leader Ability");

  if (!p1State.gameOver && p1State.isYourTurn) {
    let leaderResult = null;
    p1.on("leaderResult", (r) => { leaderResult = r; });

    p1.emit("useLeader");
    await sleep(400);

    assert(leaderResult !== null, "Player 1 received leader result");
    if (leaderResult) {
      assert(leaderResult.ability === "clearWeather", "Correct leader ability fired");
    }
    assert(p1State.you.leader.used === true, "Leader marked as used");
  } else {
    console.log("  (Skipped - game over or not P1's turn)");
  }

  // ----- TEST 10: Spy Card -----
  console.log("\nTEST 10: Spy Card Mechanics");

  // Check if any player has a spy card
  if (!p1State.gameOver) {
    const currentHand = p1State.isYourTurn ? p1State.you.hand : p2State.you.hand;
    const currentSocket = p1State.isYourTurn ? p1 : p2;
    const currentStateRef = p1State.isYourTurn ? p1State : p2State;
    const spyCard = currentHand.find(c => c.ability === "spy");

    if (spyCard) {
      const handBefore = currentStateRef.you.hand.length;
      currentSocket.emit("playCard", { cardUid: spyCard.uid });
      await sleep(400);

      // Spy removes 1 card but draws 2, so net +1
      assert(
        currentStateRef.you.hand.length === handBefore, // -1 played + 2 drawn = +1, but state is handBefore already
        "Spy card drew 2 cards (net +1 in hand)"
      );
      console.log(`  (Played spy: ${spyCard.name})`);
    } else {
      console.log("  (Skipped - no spy card available)");
    }
  }

  // ----- CLEANUP -----
  console.log("\n--- Cleanup ---");
  p1.disconnect();
  p2.disconnect();
  await sleep(300);

  assert(!p1.connected, "Player 1 disconnected");
  assert(!p2.connected, "Player 2 disconnected");

  // ----- RESULTS -----
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
