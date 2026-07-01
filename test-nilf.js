// Focused test: Nilfgaard wins tied rounds
const { io } = require("socket.io-client");
async function test() {
  const p1 = io("http://localhost:3000", { forceNew: true });
  const p2 = io("http://localhost:3000", { forceNew: true });
  await Promise.all([
    new Promise(r => p1.on("connect", r)),
    new Promise(r => p2.on("connect", r)),
  ]);

  let p1State = null, p2State = null;
  p1.on("gameState", s => p1State = s);
  p2.on("gameState", s => p2State = s);

  const start = Promise.all([
    new Promise(r => p1.on("gameStart", d => { p1State = d.state; r(); })),
    new Promise(r => p2.on("gameStart", d => { p2State = d.state; r(); })),
  ]);

  // Use lobby system: p1 creates, p2 joins
  let lobbyCode = null;
  p1.on("lobbyCreated", d => { lobbyCode = d.code; });
  p1.emit("createLobby", { faction: "northern", leader: "foltest_son", password: "test" });
  await new Promise(r => setTimeout(r, 300));
  p2.emit("joinLobby", { code: lobbyCode, password: "test", faction: "nilfgaard", leader: "emhyr_emperor" });
  await start;

  p1.emit("redraw", { cardUids: [] });
  p2.emit("redraw", { cardUids: [] });
  await new Promise(r => setTimeout(r, 600));

  console.log("P1 faction:", p1State.you.faction);
  console.log("P2 faction:", p2State.you.faction);

  let result = null;
  p1.on("roundEnd", r => result = r);

  if (p1State.isYourTurn) {
    p1.emit("pass");
    await new Promise(r => setTimeout(r, 400));
    p2.emit("pass");
  } else {
    p2.emit("pass");
    await new Promise(r => setTimeout(r, 400));
    p1.emit("pass");
  }
  await new Promise(r => setTimeout(r, 600));

  console.log("Winner:", result.winner);
  console.log("Nilf win:", result.nilfgaardWin);
  console.log("Test:", result.winner === "p2" ? "PASS" : "FAIL");

  p1.disconnect();
  p2.disconnect();
  await new Promise(r => setTimeout(r, 200));
  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
