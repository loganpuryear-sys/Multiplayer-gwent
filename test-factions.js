// =============================================================================
// test-factions.js — Test all 5 factions can create/join lobbies and play
// =============================================================================

const { io } = require("socket.io-client");
const URL = "http://localhost:3000";

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.log(`  FAIL: ${msg}`); failed++; }
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitForConnect(socket) {
  return new Promise((resolve) => {
    if (socket.connected) return resolve();
    socket.on("connect", resolve);
  });
}

function testFactionPair(f1, l1, f2, l2) {
  return new Promise(async (resolve) => {
    const timeout = setTimeout(() => {
      console.log(`  FAIL: Timeout for ${f1} vs ${f2}`);
      failed++;
      p1.disconnect();
      p2.disconnect();
      resolve();
    }, 8000);

    console.log(`\nTEST: ${f1} vs ${f2}`);
    const p1 = io(URL, { transports: ["websocket"] });
    const p2 = io(URL, { transports: ["websocket"] });

    // Wait for both to connect
    await Promise.all([waitForConnect(p1), waitForConnect(p2)]);

    let p1State = null;
    let p2State = null;

    p1.on("gameStart", (data) => {
      p1State = data.state;
      checkBoth();
    });

    p2.on("gameStart", (data) => {
      p2State = data.state;
      checkBoth();
    });

    p1.on("lobbyCreated", (data) => {
      const code = data.code;
      assert(!!code, `${f1} created lobby: ${code}`);
      // Small delay to ensure server processed
      setTimeout(() => {
        p2.emit("joinLobby", { code, password: "test", faction: f2, leader: l2 });
      }, 100);
    });

    p1.emit("createLobby", { faction: f1, leader: l1, password: "test" });

    function checkBoth() {
      if (!p1State || !p2State) return;

      clearTimeout(timeout);
      assert(p1State.you.faction === f1, `P1 faction is ${f1}`);
      assert(p2State.you.faction === f2, `P2 faction is ${f2}`);
      assert(p1State.you.hand.length === 10, `P1 has 10 cards`);
      assert(p2State.you.hand.length === 10, `P2 has 10 cards`);
      assert(!!p1State.you.leader, `P1 has leader`);
      assert(!!p2State.you.leader, `P2 has leader`);
      assert(p1State.phase === "redraw", `Game in redraw phase`);

      const allP1Cards = p1State.you.hand.every(c => c.name && c.name.length > 0);
      const allP2Cards = p2State.you.hand.every(c => c.name && c.name.length > 0);
      assert(allP1Cards, `All P1 cards have valid names`);
      assert(allP2Cards, `All P2 cards have valid names`);

      p1.disconnect();
      p2.disconnect();
      resolve();
    }
  });
}

async function runTests() {
  console.log("=== Faction Matchup Test Suite ===");

  const { LEADERS } = require("./public/cards.js");

  await testFactionPair("northern", LEADERS.northern[0], "nilfgaard", LEADERS.nilfgaard[0]);
  await testFactionPair("scoiatael", LEADERS.scoiatael[0], "monsters", LEADERS.monsters[0]);
  await testFactionPair("skellige", LEADERS.skellige[0], "northern", LEADERS.northern[1]);
  await testFactionPair("monsters", LEADERS.monsters[2], "scoiatael", LEADERS.scoiatael[2]);
  await testFactionPair("skellige", LEADERS.skellige[3], "nilfgaard", LEADERS.nilfgaard[3]);

  await wait(300);
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
