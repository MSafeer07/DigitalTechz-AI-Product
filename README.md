# digitaltechz

Turn what you know into a finished digital product in three clicks. Runs in a browser tab on your own machine, on your own FreeLLM API key.

Nothing is hosted. Nothing is public. Your keys and your products stay on your computer.

## What you get

| Part | What it does |
|---|---|
| Click 1: Value zone | Searches the web for what people already pay for around your topic and returns five profitable pockets, each scored out of 25 on the CLEAR test (Longevity, Effort, Autonomy, Recurring, Competition), with the buyer's own words and real links. Start from your own knowledge, a topic, a creator's audience, or pasted demand. |
| Click 2: Blueprint | The before and after, a four-stage journey, a price, the chapters, and 15 to 20 research questions answered from real sources. Everything is editable before it writes. |
| Click 3: Build | Writes every chapter from designed blocks (key takeaways, step cards, flows, timelines, before and after, stats, examples, warnings, checklists) with sources cited, then the cover, introduction, store page, upsell, creator message and product charter. |
| Three formats | Ebook (chapters with worksheets), Video course (a script per lesson with on-screen points and a task), Coaching offer (a week-by-week programme). |
| Pictures | Optional. A cover and one illustration per chapter in one consistent style, on your own Gemini key (Nano Banana) or OpenAI key (GPT Image 2). |
| Book view | Read it, rewrite any chapter, regenerate any picture. Download PDF, export a standalone HTML file with the pictures inside, or copy Markdown into Notion. |
| Dashboard | Every product saved in your browser, with words written, sources read and spend. |

## What it costs (on your keys)

About two dollars for a full product on FreeLLM, about four on higher-tier models. Pictures about 65 cents for a cover and ten chapters on Gemini Flash. The spend meter shows it live.

## Install

Unzip the download somewhere you will keep it. Then paste this into Claude Code, using the real path to where you put it:

```
/plugin marketplace add ~/product-forge-system
/plugin install digitaltechz@ais-product-forge
/digitaltechz-setup
```

Setup takes about three minutes: your FreeLLM API key, an optional picture key, your name for the covers, an optional private GitHub backup, then a real test call. It prints WORKING END TO END only when everything passes, and opens the app.

## Every day

`/digitaltechz-start`   Start it and open the browser.

`/digitaltechz-status`   What is set up, and is it running.

`/digitaltechz-stop`   Stop it. Your products stay saved.

## Without Claude Code

Copy `.env.example` to `~/.society/digitaltechz/.env`, fill in the keys, then run `python3 scripts/serve.py` and open http://localhost:4790.

## The tools it runs on

FreeLLM API for research and writing. Google Gemini or OpenAI for pictures, optional.

Created by safeer.
