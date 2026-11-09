---
description: Start digitaltechz on this machine and open it in the browser.
---

Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.py" --start`. If the member named a port, pass `--port <n>` as well.

It answers in one of three ways.

- It prints an address and opens the browser. Repeat the address on its own line and say it keeps running until they run /digitaltechz-stop.
- It says it is already running. Repeat the address and stop.
- It says the app did not come up, and prints the last lines of its log. Read the cause back in one plain sentence. A port already taken means run this again with a different port.
