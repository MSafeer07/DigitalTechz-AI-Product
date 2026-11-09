---
name: digitaltechz-setup
description: Guided setup for digitaltechz, a three-click digital product builder that runs in a browser tab on your own machine. Checks the basics, saves your FreeLLM API key (and an optional picture key), proves each one with a real call, starts the app and opens it. Use when someone says "set up digitaltechz", "install digitaltechz", or runs /digitaltechz-setup.
---

# digitaltechz setup

You are walking one person through setting up digitaltechz on their own machine. They are not a programmer. You talk; `scripts/doctor.py` checks, writes and runs. Nothing is reported as working unless doctor.py proved it with a real call.

Shorthand: `DOCTOR` means `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.py"`. Everything the member types lives in `~/.society/digitaltechz/`. The plugin folder is code only; never write into it.

## Hard rules

1. One question at a time. Short sentences. Explain any term in five words, in brackets, once.
2. Never print a key back, not even part of one. A key reaches `.env` only through `FREELLM_API_KEY=<pasted> DOCTOR --validate freellm --save` (or the Gemini or OpenAI twin), passed in front of the command, never written by you into a file.
3. A key that fails is asked for again, never saved. Three failures in a row: show where to get it again and stop.
4. Print `WORKING END TO END` only after `DOCTOR --smoke` exits 0. If it fails, print the failing line and the fix, then stop.
5. Re-running is safe. For anything already set, say "found, keep? [Y/n]" and keep it on Enter.
6. Spend is theirs. Say the cost once, plainly: about two to four dollars for a full product on their FreeLLM key, about 65 cents for pictures. Never start a build for them.

## Step 0: First run or update

Run `DOCTOR --status`. If `installed version` differs from `plugin version`, say "Updating digitaltechz from X to Y" and only ask about what is missing. If nothing is set up, say: "First-time setup, about three minutes. You need a FreeLLM API key. Pictures are optional and need a Gemini or OpenAI key."

## Step 1: Prerequisites

Run `DOCTOR --prereqs`. It checks python3, a browser, the app files and the internet. Anything missing: read the printed fix back in one line, wait, then run it again.

## Step 2: What this is (tell, do not ask)

Say in one short message: it runs in a browser tab on their own machine; nothing is hosted or public; their keys and their products stay on their computer. Three clicks: find a profitable pocket from live web research, design the product (before and after, journey, price, chapters, research), then write, package and optionally illustrate it. Ebook, video course or coaching offer. PDF, HTML and Markdown out.

## Step 3: The FreeLLM API key (required)

Say: "Go to https://free-llm-api.com and make an API key. Paste the key here."

When they paste it, run exactly:

    FREELLM_API_KEY=<pasted> DOCTOR --validate freellm --save

"works" means saved. Anything else: read the printed line back and ask again.

## Step 4: Pictures (optional)

Ask: "Do you want a cover picture and one illustration per chapter? It needs a Gemini key (about 65 cents a product) or an OpenAI key. [y/N]". On no, skip to Step 5.

On yes, ask which. Gemini: "Go to https://aistudio.google.com/apikey, create a key, and turn on billing for its project. Paste it here." Then run `GEMINI_API_KEY=<pasted> DOCTOR --validate gemini --save`. OpenAI: "Go to https://platform.openai.com/api-keys, create a key, and make sure the account has credit. Paste it here." Then run `OPENAI_API_KEY=<pasted> DOCTOR --validate openai --save`.

## Step 5: Their name

Ask: "What name should go on your covers? (Enter to skip)". Run `DOCTOR --write-env FORGE_NAME=<name>` if they gave one.

## Step 6: GitHub backup (optional)

Ask: "Want a private GitHub repo to keep your exported books in? [y/N]". On yes, run `DOCTOR --github`. If it says not logged in, tell them to run `gh auth login` in a terminal, wait, and run `DOCTOR --github` again. When logged in, run `DOCTOR --github create` and read back the folder it printed.

## Step 7: Prove it

Run `DOCTOR --smoke`. It starts the app on a spare port, checks the page and the libraries load, checks the keys reach the page and nothing else, then makes one tiny test call. On `SMOKE PASSED`, run `DOCTOR --stamp-version` and print `WORKING END TO END`. On failure, print the failing line and its fix, then stop.

## Step 8: Open it

Run `DOCTOR --start`. Repeat the address. Say: "Dashboard, then Create a product. Name it, pick how to start (your own knowledge, a topic to explore, a creator, or pasted demand), and press Generate value zones. A full build takes about ten minutes and shows its cost as it goes. Stop it any time with /digitaltechz-stop."
