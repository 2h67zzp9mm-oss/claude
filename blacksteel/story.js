/* The Blacksteel Pirates: the prologue, chapter by chapter.
 *
 * Follows the written prologue. Choices let the player speak as Sean; when a choice isn't
 * what happened, Shannon corrects it and the story continues as written. Nothing here
 * answers a mystery: the Record-Stone, Olive's mark, the machinery, Nightforge, Deke and Mercer.
 *
 * Speakers: N = Shannon telling it, R = Shannon over the communicator, S = Sean, SIS = the listening sister,
 * CAP = storybook caption, or a character's name.
 */
(function () {
  "use strict";

  // Speak as Sean. options: [{ t: label, say: [[speaker, text], ...] }]
  async function ask(G, prompt, options) {
    const i = await G.choose(prompt, options.map(o => o.t));
    await G.lines(options[i].say);
    return i;
  }
  const said = (label, lines) => ({ t: "“" + label + "”", say: [["S", label]].concat(lines || []) });
  const fix = (label, correction, lines) => ({ t: "“" + label + "”", say: [["S", label], ["N", correction]].concat(lines || []) });
  const sis = (G, hazelSays, oliveSays) => G.S.player === "olive" ? hazelSays : oliveSays; // the sister who is listening

  const NOPE = [
    "No. Your father did not do that. I would have heard about it for years.",
    "That isn't how it happened. Try something that did.",
    "He has done many ridiculous things. That wasn't one of them.",
    "No. Even he knew better than that."
  ];
  let nopeN = 0;
  const no = G => G.say("N", NOPE[nopeN++ % NOPE.length]);

  // Rotates so the same choice prompt doesn't repeat every single time.
  const SAYS = [
    "What does your father say?",
    "What does he say?",
    "How does he answer?",
    "What's his answer?",
    "What does he say back?"
  ];
  let saysN = 0;
  const says = () => SAYS[saysN++ % SAYS.length];

  const CH = [];

  // =====================================================================
  // ONE: The Call
  // =====================================================================
  CH.push({
    id: "call", title: "The Call",
    async run(G) {
      const S = G.S;
      if (G.resumeAt() !== "cabin") {
      await G.scene2d("frame");
      await G.lines([
        ["N", "Sit. Both of you."],
        ["N", "Your father asked me to tell you this one. I remember the details. He remembers the parts where he was brave."],
        ["N", "You found a burned map that said Bellgrave was not the first. You've been saying that name for days. So you should know what the name cost."]
      ]);
      await G.lines(sis(G,
        [["SIS", "Is it a scary story?"], ["N", "Parts of it. It's also true. That's why I'm telling it."]],
        [["SIS", "You were there?"], ["N", "No. I was the one who found it, in the archives. In some ways that's worse."]]));
      await G.lines([
        ["N", "Tonight, " + G.me() + ", you are going to be your father. Younger. One bad ship. No plan."],
        ["N", "If you do something he didn't do, I'll tell you. I will enjoy it."],
        ["N", "But it doesn't start with him. It starts with the island."]
      ]);
      await G.lily();
      G.checkpoint("cabin");
      }
      await G.card("Chapter One", "The Call", "Somewhere at sea. Three nights before Bellgrave.");

      S.stage = 0; S.flags = {}; S.inv = [];
      await G.scene3d("cabin");
      await G.play({
        where: "Sean's cabin",
        hs: {
          door: ["Door", ["Look", "Open"]], coat: ["Coat", ["Look", "Take"]], sword: ["Saber on the wall", ["Look", "Take"]],
          porthole: ["Porthole", ["Look"]], shelf: ["Shelf", ["Look"]], bucket: ["Bucket", ["Look"]], bunk: ["Bunk", ["Look"]],
          table: ["Table", ["Look"]], receipts: ["Receipts", ["Look", "Take"]], chart: ["Chart", ["Look", "Take"]],
          plate: ["Dinner plate", ["Look", "Take"]], tides: ["Tide tables", ["Look", "Take"]], comm: ["Communicator", ["Look", "Answer"]],
          packet: ["Packet", ["Look", "Take"]]
        },
        items: { chart: "Chart", packet: "Shannon's packet", coat: "Coat", sword: "Nightforge" },
        objective() {
          const has = G.has;
          switch (S.stage) {
            case 0: return "The communicator is crackling. Tap things in the cabin to look around.";
            case 1: return "Shannon is waiting on the line. Find the chart and spread it out.";
            case 2: return "Your father stood up.";
            case 3: return has("packet") ? "Read the packet. Tap it below." : "Shannon's packet is on the table beside the communicator.";
            default: {
              const need = [];
              if (!has("coat")) need.push("coat");
              if (!has("sword")) need.push("Nightforge");
              if (!has("packet")) need.push("the packet");
              return need.length ? "Before he leaves: " + need.join(", ") + "." : "Everything's packed. The door.";
            }
          }
        },
        target() {
          const has = G.has;
          switch (S.stage) {
            case 0: return "comm";
            case 1: return S.flags.plateMoved ? (has("chart") ? "table" : "chart") : "plate";
            case 2: return "coat";
            case 3: return has("packet") ? null : "packet";
            default: return !has("coat") ? "coat" : !has("sword") ? "sword" : !has("packet") ? "packet" : "door";
          }
        },
        hint() {
          const hz = S.player === "hazel", has = G.has;
          switch (S.stage) {
            case 0: return hz ? "That blinking box on the table is the communicator. Tap it and answer it." : "Something on the table has been crackling for a full minute.";
            case 1:
              if (!S.flags.plateMoved) return hz ? "The chart is under his dinner plate. Take the plate first." : "The chart is under his dinner. Deal with dinner.";
              if (!has("chart")) return "Now take the chart.";
              return hz ? "Tap the chart below, choose “Use on…”, then tap the table." : "Spread the chart out on the table.";
            case 2: return hz ? "Your father always grabs one thing before he runs off. It's hanging on a hook." : "What would your father reach for first?";
            case 3: return has("packet") ? "Tap the packet below and choose Look." : "Take the packet from the table.";
            default: return !has("coat") ? "His coat, on the hook by the door." : !has("sword") ? "The saber on the wall. He never left without it." : !has("packet") ? "Shannon's packet." : "Open the door.";
          }
        },
        async look(id) {
          const f = S.flags, st = S.stage;
          switch (id) {
            case "door": return G.say("N", "The cabin door. It sticks when the weather turns. So does your father.");
            case "coat": return G.say("N", "His coat. Long, dark, and patched at both elbows by someone who was not good at patching. Him.");
            case "sword":
              await G.say("N", "An old, dark-gray saber. There's a worn name cut near the guard: Nightforge.");
              await G.say("N", "He found it years ago on one of my paid research errands, buried under collapsed shelving in an abandoned storehouse. No pedestal. No prophecy. No dead king holding the handle.");
              return G.say("N", "Just an edge that refused to dull. I found one incomplete reference to Nightforge in an archive, and nothing more. Until that week, it had only ever been a sword.");
            case "porthole": return G.say("N", "Night. Open sea. No land anywhere, and no reason yet to go looking for any.");
            case "shelf": return G.say("N", "Books he meant to read. Charts he meant to fix. And his compass. It pointed north. For three more nights, it would keep doing that.");
            case "bucket": return G.say("N", "The leak. He'd spent a year learning which leaks were harmless and which ones wanted him dead. This one was harmless. Mostly.");
            case "bunk": return G.say("N", f.plateMoved ? "His bunk, now with dinner on it." : "His bunk. Unmade. It had been unmade for a year.");
            case "table": return G.say("N", "Loose receipts, tide tables, the remains of dinner, and the communicator. He called this his navigation desk.");
            case "receipts": return G.say("N", "Receipts, in no order. My brother keeps receipts the way some people keep grudges: everywhere, and forever.");
            case "chart": return G.say("N", f.chartSpread ? "A sea chart. Where Bellgrave should be, there's nothing. Just open water with a circle he drew around it." : "A corner of a sea chart, sticking out from under his dinner plate.");
            case "plate": return G.say("N", "I'm told it was fish. I choose not to investigate further.");
            case "tides": return G.say("N", "Tide tables for the western routes, full of his handwriting. Most of it says “no.”");
            case "comm": return G.say("N", st === 0 ? "His long-range communicator. The light was blinking. It had been blinking for a full minute. That was me." : "The communicator's little image panel showed my face. I was not smiling.");
            case "packet": return G.say("N", "A packet tied with string, beside the communicator. My handwriting on the front.");
          }
          return no(G);
        },
        async lookItem(id) {
          if (id === "chart") return G.say("N", "A sea chart of the western waters. Somewhere on it, an island that isn't there.");
          if (id === "coat") return this.look("coat");
          if (id === "sword") return this.look("sword");
          if (id === "packet") {
            if (S.stage === 3) return readPacket();
            return G.say("N", "Coordinates, three safe routes, a list of ports where he is not welcome, and money. At the bottom, Deke's name, in my handwriting.");
          }
        },
        async act(id, v) {
          const f = S.flags, st = S.stage, has = G.has;
          switch (id) {
            case "comm":
              if (st === 0) return callOne();
              if (st === 1) return G.say("R", "The chart, Sean. The one under your dinner.");
              if (st === 2) return G.say("N", "He did not sit back down and chat. Not with Deke in trouble. What did he reach for?");
              if (st === 3) return G.say("R", "The packet. Beside the communicator. Where I said.");
              return G.say("R", "Go.");
            case "plate":
              f.plateMoved = true;
              await G.say("N", "He moved dinner to the bunk. Dinner did not object.");
              if (S.player === "olive") await G.lines([["SIS", "Did Dad ever finish his dinner?"], ["N", "No. Nobody in this story gets to finish dinner."]]);
              return;
            case "chart":
              if (f.chartSpread) return G.say("N", "It's already spread out. Blank sea, right where the island should be.");
              if (!f.plateMoved) return G.say("N", "His dinner was sitting on it. Priorities.");
              if (st < 1) return G.say("N", "He had no reason to look at a chart yet. He was eating.");
              G.give("chart");
              return G.say("N", "He pulled the chart free. It smelled like fish.");
            case "coat":
              if (st < 2) return G.say("N", st === 0 ? "He wasn't going anywhere yet. He was eating." : "Not yet. I was still talking.");
              if (st === 2) return sitDown();
              if (st === 3) return G.say("N", "His hand had fallen away from the coat. For once, he was listening.");
              G.give("coat");
              return G.say("N", "He pulled on his coat.");
            case "door":
              if (st < 2) return G.say("N", "Nowhere to go yet. That was about to change.");
              if (st === 2) return sitDown();
              if (st === 3) return G.say("R", "Ten seconds, Sean.");
              if (!has("coat") || !has("sword") || !has("packet")) return G.say("N", this.objective());
              await G.W.goTo("door");
              return G.finish();
            case "sword":
              G.give("sword");
              return G.say("N", "He buckled the saber on. It fit his hand. That was the only reason he'd ever kept it.");
            case "packet":
              G.give("packet");
              return G.say("N", "He picked up the packet.");
            case "receipts": return G.say("N", "He doesn't need receipts. He needs to stop buying things in alleys.");
            case "tides": return G.say("N", "Tide tables. He would need them. He didn't know that yet.");
          }
          return no(G);
        },
        async useOn(item, target) {
          if (item === "chart" && (target === "table" || target === "comm")) {
            if (S.stage !== 1) return G.say("N", "He'd already looked at the chart.");
            G.drop("chart");
            S.flags.chartSpread = true;
            G.refresh();
            return callTwo();
          }
          if (item === "sword" && target === "comm") return G.say("N", "No. Your father did not stab my face through the communicator. I would remember.");
          if (item === "sword" && target === "plate") return G.say("N", "He did not eat dinner with a sword. That we know of.");
          if (item === "packet" && target === "comm") return G.say("R", "Yes, Sean. That's the packet. Read it.");
          return no(G);
        }
      });

      async function callOne() {
        await G.lines([
          ["N", "He answered."],
          ["R", "I found a mistake."],
          ["N", "I don't believe in mistakes. Not in ledgers, maps, money, or history. Mistakes are just lies that haven't been organized properly."]
        ]);
        await ask(G, says(), [
          said("You called me on an Academy cipher to tell me someone misspelled a king?"),
          fix("Shannon, I'm eating.", "That's not what he said. He said something smug about a misspelled king. Close enough."),
          fix("What kind of mistake?", "That's not what he said. He said something smug about a misspelled king. Close enough.")
        ]);
        await G.lines([
          ["R", "I called because an island has been removed from six separate archives. Not misplaced. Removed."],
          ["R", "The old population rolls list Bellgrave Island with six hundred and twelve residents. Forty years later, the shipping office records three hundred barrels of lamp oil delivered there."],
          ["R", "The modern charts show open water, and the patrol schedules bend around the coordinates without explaining why. Look at your chart."],
          ["N", "His chart was under his dinner. Of course it was."]
        ]);
        S.stage = 1;
      }
      async function callTwo() {
        await G.say("N", "He flattened the chart and found the spot. Blank sea.");
        await ask(G, says(), [
          said("Could be a restricted base."),
          { t: "“There's nothing here.”", say: [["S", "There's nothing here."], ["R", "That is exactly my point."]] },
          { t: "“Maybe someone just made a mistake.”", say: [["S", "Maybe someone just made a mistake."], ["R", "Were you listening to me at all?"], ["N", "He wasn't. He guessed it was a restricted base. So let's say he guessed that."]] }
        ]);
        await G.lines([
          ["R", "Then the supply records would have changed classification. They wouldn't have been cut off midsentence. Someone went backward through the archive and cleaned it badly."],
          ["S", "Badly enough for you to notice."],
          ["R", "Most crimes are."],
          ["R", "Local sailors also report bells beneath the water. That would be charming folklore if the oldest architectural survey didn't specifically say Bellgrave had no bell tower."]
        ]);
        await G.lines(sis(G, [["SIS", "The bell from under the island!"], ["N", "Yes. Remember it."]], [["SIS", "Like the bell Lily heard."], ["N", "Yes. Hold on to that."]]));
        await G.lines([
          ["S", "Why are you telling me now?"],
          ["N", "For the first time, I looked away. I remember that. I hate that I remember it."],
          ["R", "Because a Central Authority Fleet survey team left for those coordinates five days ago. Deke's unit."],
          ["N", "Deke was your father's best friend from the Naval Academy. You'll meet him soon."]
        ]);
        await ask(G, says(), [
          said("Does he know what he's sailing into?"),
          { t: "“Deke?”", say: [["S", "Deke?"], ["N", "Then he asked whether Deke knew what he was sailing into."]] },
          { t: "“How long have you known?”", say: [["S", "How long have you known?"], ["R", "Long enough to warn him. Ask me the real question."], ["S", "Does he know what he's sailing into?"]] }
        ]);
        await G.lines([
          ["R", "I warned him through the cipher we used at the Academy. I sent it twice."],
          ["S", "Did he answer?"],
          ["R", "No. That doesn't mean he ignored it. It means either he cannot answer, or someone is watching his communications."],
          ["N", "Your father stood up."]
        ]);
        S.stage = 2;
      }
      async function sitDown() {
        await G.lines([
          ["N", "He reached for his coat."],
          ["R", "Sit down for ten more seconds. If you rush off before I finish, you will arrive brave, uninformed, and useless. In exactly that order."],
          ["N", "He stayed standing. But he stopped moving. That is the most I have ever gotten out of him."],
          ["R", "The preliminary survey report uses the phrase historical contaminant."],
          ["N", "His hand fell away from the coat."],
          ["N", "That was the phrase printed on the records that got him expelled from the Naval Academy."],
          ["N", "He and Deke noticed it first as cadets: battles with impossible dates, islands that vanished between editions, whole bloodlines reduced to blank spaces."],
          ["N", "Your father kept digging after the instructors ordered them to stop. The Academy forced him out and called it misconduct."],
          ["N", "Deke wanted to leave with him. Your father made him stay. Someone decent needed to remain inside the machine."],
          ["N", "It sounded sensible at the time. Now the machine had sent Deke to an island it planned to erase."]
        ]);
        await ask(G, says(), [
          said("Send me the coordinates."),
          { t: "“I'm going.”", say: [["S", "I'm going."], ["R", "I know. You'll want the coordinates."]] },
          { t: "Say nothing.", say: [["N", "He said nothing for a long moment. Then: “Send me the coordinates.”"]] }
        ]);
        await G.lines([
          ["R", "They're already encoded in the packet beside the communicator. Along with three routes that avoid Fleet checkpoints, a list of ports where you are not welcome, and enough money to keep your wreck moving if you stop purchasing weapons from men in alleys."],
          ["S", "That happened once."],
          ["R", "It happened twice. The second man simply owned a doorway."]
        ]);
        await G.lines(sis(G, [["SIS", "What's an alley?"], ["N", "A narrow street where your father makes bad decisions."]], [["SIS", "Dad bought weapons in alleys?"], ["N", "Twice. Don't get ideas."]]));
        S.stage = 3;
      }
      async function readPacket() {
        await G.say("N", "I'd arranged everything by urgency and marked the safest route in green. At the bottom, under the practical instructions, I wrote Deke's name by hand.");
        await ask(G, says(), [
          said("You're the best."),
          { t: "“Thank you, Shannon.”", say: [["S", "Thank you, Shannon."], ["N", "Actually, he said “You're the best.” Quietly. I'm keeping it."]] },
          { t: "Say nothing.", say: [["N", "He tried to say nothing. It lasted about a second. Then, quietly: “You're the best.”"]] }
        ]);
        await G.lines([
          ["R", "I know. Now listen to me."],
          ["R", "If an erasure order has already been issued, you cannot fight whatever they send. You find Deke. You learn what the survey uncovered if, and only if, you can do it without getting both of you killed. Then you leave."],
          ["S", "I'm not planning to fight a fleet."],
          ["R", "You never plan to. That is what makes this conversation necessary."],
          ["S", "What if he won't leave?"],
          ["R", "Then remind him that staying alive is not the same as running away. And if he still refuses, you come home anyway."],
          ["N", "He didn't answer."],
          ["R", "I mean it. I will not lose my brother because the two of you decided loyalty requires a body count."]
        ]);
        await ask(G, "What does your father promise?", [
          said("I'll find him."),
          { t: "“I'll come home.”", say: [["N", "No. He didn't promise that. He couldn't."], ["S", "I'll find him."]] },
          { t: "Make a joke.", say: [["N", "He wanted to make a joke. My face stopped him."], ["S", "I'll find him."]] }
        ]);
        await G.lines([
          ["N", "It was the only part of my instruction he could honestly give me."],
          ["N", "Coat. Sword. Packet. Then the door."]
        ]);
        S.stage = 4;
      }

      await G.scene2d("frame");
      await G.say("N", "He left that night.");
      await G.lines(sis(G, [["SIS", "Did Dad find his friend?"], ["N", "Keep listening."]], [["SIS", "What was on the island, Aunt Shannon?"], ["N", "Keep listening."]]));
    }
  });

  // =====================================================================
  // TWO: The Reef
  // =====================================================================
  CH.push({
    id: "reef", title: "The Reef",
    async run(G) {
      await G.card("Chapter Two", "The Reef", "Three nights later.");
      await G.scene3d("deck");
      await G.lines([
        ["N", "By the time your father found Bellgrave, the island was already burning."],
        ["N", "It rose from the fog like the broken crown of something buried beneath the sea: black cliffs, crooked pines, and a harbor glowing orange beneath a sky without stars."],
        ["N", "No chart named it. No lighthouse marked the reef. Every compass aboard began pointing toward the island the moment its cliffs appeared, as if north itself had been dragged underground."]
      ]);
      await G.lines(sis(G, [["SIS", "Why did the compasses do that?"], ["N", "I don't know. Neither does your father."]], [["SIS", "His compass. The one on the shelf."], ["N", "Yes."]]));
      await G.lines([
        ["N", "Beyond the reef, seven Central Authority warships formed a steel crescent around the harbor. Their cannons were aimed inland."],
        ["N", "This was not a battle. Battles allowed the other side to fight back. This was demolition."],
        ["N", "He had to get through the reef. The trick was the cannons: wait for the nearest one to recoil, then drive straight through the smoke left by its shot."],
        ["CAP", "Steer with the ◀ and ▶ buttons, or the arrow keys. Aim for the smoke where each shot lands."]
      ]);
      if (G.W.ok) {
        const lines = [
          "No. He did not hit the reef. He'd spent a year learning which rocks wanted him dead. Try that one again.",
          "Wait for the smoke. Then go through it.",
          "Closer. The smoke marks the gap."
        ];
        let res = await G.reef({ reset: true, hints: G.S.player === "hazel" });
        let fails = 0;
        while (res.fail) {
          await G.say("N", lines[fails % lines.length]);
          fails++;
          res = await G.reef({ hints: G.S.player === "hazel" || fails >= 2 });
        }
      } else {
        await ask(G, "The cannon fires. What does your father do?", [
          { t: "Wait for it to recoil, then drive through the smoke.", say: [] },
          { t: "Go now, before it fires again.", say: [["N", "No. He waited. Then he went."]] }
        ]);
      }
      await G.say("N", "He waited for the nearest cannon to recoil, spun the wheel, and drove straight through the smoke left by its shot.");
      await G.W.ev("crash");
      await G.say("N", "His frigate struck the beach hard enough to throw him over the rail. He landed shoulder-first in wet sand, rolled beneath a burning length of sail, and came up with Nightforge drawn.");
    }
  });

  // =====================================================================
  // THREE: Deke
  // =====================================================================
  CH.push({
    id: "deke", title: "Deke",
    async run(G) {
      await G.card("Chapter Three", "Deke", "The beach at Bellgrave.");
      G.S.flags = {};
      await G.scene3d("beach", { mode: "arrival" });
      await G.say("N", "The first person he saw wore a Fleet coat.");
      await G.play({
        where: "The beach",
        hs: { deke: ["Deke", ["Look", "Talk"]], mercer: ["Sergeant", ["Look", "Talk"]], boats: ["Fishing boats", ["Look"]], frigate: ["Sean's frigate", ["Look"]], families: ["Families", ["Look"]] },
        objective: () => "Deke is among the overturned boats.",
        target: () => "deke",
        hint: () => G.S.player === "hazel" ? "The man in the pale coat by the boats is Deke. Tap him and talk." : "Talk to Deke.",
        async look(id) {
          switch (id) {
            case "deke": return G.say("N", "Deke stood among overturned fishing boats with a long rifle across his back, blood running from his temple, and one lens missing from his goggles. The insignia of a lieutenant still clung to his torn shoulder by one thread.");
            case "mercer": return G.say("N", "An older sergeant directed families through the smoke. His name was Brin Mercer. He moved with the calm exhaustion of someone who had already accepted death and was irritated by how long it was taking.");
            case "boats": return G.say("N", "Fishing boats, dragged up the sand and overturned. Somebody's whole living, upside down.");
            case "frigate": return G.say("N", "His frigate, lodged halfway onto the beach. He had bought the hull for almost nothing and rebuilt the mast himself.");
            case "families": return G.say("N", "Deke's troopers carried wounded villagers toward the harbor. Their pale coats had been turned inside out or stripped of insignia.");
          }
        },
        async act(id, v) {
          if (id === "mercer") return G.lines([["Mercer", "Lieutenant's by the boats. Talk to him, not me."]]);
          if (id === "deke") { await G.W.goTo("deke"); return G.finish(); }
          return no(G);
        }
      });
      const W = G.W, deke = W.actor && W.actor("deke");
      if (deke) deke.look(W.player.pos.x, W.player.pos.z);
      await G.lines([
        ["N", "He looked from your father to the frigate lodged halfway onto the beach. For a moment neither man spoke. Relief crossed Deke's face so plainly that your father almost failed to recognize him."],
        ["Deke", "You know those are supposed to stop before they reach land."]
      ]);
      await ask(G, says(), [
        said("I was working with limited time and fewer brakes."),
        fix("Deke! You're alive.", "He was glad. He did not say it like that. He said:", [["S", "I was working with limited time and fewer brakes."]]),
        fix("Are you hurt?", "He could see that Deke was hurt. He answered the joke instead:", [["S", "I was working with limited time and fewer brakes."]])
      ]);
      if (deke) { deke.walkTo(W.player.pos.x + .6, W.player.pos.z - .3); await G.wait(700); }
      await G.lines([
        ["N", "Deke struck him in the chest with both arms, an embrace disguised as an assault. Your father returned it just as hard. Deke smelled of smoke, seawater, and blood."],
        ["Deke", "You're late."],
        ["S", "You didn't answer Shannon."],
        ["Deke", "Harrow shot the communicator while it was decoding her first message. Put a bullet through the receiver and told me unscheduled correspondence weakened discipline."],
        ["S", "Did you get enough of the warning?"],
        ["Deke", "Enough to start copying his orders. Not enough to get these people off the island before the fleet arrived. I kept thinking you would have the good sense to stay away."],
        ["S", "After all those years at the Academy, that sounds like your instructional failure."],
        ["N", "Deke almost smiled. It vanished when another stretcher passed between them."]
      ]);
      await ask(G, says(), [
        said("Tell me what happened."),
        fix("We have to get out of here.", "Not yet. First he asked:", [["S", "Tell me what happened."]]),
        fix("Who's Harrow?", "He'd find out. What he said was:", [["S", "Tell me what happened."]])
      ]);
      await G.lines([
        ["Deke", "We found what Shannon sent you to find. And then I finally learned what the uniform means when nobody outside it is allowed to see."],
        ["N", "The survey team had arrived five days earlier under the command of Commodore Gideon Harrow, a man who believed justice was whatever survived the paperwork."],
        ["N", "An earthquake had opened tunnels beneath Bellgrave's oldest shrine. Inside, the survey force found a chamber built around a single block of indestructible blue-black stone. An Ancient Record-Stone."],
        ["N", "Harrow transmitted the discovery at noon. The reply arrived before sunset."],
        ["CAP", "Historical contaminant confirmed. Recover all research materials. Eliminate witnesses. Correct the chart."],
        ["Deke", "Harrow read the order to us like he was announcing tomorrow's weather. I asked whether ‘witnesses’ meant the researchers who entered the chamber. He said it meant every person capable of remembering the island."],
        ["Deke", "Then he told me six hundred civilians were a charting error, and ordered my platoon to begin at the school."]
      ]);
      await G.lines(sis(G, [["SIS", "The school? With kids in it?"], ["N", "Yes. Keep listening. Deke is about to do something very brave."]], [["SIS", "He said no. Right?"], ["N", "Listen."]]));
      await ask(G, says(), [
        said("What did you do?"),
        fix("You didn't.", "He knew Deke. He asked anyway:", [["S", "What did you do?"]])
      ]);
      await G.say("Deke", "I asked for clarification.");
      await ask(G, says(), [
        said("Politely?"),
        fix("And?", "He smiled, faintly, despite everything. He asked:", [["S", "Politely?"]])
      ]);
      await G.lines([
        ["Deke", "The first time. The second time I put my pistol under his chin."],
        ["Deke", "Thirty-one people stood with me. Some of them followed because they trusted me. Some because they could see children through the school windows. I don't know which reason is nobler, and I don't care anymore."],
        ["N", "They were not revolutionaries. Most of them still believed in the uniform. They believed the Fleet was supposed to stand between ordinary people and monsters."],
        ["N", "When their own flag became the monster, they stood in front of it anyway."],
        ["N", "Nine remained."],
        ["Deke", "The villagers are evacuating through the west channel. The reef hides them from the larger ships, but we need another twenty minutes."],
        ["Deke", "Harrow knows the stone cannot be destroyed, so he's collapsing the island around it. If he buries the chamber and kills the witnesses, the report can say we found nothing."]
      ]);
      await ask(G, says(), [
        said("Where is the Record-Stone?"),
        fix("Then we get everyone out.", "That's what Deke wanted to hear. It's not what your father said. He said:", [["S", "Where is the Record-Stone?"]])
      ]);
      await G.lines([
        ["Deke", "Under the shrine. Inside the bombardment line."],
        ["N", "Deke caught his sleeve before he could turn uphill."],
        ["Deke", "Listen to the whole sentence. I have nine people left, half of them wounded. The civilians need every rifle between here and the harbor."]
      ]);
      await ask(G, says(), [
        said("Shannon risked her career to find this place. They sent seven warships to make sure nobody remembers what was under it. If we leave without even seeing the reason, everyone who died here becomes part of the correction."),
        fix("You're right. Let's help the families.", "He should have. He didn't. He said that if they left without seeing the reason, everyone who died here would become part of the correction.")
      ]);
      await G.lines([
        ["Deke", "And if the tunnel falls on us, the last boats lose both of the idiots keeping the north street open."],
        ["S", "Then we go down, take proof, and come back before they miss us."],
        ["Deke", "You truly believe saying a plan quickly makes it more practical."],
        ["S", "Are you coming?"],
        ["Deke", "Of course I'm coming. I have spent years protecting the Navy from your judgment. Apparently treason has not relieved me of the assignment."],
        ["S", "For the record, the boat on the beach is mine."]
      ]);
      await G.W.ev("mastCollapse");
      await G.lines([
        ["N", "They both looked at his frigate as its damaged mast collapsed into the surf."],
        ["Deke", "Not anymore."]
      ]);
    }
  });

  // =====================================================================
  // FOUR: The Shrine
  // =====================================================================
  CH.push({
    id: "shrine", title: "The Shrine",
    async run(G) {
      const S = G.S;
      await G.card("Chapter Four", "The Shrine", "Up through the burning village.");
      S.flags = {};
      const at = G.resumeAt();
      if (!at) {
      await G.scene3d("village", { mode: "run" });
      await G.lines([
        ["N", "Bellgrave's village had been built in rings around the old shrine. The islanders had spent generations carving tiny bells into the stone above every threshold. None of the carvings had clappers."],
        ["N", "Your father and Deke ran against the flow of fleeing families."]
      ]);
      await G.play({
        where: "The village",
        hs: { hole: ["Shrine", ["Look", "Climb down"]], doll: ["Something under a porch rail", ["Look"]], deke: ["Deke", ["Look", "Talk"]] },
        items: { pistol: "Mercer's pistol" },
        objective: () => S.flags.mercer ? "The shrine is at the top of the street." : "Head up the street toward the shrine.",
        target: () => "hole",
        hint: () => "Walk up the street, to the shrine at the very top.",
        async look(id) {
          if (id === "doll") return G.lines([
            ["N", "Near the remains of a two-room house, a cloth doll lay beneath a broken porch rail."],
            ["N", "Its faded yellow dress was black with ash. One brown button eye stared upward through the smoke. The blue one was gone."]
          ]);
          if (id === "hole") return G.say("N", "The shrine's entrance had collapsed, but a jagged hole split the earth where the altar once stood. Cold air breathed from below, carrying the smell of salt, mineral oil, and something sourly medicinal.");
          if (id === "deke") return G.say("N", "Deke, a step behind him, watching every roof at once.");
        },
        async act(id, v) {
          if (id === "hole") {
            if (!S.flags.mercer) return G.say("N", "Not yet. Someone was shouting behind them.");
            return G.finish();
          }
          if (id === "deke") return G.say("Deke", "Keep moving. Talk later.");
          return no(G);
        },
        async tick() {
          if (!S.flags.mercer && G.W.player && G.W.player.pos.z < -4) {
            S.flags.mercer = true;
            await G.lines([
              ["Mercer", "Lieutenant, Harrow's landing force is coming through the north square."],
              ["Deke", "Fall back by sections. Nobody holds ground after the civilians clear it."],
              ["N", "Mercer tossed your father a short-barreled pistol. He caught it awkwardly and started to object, but Mercer was already moving. The old sergeant had taken one look at Nightforge and decided your father needed every advantage available."]
            ]);
            G.give("pistol");
            await G.say("N", "The wounded young trooper beside Mercer was Nia Bell, a nineteen-year-old communications specialist who had never fired her rifle outside training before that morning. She had not stopped firing since.");
          }
        }
      });
      G.W.shake(.8, .15);
      await G.say("N", "The north square erupted behind them. A cannon strike tore the roof from the building beside the shrine. They descended into darkness.");
      G.checkpoint("tunnel");
      }
      if (at !== "chamber") {
      if (!G.has("pistol")) G.give("pistol");
      await G.scene3d("tunnel");
      await G.say("N", "The bombardment became a distant heartbeat inside the tunnels. They followed passages lined with ancient masonry, carvings worn smooth long before Bellgrave's first house was built.");
      const right = ["ahead", "left"];
      for (let n = 0; n < 2; n++) {
        let pickId = null;
        await G.play({
          where: "The tunnels",
          hs: { left: ["Left passage", ["Look", "Go"]], ahead: ["Passage ahead", ["Look", "Go"]], right: ["Right passage", ["Look", "Go"]], deke: ["Deke", ["Look", "Talk"]] },
          objective: () => "An intersection. Which way?",
          target: () => "deke",
          hint: () => "Any way you choose, Deke will listen first. You could also ask Deke.",
          async look(id) {
            if (id === "deke") return G.say("N", "Deke stopped without explanation, listening to sounds your father could not hear.");
            return G.say("N", "Dark stone, and cold air moving somewhere inside it.");
          },
          async act(id) {
            if (id === "deke") { pickId = right[n]; return G.finish(); }
            pickId = id; return G.finish();
          }
        });
        await G.W.ev("listen");
        if (pickId !== right[n]) await G.lines([["Deke", "Not that one."], ["N", "Academy instructors always said Deke possessed unusual instincts. Your father knew better. Deke noticed everything."]]);
        else await G.say("Deke", n ? "This way." : "Ahead. Listen. The air is moving.");
        await G.W.fade(1, 500);
        await G.scene3d("tunnel");
        await G.W.fade(0, 400);
      }

      G.checkpoint("chamber");
      }
      if (!G.has("pistol")) G.give("pistol");
      await G.scene3d("chamber");
      S.flags = {};
      await G.lines([
        ["N", "The tunnel opened into a circular chamber."],
        ["N", "The Ancient Record-Stone stood at its center. Even half buried, it was taller than either man. Rows of precise characters covered its surface, untouched by age, fire, or the collapse that had exposed it."],
        ["N", "Brass instruments surrounded its base, newer than the chamber but older than the village, connected by rotted cables to broken glass cylinders along the wall."],
        ["N", "Someone had studied the stone here. Someone had tried to use it."]
      ]);
      await G.play({
        where: "The chamber",
        hs: { stone: ["Record-Stone", ["Look", "Touch"]], instruments: ["Brass instruments", ["Look"]], cylinders: ["Glass cylinders", ["Look"]], deke: ["Deke", ["Look", "Talk"]] },
        objective: () => S.flags.cables ? "Something moved behind the stone." : "Look around the chamber.",
        target: () => !S.flags.stone ? "stone" : !S.flags.talked ? "deke" : "instruments",
        hint: () => !S.flags.stone ? "Look at the stone." : !S.flags.talked ? "Talk to Deke." : "Look at the instruments and where their cables go.",
        async look(id) {
          if (id === "stone") {
            S.flags.stone = true;
            return G.lines([
              ["N", "Blue-black. Indestructible. Characters cut in rows, precise as print."],
              ["N", "Your father has never been able to tell me what it said. Neither has anyone else."],
              ["N", "I would have sold his remaining organs for ten uninterrupted minutes in that room."]
            ]);
          }
          if (id === "instruments") {
            if (!S.flags.talked) return G.say("N", "Brass instruments with dials, older than the village. Cables ran away from them into the dark.");
            S.flags.cables = true;
            return G.lines([
              ["Deke", "Whatever this says, someone understood enough of it to build all this. These cables aren't measuring the Record-Stone. Look where they lead."],
              ["N", "The rotted lines ran away from the stone and into the broken glass cylinders."]
            ]);
          }
          if (id === "cylinders") return G.say("N", "Glass cylinders along the wall, most of them broken. The cables ended there.");
          if (id === "deke") return G.say("N", "Deke approached the nearest line of characters without touching the stone.");
        },
        async act(id, v) {
          if (id === "stone") return G.say("N", "He didn't touch it. Neither did Deke. Some things you look at first.");
          if (id === "deke") {
            S.flags.talked = true;
            return G.lines([
              ["Deke", "Did Shannon teach you any of this?"],
              ["S", "She taught me how to carry her bags, distract guards, and recognize when she was about to do something that would become my fault. Reading dead languages was apparently outside the responsibilities of manual labor."],
              ["Deke", "I hoped some of it might have rubbed off."],
              ["S", "You sat ten doors away from me for a year before realizing we lived in the same hall. I wouldn't trust your theories about learning through proximity."],
              ["Deke", "Your sister forged an archivist's seal."],
              ["S", "She prefers ‘reconstructed misplaced credentials.’"],
              ["Deke", "Of course she does."]
            ]);
          }
          return no(G);
        },
        async tick() { if (S.flags.cables && !S.flags.cough) { S.flags.cough = true; G.finish(); } }
      });
      await G.W.ev("cough");
      await G.lines([["N", "A small sound came from behind the stone."], ["N", "Not falling rock."], ["N", "A cough."]]);
      await G.lines([["N", "Deke raised his rifle. Your father drew Nightforge. They moved around the Record-Stone from opposite sides and found a shattered cradle made of thick glass and tarnished brass. Green fluid covered the floor around it, luminous in the darkness."]]);
      await G.W.goTo("cradle");
      await G.W.ev("tap");
      await G.lines([
        ["N", "Something struck the glass from inside."],
        ["N", "A tiny hand."],
        ["Deke", "Sean. There's a baby in there."]
      ]);
      await ask(G, says(), [
        said("Help me open it."),
        fix("That's impossible.", "His mind refused to put the child and the machines in the same world. But what he said was:", [["S", "Help me open it."]])
      ]);
      G.give("sword");
      await G.play({
        where: "The chamber",
        hs: { cradle: ["Cradle", ["Look", "Open"]], wheel: ["Locking wheel", ["Look", "Turn"]], stone: ["Record-Stone", ["Look"]], deke: ["Deke", ["Look", "Talk"]] },
        items: { sword: "Nightforge", pistol: "Mercer's pistol" },
        objective: () => "Get the cradle open.",
        target: () => "cradle",
        hint: () => G.S.player === "hazel" ? "The lock is bent. Tap Nightforge below, choose “Use on…”, then tap the cradle." : "The locking wheel is bent. He needs a lever.",
        async look(id) {
          if (id === "cradle" || id === "wheel") return G.say("N", "The cradle's locking wheel had bent during the collapse.");
          if (id === "stone") return G.say("N", "Not now.");
          if (id === "deke") return G.say("N", "Deke lowered his rifle slowly, as if the discovery had made the weapon inappropriate.");
        },
        async lookItem(id) {
          if (id === "sword") return G.say("N", "Nightforge. Still just a sword.");
          if (id === "pistol") return G.say("N", "Mercer's pistol.");
        },
        async act(id) {
          if (id === "cradle" || id === "wheel") return G.say("N", "The wheel won't turn by hand. It's bent.");
          if (id === "deke") return G.say("Deke", "The lock. Use something as a lever.");
          return no(G);
        },
        async useOn(item, id) {
          if (item === "sword" && (id === "cradle" || id === "wheel")) {
            await G.W.goTo("cradle"); await G.W.gesture();
            await G.W.ev("openLid");
            S.flags.cradleOpen = true; G.refresh();
            await G.say("N", "He jammed Nightforge beneath the wheel and pushed. The saber flexed, the lock snapped, and the glass lid opened with a wet hiss.");
            return G.finish();
          }
          if (item === "pistol") return G.say("N", "No. Your father did not shoot at a cradle with a baby inside it.");
          return no(G);
        }
      });
    }
  });

  // =====================================================================
  // FIVE: The Name
  // =====================================================================
  CH.push({
    id: "name", title: "The Name",
    async run(G) {
      const S = G.S;
      S.flags = { cradleOpen: true };
      await G.scene3d("chamber");
      await G.W.goTo("cradle");
      await G.lines([
        ["N", "The child inside could not have been older than one. Emerald gel coated her hair, her face, and her little white garment."],
        ["N", "For one terrible moment he thought her skin was green. Then he wiped the gel from her cheek and found warm brown skin underneath."],
        ["N", "She opened dark eyes and stared directly at him."],
        ["N", "A red burn curled around her upper arm, shaped like a broken coil. The flesh around it was healthy. The mark looked both newly inflicted and impossibly old."]
      ]);
      await G.lines(sis(G,
        [["SIS", "Olive! That's you!"], ["N", "It is."], ["SIS", "You were green!"], ["N", "Briefly."]],
        [["SIS", "That's me."], ["N", "That's you."], ["SIS", "The mark."], ["N", "I know. I can't tell you what it means. Nobody at this table can."]]));
      await ask(G, says(), [
        said("Who leaves a child down here?"),
        fix("Hello, little one.", "He would say that later. First, touching the warm brass, he asked:", [["S", "Who leaves a child down here?"]])
      ]);
      await G.lines([
        ["Deke", "Maybe they didn't leave her. The bedding is clean beneath the gel. The feeding tube was connected until the ceiling came down. Somebody was keeping her alive."],
        ["S", "That is not better."],
        ["Deke", "No. It isn't."]
      ]);
      await G.play({
        where: "The chamber",
        hs: { cradle: ["Baby", ["Look", "Lift out"]], deke: ["Deke", ["Look", "Talk"]] },
        objective: () => "Lift her out.",
        target: () => "cradle",
        hint: () => "Tap the cradle and lift her out.",
        async look(id) { return id === "cradle" ? G.say("N", "She was looking at him. Only at him.") : G.say("Deke", "Go on."); },
        async act(id) {
          if (id === "cradle") { await G.W.gesture(); S.flags.babyTaken = true; G.refresh(); return G.finish(); }
          return G.say("Deke", "Her first, Sean.");
        }
      });
      await G.lines([
        ["N", "The baby seized his beard with astonishing strength. He winced, and she laughed: a bright, delighted sound, so absurd inside the buried chamber that both men stared at her."],
        ["Deke", "Do not interpret that as approval."],
        ["S", "She seems comfortable."],
        ["Deke", "She has known you for eight seconds and has already chosen violence. I admit there may be a resemblance."]
      ]);
      await G.W.ev("needle");
      await G.lines([
        ["N", "The chamber shook. Dust rained from the ceiling, and one of the old brass instruments flickered to life. Its needle spun toward the child, then broke against the end of its gauge."],
        ["N", "Deke saw it."],
        ["N", "So did your father."],
        ["N", "Neither mentioned it."],
        ["N", "The baby pressed her face into his chest and went quiet. One tiny hand stayed wrapped in his shirt, as though she had decided he was the only stable object left in the world."],
        ["Deke", "We need to get her to a doctor. A real one, somewhere Harrow cannot reach."],
        ["S", "Shannon will know somebody. We should call her something until then."],
        ["Deke", "Why? Are you worried she won't answer to ‘infant recovered from a forbidden underground laboratory’?"],
        ["S", "I am not calling her that while carrying her across an island."],
        ["N", "Deke looked at the child, then at the emerald fluid running off your father's coat."],
        ["Deke", "Olive."],
        ["S", "You are naming a human being after the slime we found her in."],
        ["Deke", "I am providing a temporary designation under combat conditions."],
        ["S", "That sounds worse."],
        ["Deke", "Then suggest something."]
      ]);
      const i = await G.choose("Your father looks down at her. What name does he try?", ["“Olive.”", "“Marina.”", "“Wren.”", "He has nothing."]);
      if (i === 1 || i === 2) {
        await G.say("S", i === 1 ? "Marina." : "Wren.");
        await G.say("N", "She considered him solemnly. She did not smile.");
      } else if (i === 3) {
        await G.say("N", "The baby opened her eyes, considered him solemnly, and tightened her grip on his shirt. He had nothing.");
      }
      await G.lines([
        ["S", "Olive."],
        ["N", "Her face split into a wet, toothless smile."],
        ["Deke", "Decision recorded."],
        ["S", "You understand that is not how names work."],
        ["Deke", "Tell her. She appears to outrank me."]
      ]);
      await G.lines(sis(G, [["SIS", "Olive's named after SLIME?"], ["N", "Temporary designation. Under combat conditions."]], [["SIS", "Deke named me."], ["N", "Deke named you. Your father made it stick."]]));
      await G.W.ev("rumble");
      const deke = G.W.actor && G.W.actor("deke");
      if (deke) { deke.walkTo(-.5, .2, [0, -1.4]); }
      await G.lines([
        ["N", "Another explosion cracked the chamber wall."],
        ["N", "Deke tore several pages from a field notebook, pressed them against the Record-Stone, and rubbed charcoal across them until fragments of the ancient writing appeared. It was not enough to translate, but it was enough to prove the stone existed."],
        ["N", "He sealed the pages beneath his uniform."],
        ["N", "Then the two men climbed toward the sound of the island dying."]
      ]);
    }
  });

  // =====================================================================
  // SIX: Holding the Street
  // =====================================================================
  CH.push({
    id: "street", title: "Holding the Street",
    async run(G) {
      const S = G.S;
      await G.card("Chapter Six", "Holding the Street", "Back up into the fire.");
      S.flags = {};
      await G.scene3d("village", { mode: "street" });
      await G.lines([
        ["N", "Only six of Deke's troopers were waiting when they emerged. Nobody asked about the missing three."],
        ["N", "Mercer had blood down one side of his face. Nia's left arm hung useless, but she still held her rifle in her right hand."],
        ["N", "Behind them, villagers crowded the final street to the harbor: grandparents carried on doors, children clutching cooking pots, fishermen supporting wounded troopers who had come to save them."],
        ["Harrow", "Lieutenant Deke, you are ordered to surrender the historical contaminant and submit to lawful judgment. Your accomplices will be treated with the mercy appropriate to treason."],
        ["N", "Deke worked the bolt of his rifle. Whatever answer he might have given Harrow remained private."]
      ]);
      await G.W.ev("advance");
      await G.lines([
        ["Deke", "Fall back in pairs. Mercer, take the rear. Bell, get those families onto the boats."],
        ["Nia", "Sir, the families at the rear are still exposed. If I go now, Mercer has to cover both streets."],
        ["N", "Deke glanced at her useless arm and then toward the crowded harbor. He did not insult her by pretending she was unhurt."],
        ["Deke", "You have done enough here. Move with the families, keep your rifle on the north roofs, and make every step toward the boats cost Harrow something. That is an order I need you alive to follow."],
        ["N", "Nia swallowed, nodded, and began backing toward the harbor with her rifle raised."]
      ]);
      const nia = G.W.actor && G.W.actor("t1");
      if (nia) nia.walkTo(0, 8, null, 1.2);
      await G.lines([
        ["N", "The street exploded into gunfire."],
        ["N", "Your father had never considered himself a swordsman. Swordsmen trained their whole lives to perfect a path. He had spent his life learning whatever kept the person beside him alive for another ten seconds."]
      ]);
      // three moments: the player acts; Deke acts between them
      const moments = [
        { id: "bayonet", say: "A bayonet came through the smoke, straight at the child inside his coat.", prompt: "Block it! Tap the soldier with the bayonet.", done: "Nightforge blocked the bayonet, and cut through the rifle barrel behind it." },
        { id: "awning", say: "Three more soldiers pushed up the street beneath a shop's awning.", prompt: "Tap the awning.", done: null },
        { id: "roof", say: "Deke fought like he had already seen where every enemy would stand.", prompt: "Watch the roofs. Tap the rooftop.", done: null }
      ];
      for (const m of moments) {
        await G.say("N", m.say);
        await G.play({
          where: "The street",
          hs: { [m.id]: [m.id === "bayonet" ? "Soldier" : m.id === "awning" ? "Awning" : "Rooftop", ["Act"]] },
          objective: () => m.prompt, target: () => m.id, hint: () => m.prompt,
          quick: true,
          async act() { return G.finish(); }
        });
        if (m.id === "bayonet") { await G.W.ev("block"); await G.say("N", m.done); await G.say("N", "He struck the cobblestones hard enough to shower two soldiers with sparks. He fought ugly, close, and without ceremony."); }
        if (m.id === "awning") { await G.W.ev("awningDrop"); await G.say("N", "Deke turned, fired through the smoke, and severed the rope holding the awning. Canvas and timber buried three advancing soldiers without killing them."); }
        if (m.id === "roof") { await G.W.ev("roofDrop"); await G.say("N", "Deke's rifle cracked beside your father's ear, and a man he had not noticed dropped from the rooftop."); }
      }
      await G.lines([
        ["N", "He moved into the gap Deke had made, and for several seconds they fought with the old, wordless rhythm they had built long before either of them understood what it would one day be used for."],
        ["N", "The last villagers reached the harbor."],
        ["N", "Four troopers remained."]
      ]);
      await G.W.ev("fallBack");
      G.W.shake(.7, .2); G.W.flash("#ffb060", 500, .5);
      await G.lines([
        ["N", "They withdrew one doorway at a time. At the bakery, a shell took the roof and one of the four. At the well, another stayed behind to detonate the ammunition he could no longer carry. The blast closed the street and bought the evacuation boats another minute."],
        ["N", "At the edge of the beach, the third trooper fell without a sound."]
      ]);
      await G.lines(sis(G, [["SIS", "They didn't even know Olive."], ["N", "No. They did it anyway."]], [["SIS", "They didn't even know me."], ["N", "No. They did it anyway."]]));
    }
  });

  // =====================================================================
  // SEVEN: Not Them
  // =====================================================================
  CH.push({
    id: "notthem", title: "Not Them",
    async run(G) {
      const S = G.S;
      await G.card("Chapter Seven", "Not Them", "The beach.");
      S.flags = {}; S.inv = [];
      await G.scene3d("beach", { mode: "defense" });
      G.give("olive");
      await G.lines([
        ["N", "Mercer dragged Deke behind an overturned cart as bullets chewed through the wood. Your father shielded Olive with his body and felt a round tear across his back."],
        ["N", "Nightforge slipped from his fingers, landed point-first in the sand, and remained standing."],
        ["N", "Nia reached them from the boats, pale from blood loss."],
        ["Nia", "West channel is clear. The last boat is launching, but there are children still in the water. I came back for another pair of hands."],
        ["Deke", "You are going with that boat."],
        ["Nia", "Not without you."],
        ["Deke", "Bell, look at me. Those people do not need another body on this beach. They need the communications specialist who memorized every safe frequency before Harrow destroyed the equipment."],
        ["Deke", "Get them beyond the jamming range. Find help. Make certain someone outside this island hears what happened."],
        ["Nia", "And if you're not behind us?"],
        ["Deke", "Then you tell it anyway."],
        ["N", "A shell struck the water beside the final boat. The wave threw civilians from their seats. Nia ran toward them before Deke could stop her, wading chest-deep into the surf to lift a child back aboard."],
        ["N", "The boat pushed away with Nia still clinging to its side."]
      ]);
      await G.W.ev("gunsTurn");
      await G.lines([
        ["N", "Harrow's warships adjusted their formation. Every cannon turned toward the west channel."],
        ["Deke", "They're going to fire through us."],
        ["N", "Mercer checked his pistol. Two rounds remained."],
        ["N", "Your father pulled Nightforge from the sand with his right hand. Olive began crying inside his coat, frightened by the guns, the smoke, and the thunder that had swallowed the world since she opened her eyes."],
        ["Deke", "Take Olive. Use the rocks along the southern edge and get as far inland as you can."],
        ["S", "You just told me Harrow is collapsing the island."],
        ["Deke", "Then find a piece he has not reached yet. I don't have a good answer, Sean. I have one chance to put distance between her and those cannons, and you are holding it."],
        ["N", "Your father understood what Deke was asking: leave his friend on the beach with two bullets and a wounded sergeant."]
      ]);
      await ask(G, says(), [
        said("No."),
        fix("Okay.", "No. He didn't say that. He couldn't. He said:", [["S", "No."]]),
        fix("Come with me.", "Deke wouldn't. And your father knew it. So he said:", [["S", "No."]])
      ]);
      await G.lines([
        ["Deke", "For once in your life, do not make loyalty about standing in the same place."],
        ["S", "You first."],
        ["N", "There was no time left to argue."],
        ["N", "The three men stood between the cannons and the channel. The basalt spine shielding the passage ended fifty yards too soon. The fleet would have a clean line of fire before the civilians reached open water."],
        ["Mercer", "Lieutenant. Tell me this mattered."],
        ["N", "Deke never looked away from the fleet."],
        ["Deke", "It mattered."],
        ["N", "The first row of cannons fired."]
      ]);
      G.W.flash("#ffd9a0", 700, .6); G.W.shake(.8, .1);
      await G.play({
        where: "The beach",
        hs: { deke: ["Deke", ["Look"]], mercer: ["Mercer", ["Look"]] },
        items: { olive: "Olive" },
        objective: () => "The sky is fire. Give Olive to Deke.",
        target: () => "deke",
        hint: () => G.S.player === "hazel" ? "Tap Olive below, choose “Use on…”, then tap Deke." : "Deke is the only person in the world he trusts without calculation.",
        async look(id) { return G.say("N", id === "deke" ? "Deke, reaching for Olive." : "Mercer, with two rounds."); },
        async lookItem() { return G.say("N", "She was crying. He could feel her heartbeat against his ribs."); },
        async act() { return G.say("N", "There was no time. Olive. Deke."); },
        async useOn(item, id) {
          if (item === "olive" && id === "deke") {
            await G.W.goTo("deke"); await G.W.gesture();
            G.drop("olive");
            const p = G.W.player, d = G.W.actor("deke");
            if (p) { p.gear({ baby: false }); p.pose("carry", false); }
            if (d) { d.gear({ baby: true, rifle: "back" }); d.pose("carry", true); }
            return G.finish();
          }
          return G.say("N", "No. Deke.");
        }
      });
      await G.lines([
        ["N", "He remembered the sky becoming fire."],
        ["N", "He remembered putting Olive into his friend's arms, because Deke was the only person in the world he trusted without calculation."],
        ["N", "He remembered Nightforge trembling in his calloused, ordinary hand."],
        ["N", "There was no plan. No technique. No heroic certainty that he could stop what was coming. He knew exactly how small he was compared with the wall of flame crossing the harbor."],
        ["N", "He did not ask the sword for power. He did not command anything."],
        ["N", "His entire mind collapsed around one desperate refusal."]
      ]);
      await G.choose("", ["Not them."]);
      G.controls(false);
      await G.say("N", "Then Sean Cooke disappeared.");
      await G.say("N", "What happened next survived only in pieces. Your father doesn't remember it. Deke told him.");
      const arc = G.W.ev("arc");
      await G.lines([
        ["N", "Deke would remember Nightforge making a sound like a bell struck at the bottom of the ocean."],
        ["N", "Black lines raced from the saber's guard across your father's right hand, beneath his sleeve, and toward his shoulder. His eyes were open. He was not inside them."],
        ["N", "Darkness poured along Nightforge's edge. Purple light leaked through it in narrow fractures."],
        ["N", "Nightforge moved his arm. The swing was not graceful. It was not controlled. It dragged his body behind it like the weapon had mistaken flesh for a handle."],
        ["N", "The harbor vanished inside a black arc. It struck the lead warship broadside and continued through the ships behind it. It carved into Bellgrave's outer cliff and sheared away a hundred feet of stone."],
        ["N", "Then the sound arrived. The sea rose as a wall."],
        ["N", "Deke threw himself over Olive. Mercer anchored one arm around Deke's waist and the other around a buried mooring chain."],
        ["N", "The wave struck the evacuation boats as they entered the channel. Only the basalt spine Deke had chosen for their escape kept the uncontrolled force from crushing them outright."]
      ]);
      await arc;
      await G.scene2d("black");
      G.controls(true);
      await G.lines(sis(G, [["SIS", "Dad did that?"], ["N", "The sword did it, with your father's arm. He still doesn't know the difference. Neither do I."]], [["SIS", "Was I okay?"], ["N", "Keep listening."]]));
    }
  });

  // =====================================================================
  // EIGHT: After
  // =====================================================================
  CH.push({
    id: "after", title: "After",
    async run(G) {
      const S = G.S;
      await G.card("Chapter Eight", "After", "The waterline.");
      S.flags = {}; S.inv = [];
      if (G.resumeAt() !== "sunrise") {
      await G.scene3d("beach", { mode: "after" });
      await G.W.fade(0, 900);
      await G.lines([
        ["N", "He awoke to Olive screaming."],
        ["N", "Pain had replaced the right half of his body. He lay near the waterline with his cheek against warm glass, where sand had fused beneath him. Nightforge was still trapped in his right fist."],
        ["Deke", "It won't let go. I need you to stop fighting me."],
        ["S", "I'm not. I can't feel what it's doing."]
      ]);
      let tries = 0;
      for (;;) {
        const i = await G.choose("Where does your father look?", ["At the sword.", "At Deke."]);
        if (i === 1) break;
        tries++;
        await G.lines([["N", "His fingers tightened again without permission."], ["Deke", "Not the sword. Look at me."]]);
        if (tries > 2) break;
      }
      await G.lines([
        ["Deke", "Then look at me. Not the sword."],
        ["N", "He fixed his eyes on Deke's remaining goggle lens and tried to breathe while his friend peeled his hand away from Nightforge, one finger at a time."],
        ["N", "Black branching scars covered his palm and climbed beneath the torn sleeve. He could feel Deke touching it, but the feeling arrived late and wrong."],
        ["N", "Deke wrapped both hands around the hilt and tore Nightforge free. The instant it left his grip, his entire arm began shaking."]
      ]);
      G.tremor(true);
      await G.lines(sis(G, [["SIS", "His arm. Is that why Dad's hand shakes sometimes?"], ["N", "Yes."]], [["SIS", "Is that why Dad's hand shakes?"], ["N", "Yes."]]));
      await G.say("S", "Tell me what happened.");
      await G.play({
        where: "The waterline",
        hs: { deke: ["Deke", ["Look", "Talk"]], glass: ["Fused sand", ["Look"]], frigate: ["Frigate", ["Look"]] },
        objective: () => "His hand won't stop shaking. Look around, then talk to Deke.",
        target: () => "deke",
        hint: () => "Talk to Deke.",
        async look(id) {
          if (id === "glass") return G.say("N", "Where he had stood, the sand had melted into glass.");
          if (id === "frigate") return G.say("N", "What was left of his frigate.");
          return G.lines([
            ["N", "Deke looked toward the harbor."],
            ["N", "Three warships were sinking. Two more burned without masts. The remaining vessels retreated through the fog, firing signal flares as they fled. Part of Bellgrave's cliff had collapsed into the sea."],
            ["N", "There were no evacuation boats in sight."]
          ]);
        },
        async act(id) { if (id === "deke") return G.finish(); return no(G); }
      });
      await G.lines([
        ["S", "Where are the boats?"],
        ["Deke", "The current carried them beyond the channel. The smoke is hiding the far water."],
        ["S", "Did they make it?"],
        ["N", "Deke hesitated. It lasted less than a second, but your father saw it."],
        ["S", "Do not protect me from the answer."],
        ["Deke", "I saw at least four boats clear the reef before the wave hit. Others overturned. People were swimming, and the current was moving toward the south rocks. Mercer has gone to look."],
        ["S", "The wave came from the fleet?"],
        ["N", "Deke said nothing."],
        ["S", "It came from me."],
        ["N", "Deke placed Olive against his chest. She was wet, furious, and alive. The moment his left arm closed around her, her scream broke into exhausted sobbing."]
      ]);
      const p = G.W.player;
      if (p) { p.pose("lie", false); p.gear({ baby: true }); p.pose("carry", true); }
      await G.lines([
        ["Deke", "You weren't there. Not the way you are now. You handed Olive to me, and then the sword changed. It pulled you upright. I called your name twice. You looked straight through me."],
        ["S", "But I swung it."],
        ["Deke", "Your body did. I don't know whether that distinction will help you. It is the truth anyway."],
        ["N", "Nightforge lay several feet away. Its blade was gray again, scratched and unremarkable. Nothing about it acknowledged the harbor, the scar, or the missing piece of sea cliff."],
        ["S", "Did I hit our people?"],
        ["Deke", "The strike broke the fleet. The wave hit everything else. The basalt ridge took most of it, but not all."],
        ["S", "That isn't an answer."],
        ["Deke", "It is the only one I have. I don't know."],
        ["N", "That answer wounded more deeply than the arm."]
      ]);
      const m = G.W.actor("mercer");
      if (m) { m.root.visible = true; m.place(-5, -1, Math.PI / 2); m.walkTo(1.8, .4); await G.wait(1500); }
      await G.lines([
        ["N", "Mercer emerged from the smoke carrying Nia's broken rifle."],
        ["Mercer", "Found three civilian boats caught beyond the south rocks. They're damaged, but afloat. No sign of Bell."],
        ["N", "Deke closed his eyes. Nia had been in the water when the wave struck."],
        ["N", "Your father would not learn until years later that fishermen found Nia tangled in a net, unconscious but breathing. By then the Central Authority had already declared every member of Deke's platoon dead."],
        ["N", "Including Deke. Including Mercer."],
        ["N", "The lie began before the fires went out."]
      ]);
      G.checkpoint("sunrise");
      await G.W.fade(1, 700);
      }
      G.tremor(true);
      await G.scene3d("beach", { mode: "sunrise" });
      await G.W.fade(0, 900);
      await G.lines([
        ["N", "At sunrise, Bellgrave was hidden beneath smoke and a rising tide. The surviving villagers scattered before another fleet could arrive, carrying wounded strangers, charcoal rubbings, and memories the Central Authority would spend years trying to kill."],
        ["N", "Mercer bound his arm from palm to shoulder. Two fingers would not move. The others clenched whenever Nightforge came near."],
        ["Mercer", "It needs a real doctor."],
        ["S", "I know one person who can find one."],
        ["Deke", "The smallest fishing boat still has a mast. Take it east until Bellgrave is below the horizon, then turn south. Avoid any port large enough to keep a Fleet office. Assume every message is being read, and every person who recognizes you is deciding whether the reward is worth it."]
      ]);
      await ask(G, says(), [
        said("You keep saying ‘you.’"),
        fix("Got it. East, then south.", "He heard the shape of it before that. He said:", [["S", "You keep saying ‘you.’"]])
      ]);
      await G.lines([
        ["Deke", "Because I'm not going with you."],
        ["S", "We just found each other."],
        ["Deke", "I know."],
        ["S", "You lost nearly your entire platoon. The authority you served tried to execute you. This is not the moment to disappear on some private mission."],
        ["Deke", "Harrow survived. Mercer recovered part of his coded dispatch before the fleet withdrew, and Bellgrave was not the only name on it."],
        ["N", "Deke unfolded a bloodstained strip of paper. Most of the writing had washed into blue smears, but several coordinate groups remained beside a column of dates."],
        ["S", "What are the other places?"],
        ["Deke", "I don't know yet. I know the order was prepared before we transmitted the discovery. Bellgrave may not have been erased because of what we found. We may have been sent here because someone already knew it was here."]
      ]);
      await G.lines(sis(G, [["SIS", "Bellgrave was not the first."], ["N", "Now you know where that sentence comes from."]], [["SIS", "Not the first. Like our map!"], ["N", "Like your map."]]));
      await ask(G, says(), [
        said("Then we take this to Shannon and figure it out together."),
        fix("I'll go with you.", "He wanted to. What he said was:", [["S", "Then we take this to Shannon and figure it out together."]])
      ]);
      await G.lines([
        ["Deke", "You have Olive."],
        ["Deke", "Whatever was happening beneath that island, she was part of it. Harrow saw the cradle. He saw you carry her out. If the Central Authority learns she survived, every ship will hunt her. Not because of anything she has done, but because she proves something happened in that chamber."],
        ["S", "Then anyone who comes for her goes through me."],
        ["Deke", "Look at your arm. You cannot close your own hand. You do not know what Nightforge will do the next time you draw it, and the last time it saved us, it nearly killed the people we were saving."],
        ["Deke", "Olive does not need a threat. She needs distance, food, a doctor, and someone who will put her needs ahead of his guilt."],
        ["S", "You think that isn't me?"],
        ["Deke", "I think it has to become you before the next fleet arrives."],
        ["Mercer", "Someone has to keep the lieutenant from confusing determination with a plan."],
        ["S", "He has me for that."],
        ["N", "Mercer looked pointedly at the wrecked frigate, the destroyed harbor, and the bandages already bleeding through around his arm."],
        ["Mercer", "Your record is mixed."],
        ["Deke", "Years ago, when the Academy expelled you, you told me to stay. You said I could do more good inside than I could following you out the gate."],
        ["S", "I remember."],
        ["Deke", "I hated you for being right. Just for a little while."],
        ["Deke", "But staying put me here. It gave thirty-one troopers a reason to question an order, and it gave these people time to reach the water. Now I need you to do the same thing for me. Take the child. Find Shannon. Stay alive long enough to learn what that sword did to you."],
        ["S", "And while I do that?"],
        ["Deke", "Mercer and I follow Harrow's list. We find out who prepared it, what the other coordinates mean, and whether Nia survived. If I tell you more before I know where we're going, you will follow."],
        ["S", "Yes."],
        ["Deke", "That is why I'm not telling you."],
        ["N", "Deke clasped his left forearm. He could not yet trust the right. For a while they stayed that way, each holding on hard enough to turn a farewell into something else."]
      ]);
      await ask(G, says(), [
        said("Come back."),
        fix("Goodbye, Deke.", "No. He never said goodbye. He said:", [["S", "Come back."]])
      ]);
      await G.lines([
        ["Deke", "I intend to. You do the same."],
        ["N", "They separated before either man could turn the promise into a goodbye."]
      ]);
      const d = G.W.actor("deke"), mm = G.W.actor("mercer");
      if (d) d.walkTo(8, -8, null, 1.1); if (mm) mm.walkTo(8.5, -7.4, null, 1.1);
      await G.lines([
        ["N", "Deke and Mercer left aboard a captured Fleet cutter with its markings burned away. Your father watched until the fog swallowed them."],
        ["N", "That story would remain Deke's for many years."]
      ]);
    }
  });

  // =====================================================================
  // NINE: Blacksteel
  // =====================================================================
  CH.push({
    id: "blacksteel", title: "Blacksteel",
    async run(G) {
      const S = G.S;
      await G.card("Chapter Nine", "Blacksteel", "West, on the smallest surviving fishing boat.");
      S.flags = {}; S.inv = [];
      await G.scene3d("boat");
      await G.lines([
        ["N", "Nightforge lay wrapped in canvas beneath the forward bench. He could feel it there through the ruined nerves of his arm. Not speaking. Not calling. Only present."],
        ["N", "Silent again. Ordinary again. As if none of it had happened."],
        ["N", "Three days later, a news gull found them at sea."]
      ]);
      await G.W.ev("gull");
      await G.play({
        where: "At sea",
        hs: { paper: ["Newspaper", ["Read"]], olive: ["Olive", ["Look"]], bundle: ["Canvas bundle", ["Look"]], gull: ["News gull", ["Look"]] },
        objective: () => "The gull brought a newspaper.",
        target: () => "paper",
        hint: () => "Read the newspaper.",
        async look(id) {
          if (id === "olive") return G.say("N", "Olive slept in a basket beside him, wrapped in a fisherman's coat. Every few minutes she kicked one foot free.");
          if (id === "bundle") return G.say("N", "Nightforge, under the bench. Dull gray and quiet.");
          if (id === "gull") return G.say("N", "The news gull waited to be paid. It was not going to be paid.");
        },
        async act(id) { if (id === "paper") return G.finish(); return no(G); }
      });
      await G.newspaper();
      await G.lines([
        ["N", "The article claimed he had led a pirate attack on an innocent archaeological mission, slaughtered thirty-one loyal Fleet troopers, kidnapped an unidentified child, and destroyed Bellgrave while attempting to steal a Central Authority artifact."],
        ["N", "Bellgrave's villagers were described as armed collaborators."],
        ["N", "The Record-Stone was never mentioned."],
        ["N", "Deke was praised as a heroic lieutenant, killed defending civilians from Sean's black steel."],
        ["N", "He read that sentence twice."],
        ["N", "He had not been a pirate when he reached Bellgrave. He had never flown a pirate flag, attacked a merchant, or declared war on anyone. None of that mattered. The Central Authority had given the world a monster before the truth could find a boat."],
        ["N", "His right arm began to shake. He pressed it against his chest until the tremor passed."],
        ["N", "The newspaper showed Nightforge as a great black weapon in the hand of a murderer. The real sword remained beneath the bench, dull gray and quiet. He wondered which version frightened him more."],
        ["N", "Shannon was at least two years away, if he avoided the main routes and survived the winter currents."],
        ["N", "He had one damaged boat, one damaged arm, an ordinary sword that had awakened into something monstrous, and a child who had known him for less than a week."],
        ["N", "Olive opened her eyes."]
      ]);
      await G.choose("", ["Hold out your left hand."]);
      await G.lines([
        ["N", "She wrapped all five fingers around one of his."],
        ["S", "Blacksteel."],
        ["N", "The word had been meant to condemn him. Maybe one day he would take it away from them."],
        ["S", "I don't know what they made you for. I don't know what that stone said. I don't know what happened to my sword, or what the hell I'm supposed to do next."],
        ["N", "Olive stared at him solemnly, then sneezed. He smiled."],
        ["S", "But I know this. You're not theirs."],
        ["N", "The fishing boat sailed west beneath a sky crowded with gulls. Behind them, the Central Authority erased Bellgrave Island from its final surviving chart."],
        ["N", "Ahead of them waited Shannon, and people your father had not yet met, one of whom would eventually look at his ruined arm and refuse to accept that broken meant useless."],
        ["N", "Those stories had not begun yet. Neither had the deeper story of Nightforge, Deke's disappearance, or the child sleeping beneath his hand."],
        ["N", "For now, there was only Sean, Olive, and the lie that would become the Blacksteel Pirates."]
      ]);
      G.tremor(false);
      await G.scene2d("frame");
      await G.lines(sis(G,
        [["SIS", "Olive's not theirs. She's ours."], ["N", "Yes. She is."]],
        [["SIS", "You're not theirs."], ["N", "No. You're not."]]));
      await G.say("N", "That's the island that never existed. Go to bed. Both of you.");
    }
  });

  window.STORY = CH;
})();
