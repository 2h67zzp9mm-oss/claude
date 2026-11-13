"use strict";
/**
 * Reasons to keep playing the home plot (used by lib/homestead.js):
 *  - Levels: everything you do earns XP; each level pays stars and some unlock a perk, a new fish or a pet.
 *  - Story: every world has its own little story, told a chapter at a time by a guide who gives you jobs.
 *  - Family build: the whole family gives crops, fish and stars to build something big in stages.
 *  - Collection book: pages of fish, crops and pets to fill in, with a prize for each finished page.
 */

const XP = { plant: 2, water: 1, harvest: 4, fish: 4, sell: 2, mail: 3, treat: 2, petFeed: 2, give: 2, giveStars: 2 };
const XP_GOAL = 5, XP_ALL = 15, XP_PET = 15, XP_NEW = 8, XP_CHAPTER = 20, XP_STAGE = 25, XP_PAGE = 30;
const needFor = level => 20 + 15 * (level - 1);
function levelOf(xp) {
  let level = 1, left = Math.max(0, Number(xp) || 0);
  while (left >= needFor(level)) { left -= needFor(level); level++; }
  return { level, into: left, need: needFor(level) };
}
const levelStars = level => 5 + 2 * level;
const PERKS = [
  { level: 2, id: "rainbow", icon: "🎣", text: "A new fish in the pond: Rainbow Trout" },
  { level: 3, id: "can", icon: "💧", text: "Big watering can: water lasts 9 hours" },
  { level: 4, id: "nose", icon: "🍪", text: "Treat nose: one more hidden treat every day" },
  { level: 5, id: "thumb", icon: "🧺", text: "Green thumb: sometimes pick an extra crop" },
  { level: 6, id: "eel", icon: "🎣", text: "A new night fish: Moon Eel" },
  { level: 7, id: "trader", icon: "📦", text: "Good trader: the crate pays 10% more" },
  { level: 8, id: "penpal", icon: "✉️", text: "Pen pal: twice the seeds in the mail" },
  { level: 9, id: "dragonkoi", icon: "🎣", text: "A new fish: Dragon Koi" },
  { level: 10, id: "getter", icon: "🎯", text: "Goal getter: every goal pays 1 more ⭐" },
  { level: 12, id: "grower", icon: "🌱", text: "Fast grower: your seeds grow 15% faster" },
  { level: 14, id: "crystal", icon: "🎣", text: "A new rare fish: Crystal Fish" },
  { level: 16, id: "hook", icon: "🍪", text: "Lucky hook: treats on the hook more often" },
  { level: 18, id: "thumb2", icon: "🧺", text: "Greener thumb: an extra crop half the time" },
  { level: 20, id: "golden", icon: "👑", text: "A golden baby dragon comes to live with you" }
];
const has = (level, id) => level >= (PERKS.find(p => p.id === id)?.level ?? Infinity);
const TITLES = [[20, "Legend"], [15, "Hero"], [10, "Explorer"], [5, "Gardener"], [1, "Sprout"]];
const titleOf = level => TITLES.find(([l]) => level >= l)[1];

// What a story chapter or goal can ask for; each counts once per time you do it.
const JOBS = {
  plant: n => `Plant ${n} seed${n > 1 ? "s" : ""}`, water: n => `Water ${n} time${n > 1 ? "s" : ""}`, harvest: n => `Pick ${n} crop${n > 1 ? "s" : ""}`,
  fish: n => `Catch ${n} fish`, sell: n => n > 1 ? `Sell at the crate ${n} times` : "Sell at the crate", mail: () => "Check the mailbox",
  treat: n => `Find ${n} hidden treat${n > 1 ? "s" : ""}`, give: n => `Give to the family build ${n} time${n > 1 ? "s" : ""}`
};
const ch = (text, kind, n) => ({ text, kind, n });
const STORIES = {
  clay: { title: "The Blank World", guide: "🐦 Dot the little bird", end: "The clay world is full of life now. Thank you! Try another world for a new story.", chapters: [
    ch("Hello! This world is brand new and a bit empty. Let's wake it up. Plant 3 seeds!", "plant", 3),
    ch("Seeds get thirsty. Give them a good drink.", "water", 4),
    ch("Is anybody out there? Check the mailbox and see.", "mail", 1),
    ch("The pond is so quiet. Are there fish in it?", "fish", 3),
    ch("Look how they've grown! Pick what's ready.", "harvest", 4),
    ch("Share what you made with the town. Sell at the crate.", "sell", 2)] },
  scifi: { title: "Lights Out on the Colony", guide: "🤖 Bolt the robot", end: "Power is back on and the colony is glowing. Beep boop, you did it! Try another world for a new story.", chapters: [
    ch("Bzzt! The colony's power is running low. Plants make air and energy here. Plant 4 seeds!", "plant", 4),
    ch("The cooling pipes feed the garden. Water the crops.", "water", 5),
    ch("Mission control sent a message. Check the mailbox.", "mail", 1),
    ch("The pond bots need testing. Catch some fish.", "fish", 4),
    ch("Snack time for the crew! Find the hidden treats.", "treat", 3),
    ch("Trade for a new power cell. Sell at the crate.", "sell", 3)] },
  castle: { title: "The Fading Rainbow", guide: "☁️ Nimbus the cloud sprite", end: "The rainbow bridge shines brighter than ever. Thank you, friend! Try another world for a new story.", chapters: [
    ch("Oh no, the rainbow bridge is fading! Rainbows need water. Water your garden.", "water", 4),
    ch("Every colour grows from a seed. Plant some!", "plant", 4),
    ch("The pond fish carry rainbow scales. Catch a few.", "fish", 3),
    ch("The Cloud Queen wrote to you. Check the mailbox.", "mail", 1),
    ch("Pick your crops. Their colours will fill the sky.", "harvest", 5),
    ch("One last thing: the family build needs you. Give something to it.", "give", 2)] },
  night: { title: "The Lost Fireflies", guide: "🦉 Professor Hoot", end: "The fireflies are home and the forest twinkles again. Hoo-ray! Try another world for a new story.", chapters: [
    ch("Hoo! The fireflies have gone missing and the forest is too dark. They love treats. Find some!", "treat", 2),
    ch("Fireflies sleep in gardens. Plant seeds for them.", "plant", 4),
    ch("Dew drops help them glow. Water the garden.", "water", 5),
    ch("A firefly sent a tiny letter! Check the mailbox.", "mail", 1),
    ch("The pond glows at night. Catch some fish and look closer.", "fish", 4),
    ch("Pick your crops and the fireflies will follow you home.", "harvest", 5)] },
  pirate: { title: "Captain Marigold's Treasure", guide: "🦜 Pip the parrot", end: "You found Captain Marigold's treasure! Squawk! Try another world for a new story.", chapters: [
    ch("Squawk! I found half a treasure map in a bottle. Check the mailbox for the other half!", "mail", 1),
    ch("A crew has to eat before a voyage. Pick crops for the galley.", "harvest", 4),
    ch("A real pirate knows the sea. Catch some fish.", "fish", 4),
    ch("We need coins for rope and sails. Sell at the crate.", "sell", 2),
    ch("Ship's biscuits! Find the hidden treats around the island.", "treat", 3),
    ch("X marks the spot, right under your garden! Plant seeds to dig it up.", "plant", 6)] }
};
const chapterStars = (i, total) => i === total - 1 ? 50 : 8 + 2 * i;
const STORY_END_TREATS = 3;

// One big thing the family builds together. "fish" in needs means any fish.
const BUILD = {
  names: { clay: ["🏠", "Clubhouse"], scifi: ["🚀", "Family Rocket"], castle: ["🌈", "Rainbow Tower"], night: ["🏮", "Lantern Tree"], pirate: ["⛵", "Family Ship"] },
  stages: [
    { name: "Gather the wood", needs: { carrot: 6, tomato: 4 }, stars: 15 },
    { name: "Build the frame", needs: { strawberry: 9, minnow: 3, perch: 2 }, stars: 30 },
    { name: "Fit the big pieces", needs: { corn: 4, blueberry: 9, fish: 6 }, stars: 50 },
    { name: "Add the finishing touches", needs: { sunflower: 4, watermelon: 2, koi: 1 }, stars: 80 },
    { name: "Paint and decorate", needs: { pumpkin: 3, sunflower: 4, fish: 10 }, stars: 120 },
    { name: "Grand opening party", needs: { pumpkin: 5, watermelon: 4, strawberry: 12 }, stars: 200 }
  ]
};
const stagePrize = i => i === BUILD.stages.length - 1 ? 150 : 20 * (i + 1);
const STAR_GIFT = 10;
const BOOK_PRIZE = { fish: 100, crops: 60, pets: 80 };

module.exports = { XP, XP_GOAL, XP_ALL, XP_PET, XP_NEW, XP_CHAPTER, XP_STAGE, XP_PAGE, levelOf, levelStars, PERKS, has, titleOf, JOBS, STORIES, chapterStars, STORY_END_TREATS, BUILD, stagePrize, STAR_GIFT, BOOK_PRIZE };
