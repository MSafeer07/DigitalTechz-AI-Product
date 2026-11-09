// Product Forge — the pipeline. Three clicks: Pocket → Blueprint → Write.
// Works in the browser (SDK from esm.sh) and in bun (npm SDK): pass in a client.
// Rules followed (Anthropic API, Sep 2026): beta messages + server-side fallbacks,
// adaptive thinking left on with an explicit effort, structured outputs never in the
// same call as web search, pause_turn resumed, refusal checked before reading content.

export const MODELS = {
  "free-stack": { label: "Free Stack (default)", input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};
export const FORMATS = [
  { id: "ebook", label: "Ebook", unit: "Chapter", blurb: "A written book: 8 to 11 chapters, each ending in a worksheet or checklist. The fastest format to test.",
    design: "8 to 11 chapters. Each chapter teaches one thing the reader can act on.",
    write: "Write it as a book chapter: teach, show, then give a short worksheet or checklist under a ### heading at the end." },
  { id: "course", label: "Video Course", unit: "Lesson", blurb: "Modules and lessons with a word-for-word script, on-screen points and a task per lesson. Record it or read it.",
    design: "8 to 11 lessons grouped into modules. Each lesson is 6 to 12 minutes on camera and teaches one thing.",
    write: "Write it as a video lesson: a ### Script section (word for word, spoken, first person, 900 to 1,300 words), then ### On screen (the bullet points and any table to show), then ### Your task (one homework task with a done-when line)." },
  { id: "coaching", label: "Coaching Offer", unit: "Week", blurb: "A 4 to 8 week programme: session plans, coaching questions, homework and deliverables, plus the offer.",
    design: "4 to 8 weeks. Each week is one coaching session with one outcome the client can show.",
    write: "Write it as a coaching week: ### Outcome this week, ### Session plan (45 to 60 minutes, timed blocks), ### Coaching questions (8 to 12), ### Homework (what the client does before next week), ### Deliverable (what they send you), ### Coach's notes (what to watch for)." },
];
export const IMAGE_MODELS = {
  none: { label: "No images", provider: null },
  omniroute: { label: "Omniroute AI Image (via your key)", provider: "omniroute", id: "antigravity/gemini-3.1-flash-image", cost: { "1K": 0.05, "2K": 0.15 } },
  flash: { label: "Nano Banana Flash (Gemini, cheaper)", provider: "gemini", id: "gemini-3.1-flash-image-preview", cost: { "1K": 0.05, "2K": 0.15 } },
  pro: { label: "Nano Banana Pro (Gemini, best)", provider: "gemini", id: "gemini-3-pro-image-preview", cost: { "1K": 0.13, "2K": 0.3 } },
  gpt: { label: "GPT Image 2 (OpenAI)", provider: "openai", id: "gpt-image-2-2026-04-21", cost: { "1K": 0.05, "2K": 0.42 } },
};
const IMAGE_PLAN_SCHEMA = {
  type: "object", additionalProperties: false, required: ["style", "cover", "chapters"],
  properties: {
    style: {
      type: "object", additionalProperties: false, required: ["medium", "palette", "mood", "rules"],
      properties: {
        medium: { type: "string", description: "One illustration medium used for every image, e.g. flat editorial illustration with soft grain, or clean 3D clay render" },
        palette: { type: "array", items: { type: "string" }, description: "4 hex colours, the first is the accent" },
        mood: { type: "string" }, rules: { type: "array", items: { type: "string" }, description: "3 to 5 composition rules that keep every image in the same family" },
      },
    },
    cover: { type: "object", additionalProperties: false, required: ["subject", "scene", "focal_point"], properties: { subject: { type: "string" }, scene: { type: "string" }, focal_point: { type: "string" } } },
    chapters: { type: "array", items: { type: "object", additionalProperties: false, required: ["subject", "scene", "focal_point"], properties: { subject: { type: "string" }, scene: { type: "string" }, focal_point: { type: "string" } } }, description: "One per chapter, same order" },
  },
};
const SEARCH_COST = 0.01; // ten dollars per 1,000 web searches
const BETAS = ["server-side-fallback-2026-07-01"];
const webSearch = (max_uses) => ({ type: "web_search_20260209", name: "web_search", max_uses });
const webFetch = (max_uses) => ({ type: "web_fetch_20260209", name: "web_fetch", max_uses });
const LANG = (i) => (i?.language && i.language !== "English") ? `\nWrite everything the reader sees in ${i.language}.` : "";
const urlsIn = (t) => (t || "").match(/https?:\/\/[^\s)>\]]+/g) || [];

const CLEAR = {
  type: "object", additionalProperties: false,
  required: ["longevity", "effort", "autonomy", "recurring", "competition"],
  properties: {
    longevity: { type: "integer", description: "Will people still need this in 3 years?" },
    effort: { type: "integer", description: "5 = easy to build well" },
    autonomy: { type: "integer", description: "5 = the buyer can get the result alone from the product" },
    recurring: { type: "integer", description: "5 = buyers come back or upgrade" },
    competition: { type: "integer", description: "5 = the lane is open, few good products" },
  },
};
const POCKETS_SCHEMA = {
  type: "object", additionalProperties: false, required: ["pockets", "recommended"],
  properties: {
    recommended: { type: "integer", description: "index of the best pocket" },
    pockets: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["name", "person", "problem", "buyer_words", "paying_now", "gap", "clear", "score", "why"],
        properties: {
          name: { type: "string", description: "Help/Teach/Show [person] to [outcome] using [method]. Under 20 words." },
          person: { type: "string", description: "One specific person, not a market" },
          problem: { type: "string", description: "The one problem, in plain words" },
          buyer_words: { type: "array", items: { type: "string" }, description: "3 exact phrases buyers use, quoted from the research" },
          paying_now: {
            type: "array", items: {
              type: "object", additionalProperties: false, required: ["what", "price", "url"],
              properties: { what: { type: "string" }, price: { type: "string" }, url: { type: "string" } },
            }, description: "2 to 4 things they already pay for, with real URLs from the research",
          },
          gap: { type: "string", description: "What the existing products miss" },
          clear: CLEAR,
          score: { type: "integer" },
          why: { type: "string", description: "One sentence: why this pocket, for this seller" },
        },
      },
    },
  },
};
const BLUEPRINT_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["titles", "subtitle", "promise", "before", "after", "journey", "price", "bonuses", "sections", "research_questions", "word_count"],
  properties: {
    titles: { type: "array", items: { type: "string" }, description: "Best first. Under 8 words each. Names a person or an outcome." },
    subtitle: { type: "string" },
    promise: { type: "string", description: "One sentence transformation promise" },
    before: { type: "object", additionalProperties: false, required: ["have", "do", "feel"], properties: { have: { type: "string" }, do: { type: "string" }, feel: { type: "string" } } },
    after: { type: "object", additionalProperties: false, required: ["have", "do", "feel"], properties: { have: { type: "string" }, do: { type: "string" }, feel: { type: "string" } } },
    journey: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["stage", "milestone"],
        properties: { stage: { type: "string" }, milestone: { type: "string", description: "The measurable thing done by the end of this stage" } },
      },
    },
    price: { type: "object", additionalProperties: false, required: ["amount", "why"], properties: { amount: { type: "integer", description: "USD" }, why: { type: "string" } } },
    bonuses: { type: "array", items: { type: "string" }, description: "Bonus materials to include at the end (a checklist, a template, a tracker)" },
    sections: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["title", "goal"],
        properties: { title: { type: "string" }, goal: { type: "string", description: "What the reader can do after this section" } },
      },
    },
    research_questions: { type: "array", items: { type: "string" }, description: "The questions that must be answered from real sources before writing" },
    word_count: { type: "integer", description: "Target total words, 8000 to 14000" },
  },
};
const PACKAGE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["cover", "intro", "store", "upsell", "creator_dm", "charter"],
  properties: {
    charter: {
      type: "object", additionalProperties: false, required: ["positioning", "usp", "tried_before", "objections"],
      properties: {
        positioning: { type: "string", description: "One sentence: for whom, against what alternative, why this" },
        usp: { type: "string", description: "The one thing no competing product does" },
        tried_before: { type: "array", items: { type: "string" }, description: "What this buyer already tried that failed, and why" },
        objections: {
          type: "array", items: {
            type: "object", additionalProperties: false, required: ["objection", "answer"],
            properties: { objection: { type: "string" }, answer: { type: "string" } },
          },
        },
      },
    },
    cover: {
      type: "object", additionalProperties: false, required: ["title", "subtitle", "tagline", "accent"],
      properties: { title: { type: "string" }, subtitle: { type: "string" }, tagline: { type: "string", description: "Under 12 words" }, accent: { type: "string", description: "A hex colour like #1d4ed8 that suits the topic" } },
    },
    intro: { type: "string", description: "The introduction chapter in markdown, 300 to 500 words: who this is for, the promise, how to use it" },
    store: {
      type: "object", additionalProperties: false, required: ["headline", "subheadline", "bullets", "price_line", "guarantee"],
      properties: {
        headline: { type: "string" }, subheadline: { type: "string" },
        bullets: { type: "array", items: { type: "string" }, description: "What they get, outcome first" },
        price_line: { type: "string" }, guarantee: { type: "string" },
      },
    },
    upsell: {
      type: "object", additionalProperties: false, required: ["name", "what", "price", "pitch"],
      properties: { name: { type: "string" }, what: { type: "string" }, price: { type: "integer" }, pitch: { type: "string", description: "The one-paragraph offer shown right after purchase" } },
    },
    creator_dm: { type: "string", description: "A 60 to 90 word message to a creator in this niche offering to build and sell this product to their audience on a revenue split. No hype." },
  },
};

export function createForge(client, opts = {}) {
  const state = {
    model: opts.model || "free-stack",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 },
    sources: new Map(), // url -> {n, title}
    input: null, pockets: null, pocket: null, format: null, blueprint: null,
    research: "", sections: [], pkg: null, imagePlan: null, images: {}, imageSpend: 0,
  };
  if (opts.state) restore(opts.state);
  const status = (s) => opts.onStatus && opts.onStatus(s);
  function snapshot() { // images are big; the page keeps them in IndexedDB
    return { ...state, images: {}, sources: [...state.sources.entries()].map(([url, v]) => ({ url, ...v })) };
  }
  function restore(snap) {
    Object.assign(state, snap, { images: state.images || {}, sources: new Map((snap.sources || []).map((s) => [s.url, { n: s.n, title: s.title }])) });
  }
  const costChanged = () => opts.onCost && opts.onCost(cost());

  function cost() {
    const p = MODELS[state.model];
    const u = state.usage;
    return (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1e6 + u.searches * SEARCH_COST + (state.imageSpend || 0);
  }
  function addUsage(usage) {
    if (!usage) return;
    state.usage.input += usage.input_tokens || 0;
    state.usage.output += usage.output_tokens || 0;
    state.usage.cacheRead += usage.cache_read_input_tokens || 0;
    state.usage.cacheWrite += usage.cache_creation_input_tokens || 0;
    state.usage.searches += usage.server_tool_use?.web_search_requests || 0;
    costChanged();
  }
  function collectSources(content) {
    for (const block of content) {
      if (block.type === "web_fetch_tool_result" && block.content?.type === "web_fetch_result" && block.content.url) {
        const u = block.content.url; if (!state.sources.has(u)) state.sources.set(u, { n: state.sources.size + 1, title: block.content.document?.title || u });
        continue;
      }
      if (block.type !== "web_search_tool_result") continue;
      if (!Array.isArray(block.content)) continue; // an object here is an error (e.g. max_uses_exceeded)
      for (const r of block.content) {
        if (r.type === "web_search_result" && r.url && !state.sources.has(r.url)) {
          state.sources.set(r.url, { n: state.sources.size + 1, title: r.title || r.url });
        }
      }
    }
  }
  function sourceList() {
    return [...state.sources.entries()].map(([url, s]) => ({ n: s.n, title: s.title, url }));
  }
  function sourceText() {
    return sourceList().map((s) => `[${s.n}] ${s.title}: ${s.url}`).join("\n") || "(none yet)";
  }

  // One call. Loops on pause_turn (server tools), checks refusal, streams text if asked.
  async function call({ system, user, tools, schema, maxTokens = 16000, effort = "high", onText, cache = false }) {
    let actualUser = user;
    if (schema) {
      actualUser += `\n\nCRITICAL: You MUST respond ONLY with a valid JSON object matching this schema:\n${JSON.stringify(schema, null, 2)}\nDo not include any explanation, conversational text, or preamble. Return the JSON object directly.`;
    }
    const messages = [{ role: "user", content: actualUser }];
    const sys = cache ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] : system;
    for (let turn = 0; turn < 10; turn++) {
      const params = {
        model: state.model, max_tokens: maxTokens, system: sys, messages,
        betas: BETAS, fallbacks: "default",
        output_config: { effort, ...(schema ? { format: { type: "json_schema", schema } } : {}) },
        ...(tools ? { tools } : {}),
      };
      // A dropped connection mid-stream is the one failure browsers hit: retry, second time without streaming.
      let msg;
      for (let attempt = 0; ; attempt++) {
        try {
          if (attempt === 1) { msg = await client.beta.messages.create(params); }
          else { const stream = client.beta.messages.stream(params); if (onText) stream.on("text", (delta) => onText(delta)); msg = await stream.finalMessage(); }
          break;
        } catch (e) {
          const net = /network error|failed to fetch|load failed|socket|ECONNRESET|timed out|terminated|overloaded|529|429/i.test(String(e?.message || e)) || e?.status === 529 || e?.status === 429;
          state.dropped = state.dropped || net;
          if (!net || attempt >= 2) throw e;
          status(`Connection dropped, retrying (${attempt + 1} of 2)...`);
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
      addUsage(msg.usage);
      collectSources(msg.content);
      if (msg.stop_reason === "refusal") {
        throw new Error("Claude declined this request" + (msg.stop_details?.explanation ? `: ${msg.stop_details.explanation}` : "."));
      }
      if (msg.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: msg.content }); continue; }
      if (msg.stop_reason === "max_tokens") throw new Error("Ran out of room. Shorten the input and try again.");
      const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      if (!schema) return text;

      function extractJson(str) {
        if (!str) return null;
        try { return JSON.parse(str.trim()); } catch {}
        const m = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (m) {
          try { return JSON.parse(m[1].trim()); } catch {}
        }
        const firstObj = str.indexOf('{');
        const lastObj = str.lastIndexOf('}');
        if (firstObj !== -1 && lastObj > firstObj) {
          try { return JSON.parse(str.slice(firstObj, lastObj + 1)); } catch {}
        }
        const firstArr = str.indexOf('[');
        const lastArr = str.lastIndexOf(']');
        if (firstArr !== -1 && lastArr > firstArr) {
          try { return JSON.parse(str.slice(firstArr, lastArr + 1)); } catch {}
        }
        return null;
      }
      const parsed = extractJson(text);
      if (parsed) return parsed;
      throw new Error("Model response was not valid JSON: " + text.slice(0, 100));
    }
    throw new Error("The research took too many turns. Try again.");
  }

  const SELLER = () => {
    const i = state.input;
    if (i.mode === "creator") return `The product is being built FOR A CREATOR, to sell to that creator's audience on a revenue split.\nCreator: ${i.creator}\nWhat the creator posts (titles, captions, comments pasted by the user):\n${i.text || "(nothing pasted; rely on the web)"}`;
    if (i.mode === "demand") return `The product is being built FROM DEMAND the user collected: comments, threads, reviews, questions people keep asking.\n${i.text}`;
    return `The product is for the user to sell themselves.\nWhat they know, can do, or who they want to help:\n${i.text || "(blank: find the most profitable pocket for a beginner with no audience)"}`;
  };

  // ---------- Click 1: Pocket ----------
  async function findPockets(input, onText) {
    state.input = input; state.pockets = null; state.pocket = null;
    status("Searching what people already pay for...");
    const notes = await call({
      system: "You are Product Forge, a market researcher for small digital products (ebooks, guides, templates, short courses). You find profitable pockets: one specific person with one specific problem they already pay to solve, that nobody serves well. You search the web and report what you actually find, with URLs. Plain English. No hype.",
      user: `${SELLER()}\n\nFind 5 to 7 candidate profitable pockets. Use web search (Amazon books, Udemy, Gumroad, Etsy digital downloads, Reddit and forum threads, YouTube comments, review sites) to see what people ALREADY pay for around this, what they complain is missing, and the exact words they use. For each candidate write: the person, the problem, 3 quoted buyer phrases, 2 to 4 paid products they buy today with price and URL, the gap. Then rank them on the CLEAR test (Longevity, Effort, Autonomy, Recurring, Competition, each 1 to 5). Write your notes as plain text; keep every URL you used.`,
      tools: [webSearch(6)], maxTokens: 16000, effort: "high", onText,
    });
    status("Scoring the pockets...");
    let out = await call({
      system: "You turn research notes into a strict JSON answer. Only use facts and URLs present in the notes. Never invent a URL.",
      user: `Research notes:\n${notes}\n\nSources seen:\n${sourceText()}\n\nPick the 5 best pockets and score them on the CLEAR test. Name each one as "Help/Teach/Show [person] to [outcome] using [method]".`,
      schema: POCKETS_SCHEMA, maxTokens: 16000, effort: "medium",
    });

    // Normalize response structure
    if (!out || typeof out !== "object") {
      throw new Error("Model returned invalid data structure. Try again.");
    }
    if (Array.isArray(out)) {
      out = { pockets: out, recommended: 0 };
    }
    if (!Array.isArray(out.pockets)) {
      throw new Error("Model did not return a list of pockets. Try again.");
    }

    out.pockets.forEach((p, idx) => {
      if (!p.clear || typeof p.clear !== "object") {
        throw new Error(`Pocket ${idx + 1} is missing CLEAR scores. Try again.`);
      }
      p.score = Object.values(p.clear).reduce((a, b) => a + (Number(b) || 0), 0);
    });

    state.pockets = out;
    return out;
  }

  // ---------- Click 2: Blueprint + research ----------
  async function blueprint(pocketIndex, formatId, onText) {
    state.pocket = state.pockets.pockets[pocketIndex];
    state.format = FORMATS.find((f) => f.id === formatId) || FORMATS[0];
    status("Designing the product...");
    const bp = await call({
      system: "You design small digital products that sell because they solve one problem for one person. You write in plain English at a 5th-grade reading level. Titles name a person or an outcome, never a vague theme.",
      user: `${SELLER()}\n\nChosen pocket:\n${JSON.stringify(state.pocket, null, 2)}\n\nFormat: ${state.format.label}. ${state.format.design}${LANG(state.input)}\n\nDesign the product: 3 titles, subtitle, one-sentence promise, the before and after (what they have / what they do / how they feel), a 4-stage journey with a measurable milestone per stage, a price in USD with a reason (ebooks 17 to 47 dollars, video courses 47 to 197 dollars, coaching 300 to 2,000 dollars), 3 to 4 bonus materials, the sections (${state.format.unit.toLowerCase()}s) each with a goal the reader can act on, and 15 to 20 research questions that must be answered from real sources before writing (numbers, named methods, tools, prices, mistakes, examples).`,
      schema: BLUEPRINT_SCHEMA, maxTokens: 16000, effort: "high",
    });
    state.blueprint = bp;
    return bp;
  }
  async function research(onText) {
    const bp = state.blueprint;
    status("Researching the answers...");
    const urls = urlsIn(state.input.knowledge).slice(0, 5);
    const research = await call({
      system: "You are a careful researcher. Answer each question from real web sources with specifics: numbers, named methods, tools, prices, steps, examples, common mistakes. Say which source each fact came from. If the web has no answer, say so; never make one up.",
      user: `Product: ${bp.titles[0]}: ${bp.promise}\nReader: ${state.pocket.person}\n\nAnswer these questions using web search${urls.length ? ` and fetch these pages the seller gave you first: ${urls.join(" ")}` : ""}. Organise the notes by question number. Keep it dense and factual; this becomes the raw material for the product.\n\n${bp.research_questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
      tools: [webSearch(12), ...(urls.length ? [webFetch(5)] : [])], maxTokens: 16000, effort: "high", onText,
    });
    state.research = research;
    return research;
  }

  // ---------- Click 3: Write + package ----------
  function writerSystem() {
    const bp = state.blueprint;
    return [
      `You write the ${state.format.unit.toLowerCase()}s of a digital product (format: ${state.format.label}). ${state.format.write} Plain English, short sentences, second person ("you"). Concrete: numbers, steps, examples, named tools. Position it as "what the experts agree on", not "I think". Cite sources inline as [n] using ONLY the numbered source list below. Paragraphs of 1 to 3 sentences. Every 200 to 300 words, one designed block, written as a fenced container on its own lines (open with ::: and a type, close with :::). Types: takeaways (3 bullets, always the first block), steps (a numbered list, one action per step), checklist (- [ ] items, always the last block), example (a short real scenario), warning (the mistake to avoid), quote (one line the reader will remember), stat (one line: a big number | what it means | [n]; only with a source), compare (two blocks separated by a line with ---: first the before, then the after), flow (3 to 6 lines, one short step each, in order), timeline (3 to 8 lines "Day 1: ..." or "Week 2: ..."). Real markdown otherwise: ### for headings inside the chapter and #### below that (never # or ##), bullet lists, numbered steps, tables where they help, bold sparingly. No filler openings, no "in this chapter we will". Never use these words or phrases: "in today's fast-paced world", "delve", "unlock", "game-changer", "landscape", "leverage", "it's important to note", "journey" (unless it is the reader's plan), "seamless", "robust", "elevate", "empower", em dashes.`,
      `PRODUCT\nTitle: ${bp.titles[0]}\nSubtitle: ${bp.subtitle}\nPromise: ${bp.promise}\nReader: ${state.pocket.person}\nProblem: ${state.pocket.problem}\nFormat: ${state.format.label}\nBefore: ${JSON.stringify(bp.before)}\nAfter: ${JSON.stringify(bp.after)}\nJourney: ${bp.journey.map((j) => `${j.stage} → ${j.milestone}`).join(" | ")}\nTarget length: about ${Math.round(bp.word_count / bp.sections.length)} words per section, never more than ${Math.round(bp.word_count / bp.sections.length * 1.6)}.${LANG(state.input)}`,
      `OUTLINE\n${bp.sections.map((s, i) => `${i + 1}. ${s.title}: ${s.goal}`).join("\n")}`,
      `RESEARCH NOTES\n${state.research}`,
      `SOURCES\n${sourceText()}`,
      state.input.knowledge ? `THE SELLER'S OWN MATERIAL (use it, it is theirs)\n${state.input.knowledge}` : "",
    ].filter(Boolean).join("\n\n");
  }
  async function writeSection(i, onText) {
    const s = state.blueprint.sections[i];
    status(`Writing ${i + 1} of ${state.blueprint.sections.length}: ${s.title}`);
    const done = state.sections.slice(0, i).map((x, k) => `${k + 1}. ${x.title}: ${x.body.slice(0, 200).replace(/\n/g, " ")}...`).join("\n");
    const body = await call({
      system: writerSystem(), cache: true,
      user: `Write section ${i + 1}: "${s.title}".\nGoal: ${s.goal}\n${done ? `Already written (do not repeat):\n${done}\n` : ""}\nStart directly with the content (no top-level title; it is added for you). Follow the format's structure exactly. Use at least five designed blocks: takeaways first, then steps, then one of flow, compare or timeline, one example or warning, and checklist last.`,
      maxTokens: 12000, effort: "high", onText,
    });
    state.sections[i] = { title: s.title, body: body.trim().replace(/^(#{1,2})\s+/gm, "### ") };
    return state.sections[i];
  }
  async function rewriteSection(i, onText) { state.sections[i] = null; state.pkg = null; return writeSection(i, onText); }
  // Two chapters at a time: halves the build time, stays under a new key's rate limits.
  async function writeAll(onSection, onText, concurrency = 2) {
    const todo = state.blueprint.sections.map((_, i) => i).filter((i) => !state.sections[i]); // retry-safe
    for (let k = 0; k < todo.length;) {
      const size = (k === 0 && !state.sections.some(Boolean)) || state.dropped ? 1 : concurrency; // first chapter alone warms the prompt cache; after a drop, one at a time
      const batch = todo.slice(k, k + size); k += size;
      await Promise.all(batch.map((i, j) => writeSection(i, j === 0 ? onText : null).then((sec) => onSection && onSection(i, sec))));
    }
  }
  async function packageProduct() {
    status("Packaging: cover, intro, store page...");
    const bp = state.blueprint;
    const pkg = await call({
      system: "You package finished digital products: cover copy, an introduction, a store page, one upsell, and one creator message. Plain English. Outcome first. No hype words (insane, secret, ultimate, game-changer).",
      user: `Product: ${bp.titles[0]}\nSubtitle: ${bp.subtitle}\nPromise: ${bp.promise}\nReader: ${state.pocket.person}\nPrice: $${bp.price.amount}\nBonuses: ${bp.bonuses.join("; ")}\nSections:\n${state.sections.map((s, i) => `${i + 1}. ${s.title}`).join("\n")}\n\nFirst 150 words of section 1:\n${state.sections[0]?.body.slice(0, 900)}\n\n${LANG(state.input)}\nWrite the cover, a 300 to 500 word introduction in markdown, the store page, one upsell (the natural next thing this buyer needs right after, priced 2 to 4x the product), a 60 to 90 word creator DM, and the product charter (positioning, USP, what this buyer tried before that failed, the 3 objections a buyer will have and the honest answer to each).`,
      schema: PACKAGE_SCHEMA, maxTokens: 16000, effort: "medium",
    });
    state.pkg = pkg;
    return pkg;
  }

  // ---------- Images: one style spec per book, one JSON spec per picture (never a raw prompt) ----------
  async function planImages() {
    const bp = state.blueprint;
    status("Designing the illustration style...");
    const plan = await call({
      system: "You are an art director for digital products. You design ONE illustration style for a whole book, then a picture for the cover and one per chapter that a text-to-image model can render consistently. Pictures never contain text, letters, numbers, logos, signs, labels, cards with words, screens, charts or real people's faces: describe objects, places and gestures only, so a text-to-image model has nothing to spell.",
      user: `Book: ${bp.titles[0]}\nSubtitle: ${bp.subtitle}\nReader: ${state.pocket.person}\nPromise: ${bp.promise}\nAccent colour to build the palette around: ${state.accent || "#7c3aed"}\nChapters:\n${bp.sections.map((x, i) => `${i + 1}. ${x.title}: ${x.goal}`).join("\n")}\n\nDesign the style (medium, 4-colour palette starting with the accent, mood, 3 to 5 rules), the cover picture (a single strong metaphor for the promise, calm negative space in the top third for the title), and one picture per chapter (same order, each a concrete scene that shows the chapter's idea, never a generic stock scene).`,
      schema: IMAGE_PLAN_SCHEMA, maxTokens: 16000, effort: "medium",
    });
    if (plan.chapters.length !== bp.sections.length) plan.chapters = bp.sections.map((_, i) => plan.chapters[i] || plan.chapters[plan.chapters.length - 1]);
    state.imagePlan = plan;
    return plan;
  }
  function imageSpec(which) {
    const p = state.imagePlan, pic = which === "cover" ? p.cover : p.chapters[which];
    return JSON.stringify({
      type: "editorial_illustration", text: "none", style: p.style, subject: pic.subject, scene: pic.scene, focal_point: pic.focal_point,
      aspect_ratio: which === "cover" ? "3:4" : "16:9",
      rules: ["no text, no letters, no numbers, no logos, no watermark, no signature", "one coherent image, no collage, no borders", ...(which === "cover" ? ["calm negative space in the top third"] : [])],
    }, null, 1);
  }
  async function renderImage(which, opts) {
    const m = IMAGE_MODELS[opts.model]; if (!m?.provider) return null;
    const spec = imageSpec(which), size = which === "cover" ? "2K" : "1K", aspect = which === "cover" ? "3:4" : "16:9";
    const prompt = `ABSOLUTELY NO TEXT: no words, letters, numbers, labels, signs, captions or logos anywhere in the picture.\nRender exactly this JSON spec as a single finished illustration.\n${spec}`;
    let dataUrl;
    if (m.provider === "omniroute") {
      const res = await fetch("http://localhost:20128/v1/images/generations", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.omnirouteKey || opts.apiKey}` },
        body: JSON.stringify({ model: m.id, prompt, size: which === "cover" ? "1024x1024" : "1024x1024" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(`Image model: ${json?.error?.message || res.status}`);
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) throw new Error("Omniroute image model returned no picture.");
      dataUrl = `data:image/jpeg;base64,${b64}`;
    } else if (m.provider === "gemini") {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m.id}:generateContent?key=${encodeURIComponent(opts.geminiKey)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { imageSize: size, aspectRatio: aspect } } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(`Image model: ${json?.error?.message || res.status}`);
      const img = json?.candidates?.[0]?.content?.parts?.find((x) => x.inlineData);
      if (!img) throw new Error("The image model returned no picture" + (json?.promptFeedback?.blockReason ? ` (${json.promptFeedback.blockReason})` : "."));
      dataUrl = `data:${img.inlineData.mimeType || "image/png"};base64,${img.inlineData.data}`;
    } else {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.openaiKey}` },
        body: JSON.stringify({ model: m.id, prompt, size: which === "cover" ? "1024x1536" : "1536x1024", quality: which === "cover" ? "medium" : "low", n: 1 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(`Image model: ${json?.error?.message || res.status}`);
      dataUrl = `data:image/png;base64,${json.data[0].b64_json}`;
    }
    state.images[which] = dataUrl; state.imageSpend += m.cost[size]; costChanged();
    return dataUrl;
  }
  // Every missing picture, two at a time. onDone(which, dataUrl) after each.
  async function illustrate(opts, onDone) {
    if (!IMAGE_MODELS[opts.model]?.provider) return;
    if (!state.imagePlan) await planImages();
    const wanted = ["cover", ...(opts.scope === "cover" ? [] : state.sections.map((_, i) => i))].filter((w) => !state.images[w]);
    for (let k = 0; k < wanted.length; k += 2) {
      const batch = wanted.slice(k, k + 2);
      status(`Illustrating ${batch.map((w) => (w === "cover" ? "the cover" : `chapter ${w + 1}`)).join(" and ")}...`);
      await Promise.all(batch.map((w) => renderImage(w, opts).then((u) => onDone && onDone(w, u))));
    }
  }
  function estimateImages(model, scope) { const m = IMAGE_MODELS[model]; if (!m?.provider) return 0; return m.cost["2K"] + (scope === "cover" ? 0 : (state.blueprint?.sections.length || 10) * m.cost["1K"]); }

  // Designed blocks: ":::type" ... ":::" → cards and graphics with real text (no image model, no typos).
  function makeRenderer(parse) {
    const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const ICONS = { takeaways: "★", steps: "①", checklist: "✓", example: "☞", warning: "!", quote: "“", stat: "#", compare: "⇄", flow: "→", timeline: "◷" };
    const TITLES = { takeaways: "Key takeaways", steps: "Steps", checklist: "Checklist", example: "Example", warning: "Watch out", quote: "", stat: "", compare: "Before and after", flow: "How it flows", timeline: "Timeline" };
    const inner = (t) => parse(t.trim());
    const block = (type, title, body) => {
      const head = (title || TITLES[type]) ? `<div class="bx-h"><span class="bx-i">${ICONS[type] || "•"}</span>${esc(title || TITLES[type])}</div>` : "";
      if (type === "flow") { const steps = body.split("\n").map((l) => l.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean); return `<div class="box flow">${head}<div class="flow-row">${steps.map((x, i) => `<div class="flow-step"><span>${i + 1}</span>${esc(x)}</div>`).join('<div class="flow-arrow">→</div>')}</div></div>`; }
      if (type === "timeline") { const items = body.split("\n").map((l) => l.replace(/^[-*\s]+/, "").trim()).filter(Boolean).map((l) => { const m = l.match(/^([^:]{1,24}):\s*(.*)$/); return m ? [m[1], m[2]] : ["", l]; }); return `<div class="box timeline">${head}<ol class="tl">${items.map(([k, v]) => `<li><b>${esc(k)}</b><span>${esc(v)}</span></li>`).join("")}</ol></div>`; }
      if (type === "compare") { const [a, b = ""] = body.split(/\n---\n/); return `<div class="box compare">${head}<div class="cmp"><div class="cmp-a"><div class="cmp-l">Before</div>${inner(a)}</div><div class="cmp-b"><div class="cmp-l">After</div>${inner(b)}</div></div></div>`; }
      if (type === "stat") { const [n, what = "", src = ""] = body.split("|").map((x) => x.trim()); return `<div class="box stat"><div class="stat-n">${esc(n)}</div><div class="stat-w">${esc(what)} <span class="stat-s">${esc(src)}</span></div></div>`; }
      if (type === "quote") return `<div class="box quote">${inner(body)}</div>`;
      return `<div class="box ${type}">${head}${inner(body)}</div>`;
    };
    return (md) => {
      const out = []; const re = /^[ \t]*:{3,}[ \t]*([A-Za-z]+)[ \t]*([^\n]*)\r?\n([\s\S]*?)^[ \t]*:{3,}[ \t]*\r?$/gm; let last = 0, m;
      while ((m = re.exec(md))) { if (m.index > last) out.push(parse(md.slice(last, m.index))); out.push(block(m[1].toLowerCase(), m[2].trim(), m[3])); last = re.lastIndex; }
      if (last < md.length) out.push(parse(md.slice(last)));
      return out.join("\n");
    };
  }

  // The book as HTML. Used for the on-screen view, the export file and the sample page (same markup, same book.css).
  function bookHTML({ css = "", by = "", accent = "#7c3aed", md = (t) => t, editable = false, standalone = false, autoprint = false } = {}) {
    const s = state, p = s.pkg, bp = s.blueprint, refs = sourceList(), title = bp.titles[0];
    const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const img = (w, cls) => s.images[w] ? `<figure class="${cls}"><img src="${s.images[w]}" alt="">${editable ? `<button class="reimg" data-w="${w}">Regenerate image</button>` : ""}</figure>` : "";
    const body = `
    <div class="cover${s.images.cover ? " has-img" : ""}" style="--paccent:${esc(accent)}">${s.images.cover ? `<img class="cover-img" src="${s.images.cover}" alt=""><div class="cover-shade"></div>` : ""}<div class="cover-in"><div class="kicker">${esc(s.format.label)}</div><h1>${esc(title)}</h1><h2>${esc(bp.subtitle)}</h2><div class="tag">${esc(p.cover.tagline)}</div>${by ? `<div class="by">By ${esc(by)}</div>` : ""}</div>${editable && s.images.cover ? `<button class="reimg" data-w="cover">Regenerate cover</button>` : ""}</div>
    <div class="body">
      <section class="front"><h2 id="b-intro">Introduction</h2>${md(p.intro)}</section>
      <section class="front"><h2>Contents</h2><ol class="contents">${s.sections.map((x) => `<li>${esc(x.title)}</li>`).join("")}</ol></section>
      ${s.sections.map((x, i) => `<section class="chapter" id="b-${i}">${editable ? `<button class="rewrite" data-i="${i}">Rewrite</button>` : ""}<div class="chnum">${esc(s.format.unit)} ${i + 1} <em>· ${Math.max(1, Math.round(x.body.split(/\s+/).length / 220))} min read</em></div><h2>${esc(x.title)}</h2>${img(i, "hero")}${md(x.body)}</section>`).join("")}
      <section class="chapter"><div class="chnum">Extras</div><h2>Bonuses</h2>${bp.bonuses.map((b) => `<div class="bonus">${esc(b)}</div>`).join("")}</section>
      <section class="chapter" id="b-refs"><div class="chnum">Sources</div><h2>References</h2><ol class="refs">${refs.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a><br>${esc(r.url)}</li>`).join("")}</ol></section>
      <section class="sell" id="b-sell"><div class="chnum">For the seller</div><h2>Store page</h2><p><b>${esc(p.store.headline)}</b><br>${esc(p.store.subheadline)}</p><ul>${p.store.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul><p>${esc(p.store.price_line)}<br><i>${esc(p.store.guarantee)}</i></p>
        <h2>Upsell: ${esc(p.upsell.name)} ($${p.upsell.price})</h2><p>${esc(p.upsell.what)}</p><p>${esc(p.upsell.pitch)}</p>
        <h2>Creator message</h2><p>${esc(p.creator_dm)}</p>
        <h2>Product charter</h2><p><b>Positioning:</b> ${esc(p.charter.positioning)}<br><b>Only we:</b> ${esc(p.charter.usp)}</p><p><b>They already tried:</b></p><ul>${p.charter.tried_before.map((t) => `<li>${esc(t)}</li>`).join("")}</ul><p><b>Objections:</b></p><ul>${p.charter.objections.map((o) => `<li><i>${esc(o.objection)}</i> ${esc(o.answer)}</li>`).join("")}</ul></section>
    </div>`;
    if (!standalone) return body;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet"><style>${css}\nbody{margin:0;background:#f3f1f8}.book{max-width:860px;margin:0 auto}@media print{body{background:#fff}.book{max-width:none;margin:0}}</style></head><body><article class="book" id="book">${body}</article>${autoprint ? `<script>document.fonts.ready.then(function(){setTimeout(function(){window.print();},400);});</script>` : ""}</body></html>`;
  }

  function markdown() {
    const bp = state.blueprint, p = state.pkg;
    const lines = [
      `# ${bp.titles[0]}`, `## ${bp.subtitle}`, `*${p.cover.tagline}*`, "",
      `## Introduction`, p.intro, "",
      `## Contents`, ...state.sections.map((s, i) => `${i + 1}. ${s.title}`), "",
      ...state.sections.flatMap((s, i) => [`## ${i + 1}. ${s.title}`, s.body, ""]),
      `## Bonuses`, ...bp.bonuses.map((b) => `- ${b}`), "",
      `## References`, ...sourceList().map((s) => `${s.n}. ${s.title}: ${s.url}`), "",
      "---", "", `## Store page`, `**${p.store.headline}**`, p.store.subheadline, "", ...p.store.bullets.map((b) => `- ${b}`), "", p.store.price_line, p.store.guarantee, "",
      `## Upsell: ${p.upsell.name} ($${p.upsell.price})`, p.upsell.what, "", p.upsell.pitch, "",
      `## Creator message`, p.creator_dm, "",
      `## Product charter`, `**Positioning:** ${p.charter.positioning}`, `**Only we:** ${p.charter.usp}`, "",
      `**They already tried:**`, ...p.charter.tried_before.map((t) => `- ${t}`), "",
      `**Objections:**`, ...p.charter.objections.map((o) => `- *${o.objection}* ${o.answer}`),
    ];
    return lines.join("\n");
  }

  return { state, cost, sourceList, snapshot, restore, findPockets, blueprint, research, writeSection, rewriteSection, writeAll, packageProduct, planImages, renderImage, illustrate, estimateImages, bookHTML, makeRenderer, markdown };
}
