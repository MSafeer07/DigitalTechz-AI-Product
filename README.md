# DigitalTechz

Turn what you know into a finished digital product in three clicks. Runs in a browser tab on your own machine, powered by your own AI Omniroute key and Nano Banana (Gemini) image keys.

## Features

- **Three Clicks to Finished Product**: Find a profitable pocket from live web research, design the transformation, then write, illustrate and package an ebook, video course, or coaching offer with sources cited.
- **AI Omniroute Integration**: Runs securely in your browser on your own AI Omniroute API key (`free-stack` model via local proxy `http://localhost:20128`).
- **Nano Banana Illustrations**: Generate stunning cover art and chapter illustrations using your Nano Banana / Gemini image key.
- **Complete Packaging**: Generates cover copy, introduction, store page copy, upsells, creator DMs, and product charter.
- **Export Options**: Export as PDF, Markdown, or HTML. Nothing is stored on a server; your products live in your browser.

## Setup & Quick Start

1. **Prerequisites**: Python 3 and Node.js / browser.
2. **Configure Keys**: Your API keys are stored securely in `~/.society/digitaltechz/.env` or `.env`.
   - `OMNIROUTE_API_KEY`: Your AI Omniroute API key.
   - `GEMINI_API_KEY`: Your Nano Banana (Gemini) image key.
3. **Start the App**:
   ```bash
   python3 scripts/serve.py
   ```
   Then open `http://localhost:4790` in your browser.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude Code <noreply@anthropic.com>
