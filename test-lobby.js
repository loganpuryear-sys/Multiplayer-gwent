// =============================================================================
// test-lobby.js — Test the lobby code + password system
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

async function runTests() {
  console.log("=== Lobby System Test Suite ===\n");

  // ----- TEST 1: Create a lobby and get a code -----
  console.log("TEST 1: Create Lobby");
  {
    const host = io(SERVER_URL, { forceNew: true });
    await new Promise(r => host.on("connect", r));

    let lobbyCode = null;
    host.on("lobbyCreated", (data) => { lobbyCode = data.code; });

    host.emit("createLobby", {
      faction: "northern",
      leader: "foltest_son",
      password: "secret123",
    });
    await sleep(300);

    assert(lobbyCode !== null, "Received lobby code");
    assert(lobbyCode.length === 4, `Code is 4 characters: ${lobbyCode}`);
    assert(/^[A-Z]{4}$/.test(lobbyCode), "Code is uppercase letters only");
    console.log(`  Lobby code: ${lobbyCode}`);

    host.disconnect();
    await sleep(200);
  }

  // ----- TEST 2: Join with wrong code -----
  console.log("\nTEST 2: Join with Wrong Code");
  {
    const host = io(SERVER_URL, { forceNew: true });
    const joiner = io(SERVER_URL, { forceNew: true });
    await Promise.all([
      new Promise(r => host.on("connect", r)),
      new Promise(r => joiner.on("connect", r)),
    ]);

    let lobbyCode = null;
    host.on("lobbyCreated", (data) => { lobbyCode = data.code; });

    host.emit("createLobby", {
      faction: "northern",
      leader: "foltest_son",
      password: "pw",
    });
    await sleep(300);

    let joinErr = null;
    joiner.on("joinError", (data) => { joinErr = data.message; });

    joiner.emit("joinLobby", {
      code: "ZZZZ",
      password: "pw",
      faction: "nilfgaard",
      leader: "emhyr_emperor",
    });
    await sleep(300);

    assert(joinErr !== null, "Got error for wrong code");
    assert(joinErr.includes("not found"), `Error message: ${joinErr}`);

    host.disconnect();
    joiner.disconnect();
    await sleep(200);
  }

  // ----- TEST 3: Join with wrong password -----
  console.log("\nTEST 3: Join with Wrong Password");
  {
    const host = io(SERVER_URL, { forceNew: true });
    const joiner = io(SERVER_URL, { forceNew: true });
    await Promise.all([
      new Promise(r => host.on("connect", r)),
      new Promise(r => joiner.on("connect", r)),
    ]);

    let lobbyCode = null;
    host.on("lobbyCreated", (data) => { lobbyCode = data.code; });

    host.emit("createLobby", {
      faction: "northern",
      leader: "foltest_son",
      password: "correct",
    });
    await sleep(300);

    let joinErr = null;
    joiner.on("joinError", (data) => { joinErr = data.message; });

    joiner.emit("joinLobby", {
      code: lobbyCode,
      password: "wrong",
      faction: "nilfgaard",
      leader: "emhyr_emperor",
    });
    await sleep(300);

    assert(joinErr !== null, "Got error for wrong password");
    assert(joinErr.includes("password"), `Error message: ${joinErr}`);

    host.disconnect();
    joiner.disconnect();
    await sleep(200);
  }

  // ----- TEST 4: Successful join — game starts -----
  console.log("\nTEST 4: Successful Join — Game Starts");
  {
    const host = io(SERVER_URL, { forceNew: true });
    const joiner = io(SERVER_URL, { forceNew: true });
    await Promise.all([
      new Promise(r => host.on("connect", r)),
      new Promise(r => joiner.on("connect", r)),
    ]);

    let lobbyCode = null;
    host.on("lobbyCreated", (data) => { lobbyCode = data.code; });

    host.emit("createLobby", {
      faction: "northern",
      leader: "foltest_son",
      password: "gwent",
    });
    await sleep(300);

    assert(lobbyCode !== null, "Host got lobby code");

    // Set up game start listeners
    let hostState = null;
    let joinerState = null;
    let hostKey = null;
    let joinerKey = null;

    const startPromise = Promise.all([
      new Promise(r => host.on("gameStart", (d) => { hostKey = d.playerKey; hostState = d.state; r(); })),
      new Promise(r => joiner.on("gameStart", (d) => { joinerKey = d.playerKey; joinerState = d.state; r(); })),
    ]);

    joiner.emit("joinLobby", {
      code: lobbyCode,
      password: "gwent",
      faction: "nilfgaard",
      leader: "emhyr_emperor",
    });

    await startPromise;

    assert(hostKey === "p1", "Host is player 1");
    assert(joinerKey === "p2", "Joiner is player 2");
    assert(hostState !== null, "Host received game state");
    assert(joinerState !== null, "Joiner received game state");
    assert(hostState.phase === "redraw", "Game starts in redraw phase");
    assert(hostState.you.faction === "northern", "Host faction is Northern Realms");
    assert(joinerState.you.faction === "nilfgaard", "Joiner faction is Nilfgaard");
    assert(hostState.you.hand.length === 10, "Host has 10 cards");
    assert(joinerState.you.hand.length === 10, "Joiner has 10 cards");

    host.disconnect();
    joiner.disconnect();
    await sleep(200);
  }

  // ----- TEST 5: Case-insensitive lobby code -----
  console.log("\nTEST 5: Case-Insensitive Lobby Code");
  {
    const host = io(SERVER_URL, { forceNew: true });
    const joiner = io(SERVER_URL, { forceNew: true });
    await Promise.all([
      new Promise(r => host.on("connect", r)),
      new Promise(r => joiner.on("connect", r)),
    ]);

    let lobbyCode = null;
    host.on("lobbyCreated", (data) => { lobbyCode = data.code; });

    host.emit("createLobby", {
      faction: "northern",
      leader: "foltest_son",
      password: "test",
    });
    await sleep(300);

    let gameStarted = false;
    joiner.on("gameStart", () => { gameStarted = true; });

    // Join with lowercase code
    joiner.emit("joinLobby", {
      code: lobbyCode.toLowerCase(),
      password: "test",
      faction: "nilfgaard",
      leader: "emhyr_emperor",
    });
    await sleep(400);

    assert(gameStarted, "Lowercase lobby code accepted");

    host.disconnect();
    joiner.disconnect();
    await sleep(200);
  }

  // ----- TEST 6: Host disconnect removes lobby -----
  console.log("\nTEST 6: Host Disconnect Removes Lobby");
  {
    const host = io(SERVER_URL, { forceNew: true });
    const joiner = io(SERVER_URL, { forceNew: true });
    await Promise.all([
      new Promise(r => host.on("connect", r)),
      new Promise(r => joiner.on("connect", r)),
    ]);

    let lobbyCode = null;
    host.on("lobbyCreated", (data) => { lobbyCode = data.code; });

    host.emit("createLobby", {
      faction: "northern",
      leader: "foltest_son",
      password: "pw",
    });
    await sleep(300);

    // Host disconnects
    host.disconnect();
    await sleep(400);

    // Joiner tries to join the dead lobby
    let joinErr = null;
    joiner.on("joinError", (data) => { joinErr = data.message; });

    joiner.emit("joinLobby", {
      code: lobbyCode,
      password: "pw",
      faction: "nilfgaard",
      leader: "emhyr_emperor",
    });
    await sleep(300);

    assert(joinErr !== null, "Got error when host disconnected");
    console.log(`  Error: ${joinErr}`);

    joiner.disconnect();
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
