# Setup

Run `/digitaltechz-setup` and it walks you through all of this. This page is the reference for the parts that happen outside the chat, and for fixing things later.

## 1. Your FreeLLM API key (required)

1. Go to `free-llm-api.com` and create an API key.

## 2. A picture key (optional)

Gemini: sign in at `aistudio.google.com/apikey`, create a key, and turn on billing for its project. Or OpenAI: `platform.openai.com/api-keys` with credit on the account.

## 3. Saving a key by hand

The wizard does this for you. To change one later:

```
FREELLM_API_KEY=paste-it-here python3 "$CLAUDE_PLUGIN_ROOT/scripts/doctor.py" --validate freellm --save
GEMINI_API_KEY=paste-it-here python3 "$CLAUDE_PLUGIN_ROOT/scripts/doctor.py" --validate gemini --save
OPENAI_API_KEY=paste-it-here python3 "$CLAUDE_PLUGIN_ROOT/scripts/doctor.py" --validate openai --save
python3 "$CLAUDE_PLUGIN_ROOT/scripts/doctor.py" --write-env FORGE_NAME="Your Name"
```

A key is only saved when it works. Reload the app's tab afterwards so it picks the new key up.

## 4. GitHub backup (optional)

Install the GitHub CLI from `cli.github.com`, run `gh auth login`, then `python3 "$CLAUDE_PLUGIN_ROOT/scripts/doctor.py" --github create`. It makes a private repo called `digitaltechz-products` and a folder at `~/.society/digitaltechz/products` for your exported books.

## 5. Where things live

| What | Where |
|---|---|
| Your keys | `~/.society/digitaltechz/.env`, readable by your user only |
| Your products | Your browser's storage for `localhost:4790`. Export a copy with the buttons in the book view. |
| The app | The plugin folder. Never edit it; reinstall to update. |

## 6. When something goes wrong

| It says | Do this |
|---|---|
| That key was rejected | Copy it again, the whole thing, no spaces. |
| The connection dropped | Press Continue. Chapters already written are kept. |
| The app did not come up | The port is taken. `/digitaltechz-start` with another port, e.g. `--port 4791`. |
