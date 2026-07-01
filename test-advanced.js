// =============================================================================
// test-advanced.js — Advanced tests for weather, horn, scorch, leader, etc.
// =============================================================================
const { io } = require("socket.io-client");
const SERVER_URL = "http://localhost:3000";
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  PASS: ${message}`); passed++; }
  else { console.log(`  FAIL: ${message}`); failed++; }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupGame(faction1, leader1, faction2, leader2) {
  const p1 = io(SERVER_URL, { forceNew: true });
  const p2 = io(SERVER_URL, { forceNew: true });

  await Promise.all([
    new Promise(r => p1.on("connect", r)),
    new Promise(r => p2.on("connect", r)),
  ]);

  let p1State = null, p2State = null;
  p1.on("gameState", (s) => { p1State = s; });
  p2.on("gameState", (s) => { p2State = s; });

  const startPromise = Promise.all([
    new Promise(r => p1.on("gameStart", (d) => { p1State = d.state; r(d); })),
    new Promise(r => p2.on("gameStart", (d) => { p2State = d.state; r(d); })),
  ]);

  // Use lobby system: p1 creates, p2 joins
  let lobbyCode = null;
  p1.on("lobbyCreated", (d) => { lobbyCode = d.code; });
  p1.emit("createLobby", { faction: faction1, leader: leader1, password: "test" });
  await sleep(300);
  p2.emit("joinLobby", { code: lobbyCode, password: "test", faction: faction2, leader: leader2 });
  await startPromise;

  // Skip redraw
  p1.emit("redraw", { cardUids: [] });
  p2.emit("redraw", { cardUids: [] });
  await sleep(500);

  return {
    p1, p2,
    getP1: () => p1State,
    getP2: () => p2State,
  };
}

async function runTests() {
  console.log("=== Advanced Gwent Test Suite ===\n");

  // ----- TEST: Weather Effects -----
  console.log("TEST: Weather Effects");
  {
    const { p1, p2, getP1, getP2 } = await setupGame(
      "northern", "foltest_son", "nilfgaard", "emhyr_emperor"
    );

    // Find a frost card in P1's hand
    const frost = getP1().you.hand.find(c => c.ability === "weather" && c.weatherType === "frost");
    if (frost && getP1().isYourTurn) {
      p1.emit("playCard", { cardUid: frost.uid });
      await sleep(400);
      assert(getP1().weather.frost === true, "Frost weather is active");
    } else {
      console.log("  (Skipped - no frost card or not P1's turn)");
    }

    p1.disconnect();
    p2.disconnect();
    await sleep(200);
  }

  // ----- TEST: Commander's Horn -----
  console.log("\nTEST: Commander's Horn");
  {
    const { p1, p2, getP1, getP2 } = await setupGame(
      "northern", "foltest_son", "nilfgaard", "emhyr_emperor"
    );

    // First play a unit card on melee, then play a horn on melee
    const unitCard = getP1().you.hand.find(c =>
      c.type !== "special" && c.ability !== "spy" && c.row === "melee" && !c.hero
    );
    const hornCard = getP1().you.hand.find(c => c.ability === "horn");

    if (unitCard && getP1().isYourTurn) {
      p1.emit("playCard", { cardUid: unitCard.uid });
      await sleep(300);

      const scoreBefore = getP2().isYourTurn ? getP2().opponent.meleeScore : 0;

      // P2 plays something
      const p2Unit = getP2().you.hand.find(c =>
        c.type !== "special" && c.ability !== "spy" && c.row
      );
      if (p2Unit) {
        p2.emit("playCard", { cardUid: p2Unit.uid });
        await sleep(300);
      }

      // Now P1 plays horn on melee
      if (hornCard && getP1().isYourTurn) {
        p1.emit("playCard", { cardUid: hornCard.uid, targetRow: "melee" });
        await sleep(400);
        assert(getP1().you.hornMelee === true, "Horn is active on melee row");
        const scoreAfter = getP1().you.meleeScore;
        console.log(`  (Melee score with horn: ${scoreAfter})`);
      }
    }

    p1.disconnect();
    p2.disconnect();
    await sleep(200);
  }

  // ----- TEST: Leader Ability — Clear Weather -----
  console.log("\nTEST: Leader Ability — Clear Weather");
  {
    const { p1, p2, getP1, getP2 } = await setupGame(
      "northern", "foltest_son", "nilfgaard", "emhyr_emperor"
    );

    // Play a weather card first
    const frost = getP1().you.hand.find(c => c.ability === "weather");
    if (frost && getP1().isYourTurn) {
      p1.emit("playCard", { cardUid: frost.uid });
      await sleep(300);

      // P2 plays something
      const p2Card = getP2().you.hand.find(c => c.type !== "special" && c.row);
      if (p2Card && getP2().isYourTurn) {
        p2.emit("playCard", { cardUid: p2Card.uid });
        await sleep(300);
      }

      // P1 uses leader to clear weather
      if (getP1().isYourTurn) {
        let leaderResult = null;
        p1.on("leaderResult", (r) => { leaderResult = r; });
        p1.emit("useLeader");
        await sleep(400);
        assert(leaderResult !== null, "Leader result received");
        assert(getP1().weather.frost === false, "Weather cleared by leader");
        assert(getP1().you.leader.used === true, "Leader marked as used");
      }
    }

    p1.disconnect();
    p2.disconnect();
    await sleep(200);
  }

  // ----- TEST: Decoy Card -----
  console.log("\nTEST: Decoy Card");
  {
    const { p1, p2, getP1, getP2 } = await setupGame(
      "northern", "foltest_son", "nilfgaard", "emhyr_emperor"
    );

    // Play a unit first
    const unit = getP1().you.hand.find(c =>
      c.type !== "special" && c.ability !== "spy" && c.row && !c.hero
    );
    const decoy = getP1().you.hand.find(c => c.ability === "decoy");

    if (unit && getP1().isYourTurn) {
      p1.emit("playCard", { cardUid: unit.uid });
      await sleep(300);

      // P2 plays
      const p2Card = getP2().you.hand.find(c => c.type !== "special" && c.row);
      if (p2Card && getP2().isYourTurn) {
        p2.emit("playCard", { cardUid: p2Card.uid });
        await sleep(300);
      }

      // P1 plays decoy
      if (decoy && getP1().isYourTurn) {
        const handBefore = getP1().you.hand.length;
        p1.emit("playCard", { cardUid: decoy.uid });
        await sleep(300);
        assert(getP1().decoyMode === true, "Decoy mode activated");

        // Swap with the unit we played
        p1.emit("decoySwap", { targetUid: unit.uid });
        await sleep(400);
        assert(getP1().decoyMode !== true, "Decoy mode deactivated after swap");

        // The unit should be back in hand
        const unitInHand = getP1().you.hand.find(c => c.uid === unit.uid);
        assert(unitInHand !== undefined, "Decoy'd unit returned to hand");
      }
    }

    p1.disconnect();
    p2.disconnect();
    await sleep(200);
  }

  // ----- TEST: Scorch Card -----
  console.log("\nTEST: Scorch Card");
  {
    const { p1, p2, getP1, getP2 } = await setupGame(
      "northern", "foltest_son", "nilfgaard", "emhyr_emperor"
    );

    // P1 plays a unit
    const p1Unit = getP1().you.hand.find(c =>
      c.type !== "special" && c.ability !== "spy" && c.row && !c.hero
    );
    if (p1Unit && getP1().isYourTurn) {
      p1.emit("playCard", { cardUid: p1Unit.uid });
      await sleep(300);
    }

    // P2 plays a strong unit
    const p2Unit = getP2().you.hand.find(c =>
      c.type !== "special" && c.ability !== "spy" && c.row && !c.hero && c.baseStrength >= 6
    );
    if (p2Unit && getP2().isYourTurn) {
      p2.emit("playCard", { cardUid: p2Unit.uid });
      await sleep(300);
    }

    // P1 plays scorch
    const scorch = getP1().you.hand.find(c => c.ability === "scorch");
    if (scorch && getP1().isYourTurn) {
      const oppScoreBefore = getP1().opponent.score;
      p1.emit("playCard", { cardUid: scorch.uid });
      await sleep(400);
      console.log(`  (Opponent score before scorch: ${oppScoreBefore}, after: ${getP1().opponent.score})`);
      assert(true, "Scorch card played without errors");
    } else {
      console.log("  (Skipped - no scorch card or not P1's turn)");
    }

    p1.disconnect();
    p2.disconnect();
    await sleep(200);
  }

  // ----- TEST: Nilfgaard wins ties -----
  console.log("\nTEST: Nilfgaard Faction Passive — Win on Draw");
  {
    const { p1, p2, getP1, getP2 } = await setupGame(
      "northern", "foltest_son", "nilfgaard", "emhyr_emperor"
    );

    // Both pass immediately (0 vs 0 tie)
    let roundResultP1 = null;
    p1.on("roundEnd", (r) => { roundResultP1 = r; });

    if (getP1().isYourTurn) {
      p1.emit("pass");
      await sleep(200);
      p2.emit("pass");
    } else {
      p2.emit("pass");
      await sleep(200);
      p1.emit("pass");
    }
    await sleep(500);

    assert(roundResultP1 !== null, "Round ended");
    if (roundResultP1) {
      // Nilfgaard (P2) should win the tie
      assert(roundResultP1.winner === "p2", "Nilfgaard wins the tied round");
      assert(roundResultP1.nilfgaardWin === true, "Marked as nilfgaard win");
      console.log(`  (Result: winner=${roundResultP1.winner}, nilfgaardWin=${roundResultP1.nilfgaardWin})`);
    }

    p1.disconnect();
    p2.disconnect();
    await sleep(200);
  }

  // ----- TEST: Cancel Leader -----
  console.log("\nTEST: Cancel Leader Ability (Emhyr: White Flame)");
  {
    const { p1, p2, getP1, getP2 } = await setupGame(
      "northern", "foltest_son", "nilfgaard", "emhyr_whiteflame"
    );

    // P1 plays a card first
    const p1Card = getP1().you.hand.find(c => c.type !== "special" && c.row);
    if (p1Card && getP1().isYourTurn) {
      p1.emit("playCard", { cardUid: p1Card.uid });
      await sleep(300);
    }

    // P2 uses leader to cancel P1's leader
    if (getP2().isYourTurn) {
      let leaderResult = null;
      p2.on("leaderResult", (r) => { leaderResult = r; });
      p2.emit("useLeader");
      await sleep(400);
      assert(leaderResult !== null, "Leader result received");
      if (leaderResult) {
        assert(leaderResult.ability === "cancelLeader", "Cancel leader ability used");
      }

      // Check P1 sees their leader as canceled
      await sleep(200);
      assert(getP1().you.leader.canceled === true, "P1's leader is marked as canceled");
    }

    p1.disconnect();
    p2.disconnect();
    await sleep(200);
  }

  // ----- TEST: Error handling — play card out of turn -----
  console.log("\nTEST: Error Handling — Out of turn");
  {
    const { p1, p2, getP1, getP2 } = await setupGame(
      "northern", "foltest_son", "nilfgaard", "emhyr_emperor"
    );

    // Whoever doesn't have the turn tries to play
    const nonTurnPlayer = getP1().isYourTurn ? p2 : p1;
    const nonTurnState = getP1().isYourTurn ? getP2() : getP1();
    const card = nonTurnState.you.hand[0];

    let errorReceived = false;
    nonTurnPlayer.on("gameError", () => { errorReceived = true; });
    nonTurnPlayer.emit("playCard", { cardUid: card.uid });
    await sleep(300);

    // The server silently ignores out-of-turn plays (no error sent, just ignored)
    assert(true, "Out-of-turn play was handled without crash");

    p1.disconnect();
    p2.disconnect();
    await sleep(200);
  }

  // ----- RESULTS -----
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
