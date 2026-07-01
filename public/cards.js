// =============================================================================
// public/cards.js — Gwent Card Definitions & Deck Lists
// =============================================================================
// This file defines every card in the game: unit cards, special cards, and
// leader cards. It also defines which cards go into each faction's starting
// deck.
//
// CARD PROPERTIES:
//   name         - Display name shown on the card
//   strength     - Base combat strength (0 for special/leader cards)
//   row          - Which row this card is played on: "melee", "ranged", "siege"
//                  null for special cards that don't go on a row
//   ability      - Special ability: "hero", "spy", "medic", "bond", "morale",
//                  "muster", "weather", "clearWeather", "horn", "scorch",
//                  "decoy", or null for vanilla units
//   hero         - If true, card is immune to weather, scorch, and decoy
//   faction      - Which faction this card belongs to
//   type         - "special" for non-unit cards (weather, horn, scorch, decoy)
//   bondGroup    - Identifier for tight-bond groups (cards that multiply together)
//   weatherType  - For weather cards: "frost", "fog", or "rain"
//
// LEADER CARD PROPERTIES:
//   type         - "leader"
//   leaderAbility - The specific ability this leader grants (see LEADER_ABILITIES)
// =============================================================================

const CARD_DATA = {

  // =========================================================================
  // NORTHERN REALMS — UNIT CARDS
  // =========================================================================

  // --- MELEE ROW ---

  // Hero cards are immune to all effects (weather, scorch, decoy, etc.)
  geralt: {
    name: "Geralt of Rivia",
    strength: 15,
    row: "melee",
    ability: "hero",
    hero: true,
    faction: "neutral"
  },
  ciri: {
    name: "Ciri",
    strength: 15,
    row: "melee",
    ability: "hero",
    hero: true,
    faction: "neutral"
  },
  triss: {
    name: "Triss Merigold",
    strength: 7,
    row: "melee",
    ability: "hero",
    hero: true,
    faction: "northern"
  },
  vernon: {
    name: "Vernon Roche",
    strength: 10,
    row: "melee",
    ability: "hero",
    hero: true,
    faction: "northern"
  },

  // Yennefer is a Hero Medic on ranged row — can revive from discard
  yennefer: {
    name: "Yennefer of Vengerberg",
    strength: 7,
    row: "ranged",
    ability: "medic",
    hero: true,
    faction: "neutral"
  },

  // Tight Bond: when multiple cards share a bondGroup on the same row,
  // each card's strength is multiplied by the count of bond partners
  blueStripes1: {
    name: "Blue Stripes Commando",
    strength: 4,
    row: "melee",
    ability: "bond",
    bondGroup: "blueStripes",
    faction: "northern"
  },
  blueStripes2: {
    name: "Blue Stripes Commando",
    strength: 4,
    row: "melee",
    ability: "bond",
    bondGroup: "blueStripes",
    faction: "northern"
  },
  blueStripes3: {
    name: "Blue Stripes Commando",
    strength: 4,
    row: "melee",
    ability: "bond",
    bondGroup: "blueStripes",
    faction: "northern"
  },

  // Vanilla units — no special abilities, just raw strength
  siegfried: {
    name: "Siegfried of Denesle",
    strength: 5,
    row: "melee",
    ability: null,
    faction: "northern"
  },
  ves: {
    name: "Ves",
    strength: 5,
    row: "melee",
    ability: null,
    faction: "northern"
  },
  yarpen: {
    name: "Yarpen Zigrin",
    strength: 2,
    row: "melee",
    ability: null,
    faction: "northern"
  },

  // Poor Infantry — weak individually, but tight bond multiplies them
  poorInfantry1: {
    name: "Poor F. Infantry",
    strength: 1,
    row: "melee",
    ability: "bond",
    bondGroup: "poorInfantry",
    faction: "northern"
  },
  poorInfantry2: {
    name: "Poor F. Infantry",
    strength: 1,
    row: "melee",
    ability: "bond",
    bondGroup: "poorInfantry",
    faction: "northern"
  },
  poorInfantry3: {
    name: "Poor F. Infantry",
    strength: 1,
    row: "melee",
    ability: "bond",
    bondGroup: "poorInfantry",
    faction: "northern"
  },

  // Spy cards: placed on OPPONENT's board (giving them strength),
  // but you draw 2 cards — a key card-advantage mechanic
  prince: {
    name: "Prince Stennis",
    strength: 5,
    row: "melee",
    ability: "spy",
    faction: "northern"
  },
  thaler: {
    name: "Thaler",
    strength: 1,
    row: "melee",
    ability: "spy",
    faction: "northern"
  },
  dijkstra: {
    name: "Sigismund Dijkstra",
    strength: 4,
    row: "melee",
    ability: "spy",
    faction: "northern"
  },

  // --- RANGED ROW ---
  sheldon: {
    name: "Sheldon Skaggs",
    strength: 4,
    row: "ranged",
    ability: null,
    faction: "northern"
  },
  dethmold: {
    name: "Dethmold",
    strength: 6,
    row: "ranged",
    ability: null,
    faction: "northern"
  },
  keira: {
    name: "Keira Metz",
    strength: 5,
    row: "ranged",
    ability: null,
    faction: "northern"
  },
  sile: {
    name: "Sile de Tansarville",
    strength: 5,
    row: "ranged",
    ability: null,
    faction: "northern"
  },
  sabrina: {
    name: "Sabrina Glevissig",
    strength: 4,
    row: "ranged",
    ability: null,
    faction: "northern"
  },

  // Crinfrid Reavers — tight bond ranged units
  crinfrid1: {
    name: "Crinfrid Reaver",
    strength: 5,
    row: "ranged",
    ability: "bond",
    bondGroup: "crinfrid",
    faction: "northern"
  },
  crinfrid2: {
    name: "Crinfrid Reaver",
    strength: 5,
    row: "ranged",
    ability: "bond",
    bondGroup: "crinfrid",
    faction: "northern"
  },
  crinfrid3: {
    name: "Crinfrid Reaver",
    strength: 5,
    row: "ranged",
    ability: "bond",
    bondGroup: "crinfrid",
    faction: "northern"
  },

  // --- SIEGE ROW ---
  trebuchet1: {
    name: "Trebuchet",
    strength: 6,
    row: "siege",
    ability: null,
    faction: "northern"
  },
  trebuchet2: {
    name: "Trebuchet",
    strength: 6,
    row: "siege",
    ability: null,
    faction: "northern"
  },
  ballista1: {
    name: "Ballista",
    strength: 6,
    row: "siege",
    ability: null,
    faction: "northern"
  },
  ballista2: {
    name: "Ballista",
    strength: 6,
    row: "siege",
    ability: null,
    faction: "northern"
  },

  // Catapults — tight bond siege units, very powerful together (8 * 2 = 16 each)
  catapult1: {
    name: "Catapult",
    strength: 8,
    row: "siege",
    ability: "bond",
    bondGroup: "catapult",
    faction: "northern"
  },
  catapult2: {
    name: "Catapult",
    strength: 8,
    row: "siege",
    ability: "bond",
    bondGroup: "catapult",
    faction: "northern"
  },

  // Morale Boost: +1 strength to ALL other cards on the same row
  kaedwen1: {
    name: "Kaedweni Siege Expert",
    strength: 1,
    row: "siege",
    ability: "morale",
    faction: "northern"
  },
  kaedwen2: {
    name: "Kaedweni Siege Expert",
    strength: 1,
    row: "siege",
    ability: "morale",
    faction: "northern"
  },

  // Medic: when played, revive one non-hero unit from your discard pile
  dun: {
    name: "Dun Banner Medic",
    strength: 5,
    row: "siege",
    ability: "medic",
    faction: "northern"
  },

  // =========================================================================
  // NILFGAARD — UNIT CARDS
  // =========================================================================

  // --- HEROES ---
  letho: {
    name: "Letho of Gulet",
    strength: 10,
    row: "melee",
    ability: "hero",
    hero: true,
    faction: "nilfgaard"
  },
  menno: {
    name: "Menno Coehoorn",
    strength: 10,
    row: "melee",
    ability: "hero",
    hero: true,
    faction: "nilfgaard"
  },
  morvran: {
    name: "Morvran Voorhis",
    strength: 10,
    row: "siege",
    ability: "hero",
    hero: true,
    faction: "nilfgaard"
  },
  tibor: {
    name: "Tibor Eggebracht",
    strength: 10,
    row: "ranged",
    ability: "hero",
    hero: true,
    faction: "nilfgaard"
  },

  // --- SPIES (Nilfgaard is the spy-heavy faction) ---
  vattier: {
    name: "Vattier de Rideaux",
    strength: 4,
    row: "melee",
    ability: "spy",
    faction: "nilfgaard"
  },
  shilard: {
    name: "Shilard Fitz-Oesterlen",
    strength: 7,
    row: "melee",
    ability: "spy",
    faction: "nilfgaard"
  },
  stefan: {
    name: "Stefan Skellen",
    strength: 9,
    row: "melee",
    ability: "spy",
    faction: "nilfgaard"
  },
  cynthia: {
    name: "Cynthia",
    strength: 4,
    row: "ranged",
    ability: "spy",
    faction: "nilfgaard"
  },

  // --- TIGHT BOND UNITS ---
  impera1: {
    name: "Impera Brigade",
    strength: 3,
    row: "melee",
    ability: "bond",
    bondGroup: "impera",
    faction: "nilfgaard"
  },
  impera2: {
    name: "Impera Brigade",
    strength: 3,
    row: "melee",
    ability: "bond",
    bondGroup: "impera",
    faction: "nilfgaard"
  },
  impera3: {
    name: "Impera Brigade",
    strength: 3,
    row: "melee",
    ability: "bond",
    bondGroup: "impera",
    faction: "nilfgaard"
  },
  impera4: {
    name: "Impera Brigade",
    strength: 3,
    row: "melee",
    ability: "bond",
    bondGroup: "impera",
    faction: "nilfgaard"
  },

  nausicaa1: {
    name: "Nausicaa Cavalry",
    strength: 3,
    row: "melee",
    ability: "bond",
    bondGroup: "nausicaa",
    faction: "nilfgaard"
  },
  nausicaa2: {
    name: "Nausicaa Cavalry",
    strength: 3,
    row: "melee",
    ability: "bond",
    bondGroup: "nausicaa",
    faction: "nilfgaard"
  },
  nausicaa3: {
    name: "Nausicaa Cavalry",
    strength: 3,
    row: "melee",
    ability: "bond",
    bondGroup: "nausicaa",
    faction: "nilfgaard"
  },

  // --- RANGED UNITS ---
  albrich: {
    name: "Albrich",
    strength: 2,
    row: "ranged",
    ability: null,
    faction: "nilfgaard"
  },
  assire: {
    name: "Assire var Anahid",
    strength: 6,
    row: "ranged",
    ability: null,
    faction: "nilfgaard"
  },
  fringilla: {
    name: "Fringilla Vigo",
    strength: 6,
    row: "ranged",
    ability: null,
    faction: "nilfgaard"
  },
  vanhemar: {
    name: "Vanhemar",
    strength: 4,
    row: "ranged",
    ability: null,
    faction: "nilfgaard"
  },
  sweers: {
    name: "Sweers",
    strength: 2,
    row: "ranged",
    ability: null,
    faction: "nilfgaard"
  },
  renuald: {
    name: "Renuald aep Matsen",
    strength: 5,
    row: "ranged",
    ability: null,
    faction: "nilfgaard"
  },
  puttkammer: {
    name: "Puttkammer",
    strength: 3,
    row: "ranged",
    ability: null,
    faction: "nilfgaard"
  },

  // --- SIEGE UNITS ---
  heavyZerri: {
    name: "Zerrikanian Fire Scorpion",
    strength: 10,
    row: "siege",
    ability: null,
    faction: "nilfgaard"
  },

  // Siege medics — 0 strength but revive a discarded unit
  nilSiege1: {
    name: "Siege Technician",
    strength: 0,
    row: "siege",
    ability: "medic",
    faction: "nilfgaard"
  },
  nilSiege2: {
    name: "Siege Technician",
    strength: 0,
    row: "siege",
    ability: "medic",
    faction: "nilfgaard"
  },
  nilEngineer: {
    name: "Siege Engineer",
    strength: 6,
    row: "siege",
    ability: null,
    faction: "nilfgaard"
  },

  // --- MELEE VANILLA ---
  morteisen: {
    name: "Morteisen",
    strength: 3,
    row: "melee",
    ability: null,
    faction: "nilfgaard"
  },
  rainfarn: {
    name: "Rainfarn",
    strength: 4,
    row: "melee",
    ability: null,
    faction: "nilfgaard"
  },
  cahir: {
    name: "Cahir Mawr Dyffryn",
    strength: 6,
    row: "melee",
    ability: null,
    faction: "nilfgaard"
  },

  // Medics
  etolian1: {
    name: "Etolian Auxiliary",
    strength: 1,
    row: "melee",
    ability: "medic",
    faction: "nilfgaard"
  },
  vivaldi: {
    name: "Vreemde",
    strength: 2,
    row: "melee",
    ability: null,
    faction: "nilfgaard"
  },

  // =========================================================================
  // SCOIA'TAEL — UNIT CARDS
  // =========================================================================

  // --- HEROES ---
  isengrim: {
    name: "Isengrim Faoiltiarna",
    strength: 10,
    row: "melee",
    ability: "hero",
    hero: true,
    faction: "scoiatael"
  },
  iorveth: {
    name: "Iorveth",
    strength: 10,
    row: "ranged",
    ability: "hero",
    hero: true,
    faction: "scoiatael"
  },
  saskia: {
    name: "Saskia",
    strength: 10,
    row: "ranged",
    ability: "hero",
    hero: true,
    faction: "scoiatael"
  },
  eithne: {
    name: "Eithne",
    strength: 10,
    row: "ranged",
    ability: "hero",
    hero: true,
    faction: "scoiatael"
  },

  // --- AGILE UNITS (can play on melee OR ranged) ---
  filavandrel: {
    name: "Filavandrel",
    strength: 6,
    row: "agile",
    ability: null,
    faction: "scoiatael"
  },
  ida: {
    name: "Ida Emean",
    strength: 6,
    row: "ranged",
    ability: null,
    faction: "scoiatael"
  },
  toruviel: {
    name: "Toruviel",
    strength: 2,
    row: "ranged",
    ability: null,
    faction: "scoiatael"
  },
  ciaran: {
    name: "Ciaran aep Easnillen",
    strength: 3,
    row: "agile",
    ability: null,
    faction: "scoiatael"
  },
  dennis: {
    name: "Dennis Cranmer",
    strength: 6,
    row: "melee",
    ability: null,
    faction: "scoiatael"
  },
  milva: {
    name: "Milva",
    strength: 6,
    row: "ranged",
    ability: null,
    faction: "scoiatael"
  },

  // --- SPIES ---
  scoia_spy1: {
    name: "Yaevinn",
    strength: 2,
    row: "melee",
    ability: "spy",
    faction: "scoiatael"
  },
  scoia_spy2: {
    name: "Schirru",
    strength: 8,
    row: "siege",
    ability: "spy",
    faction: "scoiatael"
  },

  // --- MEDICS ---
  scoia_medic: {
    name: "Havekar Healer",
    strength: 0,
    row: "ranged",
    ability: "medic",
    faction: "scoiatael"
  },

  // --- TIGHT BOND: Havekar Smuggler ---
  havekar1: {
    name: "Havekar Smuggler",
    strength: 5,
    row: "melee",
    ability: "bond",
    bondGroup: "havekar",
    faction: "scoiatael"
  },
  havekar2: {
    name: "Havekar Smuggler",
    strength: 5,
    row: "melee",
    ability: "bond",
    bondGroup: "havekar",
    faction: "scoiatael"
  },
  havekar3: {
    name: "Havekar Smuggler",
    strength: 5,
    row: "melee",
    ability: "bond",
    bondGroup: "havekar",
    faction: "scoiatael"
  },

  // --- TIGHT BOND: Dwarven Skirmisher ---
  dwarfSkirmish1: {
    name: "Dwarven Skirmisher",
    strength: 3,
    row: "melee",
    ability: "bond",
    bondGroup: "dwarfSkirmish",
    faction: "scoiatael"
  },
  dwarfSkirmish2: {
    name: "Dwarven Skirmisher",
    strength: 3,
    row: "melee",
    ability: "bond",
    bondGroup: "dwarfSkirmish",
    faction: "scoiatael"
  },
  dwarfSkirmish3: {
    name: "Dwarven Skirmisher",
    strength: 3,
    row: "melee",
    ability: "bond",
    bondGroup: "dwarfSkirmish",
    faction: "scoiatael"
  },

  // --- TIGHT BOND: Elven Skirmisher ---
  elfSkirmish1: {
    name: "Elven Skirmisher",
    strength: 2,
    row: "ranged",
    ability: "bond",
    bondGroup: "elfSkirmish",
    faction: "scoiatael"
  },
  elfSkirmish2: {
    name: "Elven Skirmisher",
    strength: 2,
    row: "ranged",
    ability: "bond",
    bondGroup: "elfSkirmish",
    faction: "scoiatael"
  },
  elfSkirmish3: {
    name: "Elven Skirmisher",
    strength: 2,
    row: "ranged",
    ability: "bond",
    bondGroup: "elfSkirmish",
    faction: "scoiatael"
  },

  // --- MORALE / SIEGE ---
  mahakam1: {
    name: "Mahakaman Defender",
    strength: 5,
    row: "melee",
    ability: null,
    faction: "scoiatael"
  },
  vrihedd1: {
    name: "Vrihedd Dragoon",
    strength: 5,
    row: "ranged",
    ability: null,
    faction: "scoiatael"
  },
  vrihedd2: {
    name: "Vrihedd Vanguard",
    strength: 5,
    row: "melee",
    ability: null,
    faction: "scoiatael"
  },

  // --- SIEGE ---
  scoia_siege1: {
    name: "Dol Blathanna Scout",
    strength: 6,
    row: "siege",
    ability: null,
    faction: "scoiatael"
  },
  scoia_siege2: {
    name: "Dol Blathanna Trapper",
    strength: 4,
    row: "siege",
    ability: null,
    faction: "scoiatael"
  },
  scoia_siege3: {
    name: "Vrihedd Sapper",
    strength: 1,
    row: "siege",
    ability: "morale",
    faction: "scoiatael"
  },

  // --- SCOIA'TAEL LEADERS ---
  francesca_beautiful: {
    name: "Francesca: The Beautiful",
    strength: 0,
    row: null,
    type: "leader",
    faction: "scoiatael",
    leaderAbility: "destroyEnemySiege",
    description: "Destroy opponent's strongest Siege unit(s) if Siege row is 10+."
  },
  francesca_daisy: {
    name: "Francesca: Daisy of the Valley",
    strength: 0,
    row: null,
    type: "leader",
    faction: "scoiatael",
    leaderAbility: "drawExtraCard",
    description: "Draw an extra card from your deck."
  },
  francesca_hope: {
    name: "Francesca: Hope of the Aen Seidhe",
    strength: 0,
    row: null,
    type: "leader",
    faction: "scoiatael",
    leaderAbility: "doubleRanged",
    description: "Doubles the strength of all your Ranged units."
  },
  francesca_queen: {
    name: "Francesca: Queen of Dol Blathanna",
    strength: 0,
    row: null,
    type: "leader",
    faction: "scoiatael",
    leaderAbility: "playRain",
    description: "Play a Torrential Rain from your deck."
  },

  // =========================================================================
  // MONSTERS — UNIT CARDS
  // =========================================================================

  // --- HEROES ---
  kayran: {
    name: "Kayran",
    strength: 8,
    row: "agile",
    ability: "hero",
    hero: true,
    faction: "monsters"
  },
  leshen: {
    name: "Leshen",
    strength: 10,
    row: "ranged",
    ability: "hero",
    hero: true,
    faction: "monsters"
  },
  draug: {
    name: "Draug",
    strength: 10,
    row: "melee",
    ability: "hero",
    hero: true,
    faction: "monsters"
  },
  imlerith: {
    name: "Imlerith",
    strength: 10,
    row: "melee",
    ability: "hero",
    hero: true,
    faction: "monsters"
  },

  // --- MUSTER: Arachas (play one, all copies from hand/deck deploy) ---
  arachas1: {
    name: "Arachas",
    strength: 4,
    row: "melee",
    ability: "muster",
    musterGroup: "arachas",
    faction: "monsters"
  },
  arachas2: {
    name: "Arachas",
    strength: 4,
    row: "melee",
    ability: "muster",
    musterGroup: "arachas",
    faction: "monsters"
  },
  arachas3: {
    name: "Arachas",
    strength: 4,
    row: "melee",
    ability: "muster",
    musterGroup: "arachas",
    faction: "monsters"
  },

  // --- MUSTER: Nekker ---
  nekker1: {
    name: "Nekker",
    strength: 2,
    row: "melee",
    ability: "muster",
    musterGroup: "nekker",
    faction: "monsters"
  },
  nekker2: {
    name: "Nekker",
    strength: 2,
    row: "melee",
    ability: "muster",
    musterGroup: "nekker",
    faction: "monsters"
  },
  nekker3: {
    name: "Nekker",
    strength: 2,
    row: "melee",
    ability: "muster",
    musterGroup: "nekker",
    faction: "monsters"
  },

  // --- MUSTER: Crones (one on each row) ---
  crone_weavess: {
    name: "Crone: Weavess",
    strength: 6,
    row: "melee",
    ability: "muster",
    musterGroup: "crone",
    faction: "monsters"
  },
  crone_brewess: {
    name: "Crone: Brewess",
    strength: 6,
    row: "melee",
    ability: "muster",
    musterGroup: "crone",
    faction: "monsters"
  },
  crone_whispess: {
    name: "Crone: Whispess",
    strength: 6,
    row: "melee",
    ability: "muster",
    musterGroup: "crone",
    faction: "monsters"
  },

  // --- TIGHT BOND: Vampire ---
  vampire1: {
    name: "Ekimmara",
    strength: 4,
    row: "melee",
    ability: "bond",
    bondGroup: "vampire",
    faction: "monsters"
  },
  vampire2: {
    name: "Garkain",
    strength: 4,
    row: "melee",
    ability: "bond",
    bondGroup: "vampire",
    faction: "monsters"
  },

  // --- RANGED UNITS ---
  fiend: {
    name: "Fiend",
    strength: 6,
    row: "melee",
    ability: null,
    faction: "monsters"
  },
  forktail: {
    name: "Forktail",
    strength: 5,
    row: "melee",
    ability: null,
    faction: "monsters"
  },
  frightener: {
    name: "Frightener",
    strength: 5,
    row: "melee",
    ability: null,
    faction: "monsters"
  },
  griffin: {
    name: "Griffin",
    strength: 5,
    row: "melee",
    ability: null,
    faction: "monsters"
  },
  werewolf: {
    name: "Werewolf",
    strength: 5,
    row: "melee",
    ability: null,
    faction: "monsters"
  },
  harpy: {
    name: "Harpy",
    strength: 2,
    row: "agile",
    ability: null,
    faction: "monsters"
  },
  foglet: {
    name: "Foglet",
    strength: 2,
    row: "melee",
    ability: null,
    faction: "monsters"
  },

  // --- RANGED ---
  gargoyle: {
    name: "Gargoyle",
    strength: 2,
    row: "ranged",
    ability: null,
    faction: "monsters"
  },
  cockatrice: {
    name: "Cockatrice",
    strength: 2,
    row: "ranged",
    ability: null,
    faction: "monsters"
  },
  endrega: {
    name: "Endrega",
    strength: 2,
    row: "ranged",
    ability: null,
    faction: "monsters"
  },

  // --- SIEGE ---
  earthElemental: {
    name: "Earth Elemental",
    strength: 6,
    row: "siege",
    ability: null,
    faction: "monsters"
  },
  fireElemental: {
    name: "Fire Elemental",
    strength: 6,
    row: "siege",
    ability: null,
    faction: "monsters"
  },
  iceGiant: {
    name: "Ice Giant",
    strength: 5,
    row: "siege",
    ability: null,
    faction: "monsters"
  },

  // --- MEDIC ---
  ghoul1: {
    name: "Ghoul",
    strength: 1,
    row: "melee",
    ability: "medic",
    faction: "monsters"
  },

  // --- MONSTERS LEADERS ---
  eredin_bringer: {
    name: "Eredin: Bringer of Death",
    strength: 0,
    row: null,
    type: "leader",
    faction: "monsters",
    leaderAbility: "doubleMelee",
    description: "Doubles the strength of all your Melee units."
  },
  eredin_destroyer: {
    name: "Eredin: Destroyer of Worlds",
    strength: 0,
    row: null,
    type: "leader",
    faction: "monsters",
    leaderAbility: "discardAndDraw2",
    description: "Discard 2 cards and draw 2 replacements from your deck."
  },
  eredin_commander: {
    name: "Eredin: Commander of the Red Riders",
    strength: 0,
    row: null,
    type: "leader",
    faction: "monsters",
    leaderAbility: "playFrost",
    description: "Play a Biting Frost from your deck."
  },
  eredin_king: {
    name: "Eredin: King of the Wild Hunt",
    strength: 0,
    row: null,
    type: "leader",
    faction: "monsters",
    leaderAbility: "restoreMonstersUnit",
    description: "Revive a unit card from your discard pile."
  },

  // =========================================================================
  // SKELLIGE — UNIT CARDS
  // =========================================================================

  // --- HEROES ---
  cerys: {
    name: "Cerys an Craite",
    strength: 10,
    row: "melee",
    ability: "hero",
    hero: true,
    faction: "skellige"
  },
  hjalmar: {
    name: "Hjalmar an Craite",
    strength: 10,
    row: "melee",
    ability: "hero",
    hero: true,
    faction: "skellige"
  },
  ermion: {
    name: "Ermion",
    strength: 8,
    row: "ranged",
    ability: "hero",
    hero: true,
    faction: "skellige"
  },
  madmanLugos: {
    name: "Madman Lugos",
    strength: 6,
    row: "melee",
    ability: "hero",
    hero: true,
    faction: "skellige"
  },

  // --- TIGHT BOND: Berserkers ---
  berserker1: {
    name: "Berserker",
    strength: 4,
    row: "melee",
    ability: "bond",
    bondGroup: "berserker",
    faction: "skellige"
  },
  berserker2: {
    name: "Berserker",
    strength: 4,
    row: "melee",
    ability: "bond",
    bondGroup: "berserker",
    faction: "skellige"
  },
  berserker3: {
    name: "Berserker",
    strength: 4,
    row: "melee",
    ability: "bond",
    bondGroup: "berserker",
    faction: "skellige"
  },

  // --- TIGHT BOND: Clan Dimun Pirate ---
  clanDimun1: {
    name: "Clan Dimun Pirate",
    strength: 6,
    row: "ranged",
    ability: "bond",
    bondGroup: "clanDimun",
    faction: "skellige"
  },
  clanDimun2: {
    name: "Clan Dimun Pirate",
    strength: 6,
    row: "ranged",
    ability: "bond",
    bondGroup: "clanDimun",
    faction: "skellige"
  },

  // --- SHIELD MAIDENS (tight bond) ---
  shieldMaiden1: {
    name: "Clan Drummond Shield Maiden",
    strength: 4,
    row: "melee",
    ability: "bond",
    bondGroup: "shieldMaiden",
    faction: "skellige"
  },
  shieldMaiden2: {
    name: "Clan Drummond Shield Maiden",
    strength: 4,
    row: "melee",
    ability: "bond",
    bondGroup: "shieldMaiden",
    faction: "skellige"
  },
  shieldMaiden3: {
    name: "Clan Drummond Shield Maiden",
    strength: 4,
    row: "melee",
    ability: "bond",
    bondGroup: "shieldMaiden",
    faction: "skellige"
  },

  // --- SPIES ---
  skel_spy1: {
    name: "Udalryk",
    strength: 4,
    row: "melee",
    ability: "spy",
    faction: "skellige"
  },
  skel_spy2: {
    name: "Donar an Hindar",
    strength: 2,
    row: "melee",
    ability: "spy",
    faction: "skellige"
  },

  // --- MEDICS ---
  skel_medic1: {
    name: "Clan Tordarroch Shieldsmith",
    strength: 4,
    row: "siege",
    ability: "medic",
    faction: "skellige"
  },
  skel_medic2: {
    name: "Restoration",
    strength: 0,
    row: "siege",
    ability: "medic",
    faction: "skellige"
  },

  // --- MELEE UNITS ---
  blueboy: {
    name: "Blueboy Lugos",
    strength: 6,
    row: "melee",
    ability: null,
    faction: "skellige"
  },
  svanrige: {
    name: "Svanrige Tuirseach",
    strength: 4,
    row: "melee",
    ability: null,
    faction: "skellige"
  },
  holger: {
    name: "Holger Blackhand",
    strength: 4,
    row: "melee",
    ability: null,
    faction: "skellige"
  },
  olaf: {
    name: "Olaf",
    strength: 12,
    row: "agile",
    ability: null,
    faction: "skellige"
  },

  // --- RANGED UNITS ---
  birna: {
    name: "Birna Bran",
    strength: 2,
    row: "ranged",
    ability: "medic",
    faction: "skellige"
  },
  draig: {
    name: "Draig Bon-Dhu",
    strength: 2,
    row: "ranged",
    ability: "morale",
    faction: "skellige"
  },
  mousesack: {
    name: "Mousesack",
    strength: 6,
    row: "ranged",
    ability: null,
    faction: "skellige"
  },

  // --- SIEGE UNITS ---
  warShip1: {
    name: "Clan Dimun War Longship",
    strength: 6,
    row: "siege",
    ability: null,
    faction: "skellige"
  },
  warShip2: {
    name: "Clan Dimun War Longship",
    strength: 6,
    row: "siege",
    ability: null,
    faction: "skellige"
  },
  catapultSkel: {
    name: "Clan Tordarroch Armorsmith",
    strength: 4,
    row: "siege",
    ability: null,
    faction: "skellige"
  },

  // --- SKELLIGE LEADERS ---
  crach_warrior: {
    name: "Crach an Craite: The Warrior",
    strength: 0,
    row: null,
    type: "leader",
    faction: "skellige",
    leaderAbility: "scorchMelee",
    description: "Destroy opponent's strongest Melee unit(s) if Melee row is 10+."
  },
  crach_navigator: {
    name: "Crach an Craite: The Navigator",
    strength: 0,
    row: null,
    type: "leader",
    faction: "skellige",
    leaderAbility: "shuffleDiscard",
    description: "Shuffle all discarded cards back into your deck."
  },
  crach_tideborn: {
    name: "Crach an Craite: Tideborn",
    strength: 0,
    row: null,
    type: "leader",
    faction: "skellige",
    leaderAbility: "clearWeather",
    description: "Clear all weather effects in play."
  },
  crach_kingBran: {
    name: "King Bran",
    strength: 0,
    row: null,
    type: "leader",
    faction: "skellige",
    leaderAbility: "doubleSiege",
    description: "Doubles the strength of all your Siege units."
  },

  // =========================================================================
  // SPECIAL CARDS — No strength, powerful effects
  // =========================================================================

  // Weather cards: reduce all non-hero units in the affected row to
  // strength 1. Affects BOTH players' rows of that type.
  frost: {
    name: "Biting Frost",
    strength: 0,
    row: null,
    ability: "weather",
    weatherType: "frost", // Affects melee row
    type: "special"
  },
  fog: {
    name: "Impenetrable Fog",
    strength: 0,
    row: null,
    ability: "weather",
    weatherType: "fog", // Affects ranged row
    type: "special"
  },
  rain: {
    name: "Torrential Rain",
    strength: 0,
    row: null,
    ability: "weather",
    weatherType: "rain", // Affects siege row
    type: "special"
  },

  // Clear Weather: removes ALL active weather effects
  clearWeather: {
    name: "Clear Weather",
    strength: 0,
    row: null,
    ability: "clearWeather",
    type: "special"
  },

  // Commander's Horn: doubles the strength of all non-hero units in a row.
  // Only one horn per row. The player chooses which row when playing.
  hornMelee: {
    name: "Commander's Horn",
    strength: 0,
    row: "melee",
    ability: "horn",
    type: "special"
  },
  hornRanged: {
    name: "Commander's Horn",
    strength: 0,
    row: "ranged",
    ability: "horn",
    type: "special"
  },
  hornSiege: {
    name: "Commander's Horn",
    strength: 0,
    row: "siege",
    ability: "horn",
    type: "special"
  },

  // Scorch: destroys the strongest non-hero unit card(s) on the entire
  // battlefield (both players). If multiple cards share the highest
  // strength, ALL of them are destroyed.
  scorch: {
    name: "Scorch",
    strength: 0,
    row: null,
    ability: "scorch",
    type: "special"
  },

  // Decoy: swap this card with one of your non-hero units on the board,
  // returning that unit to your hand. Great for reusing spy or medic cards.
  decoy: {
    name: "Decoy",
    strength: 0,
    row: null,
    ability: "decoy",
    type: "special"
  },

  // =========================================================================
  // LEADER CARDS — One per game, powerful unique ability
  // =========================================================================
  // Leader cards are not part of the normal deck. Each player picks one
  // leader at the start, and can activate its ability once per game.

  // --- NORTHERN REALMS LEADERS ---
  foltest_siegemaster: {
    name: "Foltest: The Siegemaster",
    strength: 0,
    row: null,
    type: "leader",
    faction: "northern",
    // Doubles the strength of all siege units (acts like a free horn on siege)
    leaderAbility: "doubleSiege",
    description: "Doubles the strength of all your Siege units."
  },
  foltest_son: {
    name: "Foltest: Son of Medell",
    strength: 0,
    row: null,
    type: "leader",
    faction: "northern",
    // Clears all weather effects currently in play
    leaderAbility: "clearWeather",
    description: "Clear all weather effects in play."
  },
  foltest_steel: {
    name: "Foltest: The Steel-Forged",
    strength: 0,
    row: null,
    type: "leader",
    faction: "northern",
    // Destroys opponent's strongest siege unit(s) if siege row total >= 10
    leaderAbility: "scorchSiege",
    description: "Destroy opponent's strongest Siege unit(s) if their Siege row is 10+."
  },
  foltest_lord: {
    name: "Foltest: Lord Commander",
    strength: 0,
    row: null,
    type: "leader",
    faction: "northern",
    // Pick a fog card from your deck and play it
    leaderAbility: "playFog",
    description: "Play an Impenetrable Fog from your deck."
  },

  // --- NILFGAARD LEADERS ---
  emhyr_emperor: {
    name: "Emhyr: Emperor of Nilfgaard",
    strength: 0,
    row: null,
    type: "leader",
    faction: "nilfgaard",
    // Look at 3 random cards from opponent's hand
    leaderAbility: "viewOpponent",
    description: "Look at 3 random cards from your opponent's hand."
  },
  emhyr_whiteflame: {
    name: "Emhyr: The White Flame",
    strength: 0,
    row: null,
    type: "leader",
    faction: "nilfgaard",
    // Cancel opponent's leader card ability
    leaderAbility: "cancelLeader",
    description: "Cancel your opponent's Leader Card ability."
  },
  emhyr_relentless: {
    name: "Emhyr: The Relentless",
    strength: 0,
    row: null,
    type: "leader",
    faction: "nilfgaard",
    // Draw a card from your opponent's discard pile
    leaderAbility: "stealDiscard",
    description: "Draw a card from opponent's discard pile."
  },
  emhyr_invader: {
    name: "Emhyr: Invader of the North",
    strength: 0,
    row: null,
    type: "leader",
    faction: "nilfgaard",
    // Play a unit from your opponent's discard pile as your own
    leaderAbility: "playFromDiscard",
    description: "Play a unit from opponent's discard pile."
  },
};

// =============================================================================
// FACTION PASSIVE ABILITIES
// =============================================================================
// Each faction has a passive that triggers automatically:
//   northern:   Draw 1 extra card when you win a round
//   nilfgaard:  Win any round that ends in a draw (tie)
const FACTION_PASSIVES = {
  northern: "drawOnWin",     // Draw a card from deck when you win a round
  nilfgaard: "winOnDraw",    // Automatically win tied rounds instead of both losing
  scoiatael: "chooseFirst",  // Choose who goes first each round
  monsters: "keepUnit",      // 1 random non-hero unit stays on board after round
  skellige: "reviveTwo",     // 2 random cards from graveyard return to hand each round
};

// =============================================================================
// LEADER OPTIONS — Available leaders per faction for selection
// =============================================================================
const LEADERS = {
  northern: [
    "foltest_siegemaster",
    "foltest_son",
    "foltest_steel",
    "foltest_lord",
  ],
  nilfgaard: [
    "emhyr_emperor",
    "emhyr_whiteflame",
    "emhyr_relentless",
    "emhyr_invader",
  ],
  scoiatael: [
    "francesca_beautiful",
    "francesca_daisy",
    "francesca_hope",
    "francesca_queen",
  ],
  monsters: [
    "eredin_bringer",
    "eredin_destroyer",
    "eredin_commander",
    "eredin_king",
  ],
  skellige: [
    "crach_warrior",
    "crach_navigator",
    "crach_tideborn",
    "crach_kingBran",
  ],
};

// =============================================================================
// DECK DEFINITIONS — Which card IDs each faction starts with
// =============================================================================
// Each player draws 10 cards from their shuffled deck at game start.
// The remaining cards stay in the deck and can be drawn via spy abilities.
const DECKS = {
  northern: [
    // Heroes (immune to effects)
    "triss", "vernon",
    // Tight bond melee
    "blueStripes1", "blueStripes2", "blueStripes3",
    // Vanilla melee
    "siegfried", "ves", "yarpen",
    // Tight bond melee (weak but multiply)
    "poorInfantry1", "poorInfantry2", "poorInfantry3",
    // Spies (draw 2 cards each)
    "prince", "thaler", "dijkstra",
    // Ranged units
    "sheldon", "dethmold", "keira", "sile", "sabrina",
    // Tight bond ranged
    "crinfrid1", "crinfrid2", "crinfrid3",
    // Siege units
    "trebuchet1", "trebuchet2", "ballista1", "ballista2",
    // Tight bond siege
    "catapult1", "catapult2",
    // Morale boost siege
    "kaedwen1", "kaedwen2",
    // Medic
    "dun",
    // Neutral heroes
    "geralt", "ciri",
    // Special cards
    "frost", "fog", "clearWeather", "hornMelee", "hornSiege", "scorch", "decoy",
  ],
  nilfgaard: [
    // Heroes
    "letho", "menno", "morvran", "tibor",
    // Spies (Nilfgaard has the most spies — their key strategy)
    "vattier", "shilard", "stefan", "cynthia",
    // Tight bond melee
    "impera1", "impera2", "impera3", "impera4",
    "nausicaa1", "nausicaa2", "nausicaa3",
    // Ranged units
    "albrich", "assire", "fringilla", "vanhemar", "sweers", "renuald", "puttkammer",
    // Siege units
    "heavyZerri", "nilSiege1", "nilSiege2", "nilEngineer",
    // Melee units
    "morteisen", "rainfarn", "cahir",
    // Medic and support
    "etolian1", "vivaldi",
    // Neutral heroes
    "geralt", "ciri", "yennefer",
    // Special cards
    "frost", "rain", "clearWeather", "hornRanged", "hornMelee", "scorch", "decoy",
  ],
  scoiatael: [
    // Heroes
    "isengrim", "iorveth", "saskia", "eithne",
    // Agile units
    "filavandrel", "ciaran",
    // Ranged
    "ida", "toruviel", "milva", "vrihedd1",
    // Melee
    "dennis", "mahakam1", "vrihedd2",
    // Spies
    "scoia_spy1", "scoia_spy2",
    // Medic
    "scoia_medic",
    // Tight bonds
    "havekar1", "havekar2", "havekar3",
    "dwarfSkirmish1", "dwarfSkirmish2", "dwarfSkirmish3",
    "elfSkirmish1", "elfSkirmish2", "elfSkirmish3",
    // Siege
    "scoia_siege1", "scoia_siege2", "scoia_siege3",
    // Neutral heroes
    "geralt", "ciri", "yennefer",
    // Special cards
    "frost", "fog", "clearWeather", "hornMelee", "hornRanged", "scorch", "decoy",
  ],
  monsters: [
    // Heroes
    "kayran", "leshen", "draug", "imlerith",
    // Muster groups
    "arachas1", "arachas2", "arachas3",
    "nekker1", "nekker2", "nekker3",
    "crone_weavess", "crone_brewess", "crone_whispess",
    // Tight bond vampires
    "vampire1", "vampire2",
    // Melee
    "fiend", "forktail", "frightener", "griffin", "werewolf", "foglet",
    // Agile
    "harpy",
    // Ranged
    "gargoyle", "cockatrice", "endrega",
    // Siege
    "earthElemental", "fireElemental", "iceGiant",
    // Medic
    "ghoul1",
    // Neutral heroes
    "geralt", "ciri",
    // Special cards
    "frost", "fog", "rain", "clearWeather", "hornMelee", "scorch", "decoy",
  ],
  skellige: [
    // Heroes
    "cerys", "hjalmar", "ermion", "madmanLugos",
    // Tight bonds
    "berserker1", "berserker2", "berserker3",
    "clanDimun1", "clanDimun2",
    "shieldMaiden1", "shieldMaiden2", "shieldMaiden3",
    // Spies
    "skel_spy1", "skel_spy2",
    // Medics
    "skel_medic1", "skel_medic2", "birna",
    // Melee
    "blueboy", "svanrige", "holger", "olaf",
    // Ranged
    "draig", "mousesack",
    // Siege
    "warShip1", "warShip2", "catapultSkel",
    // Neutral heroes
    "geralt", "ciri", "yennefer",
    // Special cards
    "frost", "rain", "clearWeather", "hornSiege", "hornMelee", "scorch", "decoy",
  ],
};

// =============================================================================
// MODULE EXPORT — Works in both Node.js (server) and browser (client)
// =============================================================================
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CARD_DATA, DECKS, LEADERS, FACTION_PASSIVES };
}
