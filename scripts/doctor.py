#!/usr/bin/env python3
"""Product Forge doctor. The setup wizard talks; this script checks, writes and runs.

  doctor.py --prereqs                     python3 3.9+, a browser, the app files, internet
  doctor.py --status                      what is set up, what is not, whether the app is running
  doctor.py --write-env KEY=VALUE ...     writes/updates ~/.society/product-forge/.env (chmod 600)
  doctor.py --validate VENDOR [--save]    anthropic | gemini | openai: one free read with the key taken
                                          from the environment (VENDOR_ENV=... in front of the command).
                                          --save writes it to .env only when the key works.
  doctor.py --start [--port N]            starts the app in the background and opens it
  doctor.py --stop                        stops it
  doctor.py --smoke                       real round trip: the app serves its page, the keys reach the page
                                          and nothing else, then one tiny Claude call (under a cent)
  doctor.py --github [create]             checks GitHub login; "create" makes a private backup repo for exports
  doctor.py --stamp-version               records the installed plugin version

Exit 0 = fine. Non-zero = the printed line is the fix. Never prints a key.
"""
import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

HOME = os.path.expanduser("~")
ROOT = os.environ.get("CLAUDE_PLUGIN_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOCIETY = os.path.expanduser(os.environ.get("SOCIETY_HOME", "~/.society"))
APP = os.path.join(ROOT, "app")
UA = "product-forge/1.0"
TIMEOUT = 25
DEFAULT_PORT = 4790
LOCAL = "127.0.0.1"
MODEL = "claude-sonnet-5-5"

VENDORS = {
    "freellm": {"env": "FREELLM_API_KEY", "url": "https://api.free-llm-api.com/v1/models",
                  "where": "https://free-llm-api.com", "label": "FreeLLM API key"},
    "gemini": {"env": "GEMINI_API_KEY", "url": "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
               "where": "https://aistudio.google.com/apikey", "label": "Gemini key"},
    "openai": {"env": "OPENAI_API_KEY", "url": "https://api.openai.com/v1/models",
               "where": "https://platform.openai.com/api-keys", "label": "OpenAI key"},
}


def plugin_meta():
    try:
        with open(os.path.join(ROOT, ".claude-plugin", "plugin.json")) as fh:
            return json.load(fh)
    except Exception:  # noqa: BLE001
        return {"name": "digitaltechz", "version": "?"}


def kit_name():
    return plugin_meta().get("name") or "digitaltechz"


def state_dir():
    return os.path.join(SOCIETY, kit_name())


def env_path():
    return os.path.join(state_dir(), ".env")


def pid_path():
    return os.path.join(state_dir(), "server.pid")


def port_path():
    return os.path.join(state_dir(), "server.port")


def log_path():
    d = os.path.join(state_dir(), "logs")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "server.log")


def read_env():
    d = {}
    if os.path.isfile(env_path()):
        with open(env_path()) as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    d[k.strip()] = v.strip().strip('"').strip("'")
    return d


def say(msg):
    print(msg, flush=True)


def secret(vendor):
    name = VENDORS[vendor]["env"]
    return name, (os.environ.get(name) or read_env().get(name) or "").strip()


def auth_headers(vendor, key):
    if vendor == "freellm":
        return {"Authorization": "Bearer " + key}
    if vendor == "gemini":
        return {"x-goog-api-key": key}
    return {"Authorization": "Bearer " + key}


# ---------- http ----------
def http(method, url, headers=None, body=None, timeout=TIMEOUT, raw_body=None):
    h = {"User-Agent": UA, "Accept": "application/json"}
    h.update(headers or {})
    data = raw_body
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:  # noqa: BLE001
        return 0, str(e).encode()


def http_json(method, url, headers=None, body=None, timeout=TIMEOUT, raw_body=None):
    code, raw = http(method, url, headers, body, timeout, raw_body)
    try:
        return code, json.loads(raw.decode("utf-8", "replace"))
    except ValueError:
        return code, {"raw": raw[:200].decode("utf-8", "replace")}


# ---------- prereqs ----------
def chrome_family():
    """Only Chrome-family browsers can share a tab's audio, which is how the app hears the prospect."""
    mac = ["Google Chrome", "Microsoft Edge", "Brave Browser", "Arc", "Chromium"]
    for name in mac:
        for base in ("/Applications", os.path.join(HOME, "Applications")):
            if os.path.isdir(os.path.join(base, name + ".app")):
                return name
    for exe in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"):
        if shutil.which(exe):
            return exe
    return None


def cmd_prereqs():
    ok = True
    if sys.version_info < (3, 9):
        say("python3:   %d.%d is too old. Install Python 3.9 or newer from https://www.python.org/downloads/" % sys.version_info[:2])
        ok = False
    else:
        say("python3:   %d.%d, fine" % sys.version_info[:2])
    say("browser:   %s" % (chrome_family() or "the default browser (any modern browser works)"))
    for f in ("index.html", "forge.js", "book.css"):
        if not os.path.isfile(os.path.join(APP, f)):
            say("app:       %s is missing from the plugin folder. Reinstall the kit." % f)
            ok = False
    if ok:
        say("app:       present")
    code, _ = http("GET", "https://esm.sh/@anthropic-ai/sdk@0.129.0", timeout=10)
    if code == 200:
        say("internet:  fine")
    else:
        say("internet:  cannot reach esm.sh, which serves the app's libraries. Check the connection.")
        ok = False
    return 0 if ok else 1


# ---------- settings ----------
def cmd_write_env(pairs):
    os.makedirs(state_dir(), exist_ok=True)
    cur = read_env()
    for p in pairs:
        if "=" not in p:
            say("expected KEY=VALUE, got something else")
            return 1
        k, v = p.split("=", 1)
        k = k.strip()
        if not re.fullmatch(r"[A-Z][A-Z0-9_]+", k):
            say("bad key name: %s" % k)
            return 1
        cur[k] = v.strip()
    tmp = env_path() + ".tmp"
    with open(tmp, "w") as fh:
        fh.write("# digitaltechz settings. Written by /digitaltechz-setup.\n")
        for k in sorted(cur):
            fh.write('%s="%s"\n' % (k, cur[k].replace('"', "")))
    os.chmod(tmp, 0o600)
    os.replace(tmp, env_path())
    say("saved %d setting(s)" % len(pairs))
    return 0


def check_key(vendor, key):
    code, _ = http_json("GET", VENDORS[vendor]["url"], auth_headers(vendor, key))
    return code


def cmd_validate(vendor, save):
    if vendor not in VENDORS:
        say("unknown vendor. Use one of: %s" % ", ".join(sorted(VENDORS)))
        return 1
    name, key = secret(vendor)
    if not key:
        say("%s is empty. Get one at %s" % (name, VENDORS[vendor]["where"]))
        return 1
    code = check_key(vendor, key)
    if code == 200:
        say("%s works" % VENDORS[vendor]["label"])
        if save:
            return cmd_write_env(["%s=%s" % (name, key)])
        return 0
    if code in (401, 403):
        say("%s was refused. Copy it again from %s, the whole thing, no spaces." % (VENDORS[vendor]["label"], VENDORS[vendor]["where"]))
    elif code == 0:
        say("could not reach the %s service. Check the internet connection and try again." % vendor)
    else:
        say("%s check came back with status %d. Try again in a minute." % (VENDORS[vendor]["label"], code))
    return 1


# ---------- the app ----------
def free_port():
    s = socket.socket()
    s.bind((LOCAL, 0))
    p = s.getsockname()[1]
    s.close()
    return p


def wait_for_server(port, seconds=20):
    deadline = time.time() + seconds
    while time.time() < deadline:
        code, body = http_json("GET", "http://%s:%d/healthz" % (LOCAL, port), timeout=3)
        if code == 200 and body.get("app") == "digitaltechz":
            return True
        time.sleep(0.4)
    return False


def server_pid():
    if not os.path.isfile(pid_path()):
        return None
    try:
        pid = int(open(pid_path()).read().strip())
    except (ValueError, OSError):
        return None
    try:
        os.kill(pid, 0)
        return pid
    except OSError:
        return None


def saved_port():
    try:
        return int(open(port_path()).read().strip())
    except (ValueError, OSError):
        return DEFAULT_PORT


def spawn_server(port, home=None, logfile=None):
    env = dict(os.environ)
    env["SOCIETY_HOME"] = home or SOCIETY
    env["CLAUDE_PLUGIN_ROOT"] = ROOT
    lf = open(logfile or log_path(), "a")
    return subprocess.Popen([sys.executable, os.path.join(ROOT, "scripts", "serve.py"), "--port", str(port)],
                            env=env, cwd=ROOT, stdout=lf, stderr=lf, stdin=subprocess.DEVNULL, start_new_session=True)


def open_in_browser(url):
    if sys.platform != "darwin":
        return
    b = chrome_family()
    if b and b.endswith(("Chrome", "Edge", "Browser", "Arc", "Chromium")):
        subprocess.run(["open", "-a", b, url], check=False)
    else:
        subprocess.run(["open", url], check=False)


def cmd_start(port_arg):
    os.makedirs(state_dir(), exist_ok=True)
    port = int(port_arg) if port_arg else saved_port()
    if server_pid() and wait_for_server(saved_port(), seconds=3):
        say("already running at http://localhost:%d" % saved_port())
        return 0
    proc = spawn_server(port)
    with open(pid_path(), "w") as fh:
        fh.write(str(proc.pid))
    with open(port_path(), "w") as fh:
        fh.write(str(port))
    if not wait_for_server(port):
        say("the app did not come up. The last lines of its log:")
        try:
            say("  " + "\n  ".join(open(log_path()).read().strip().split("\n")[-6:]))
        except OSError:
            pass
        say("Most common cause: that port is taken. Run it again with --port and another number.")
        return 1
    url = "http://localhost:%d" % port
    open_in_browser(url)
    say("digitaltechz is running at %s (it should have opened in your browser)." % url)
    say("It keeps running in the background until you run /digitaltechz-stop, or restart the machine.")
    return 0


def cmd_stop():
    pid = server_pid()
    if not pid:
        say("not running")
        if os.path.isfile(pid_path()):
            os.unlink(pid_path())
        return 0
    try:
        os.kill(pid, 15)
    except OSError:
        pass
    for _ in range(20):
        if not server_pid():
            break
        time.sleep(0.25)
    if os.path.isfile(pid_path()):
        os.unlink(pid_path())
    say("stopped")
    return 0


# ---------- smoke ----------
def cmd_smoke():
    if cmd_prereqs() != 0:
        return 1
    env = read_env()
    if not (os.environ.get("FREELLM_API_KEY") or env.get("FREELLM_API_KEY")):
        say("not set: FREELLM_API_KEY. Run /digitaltechz-setup.")
        return 1
    port = free_port()
    proc = spawn_server(port)
    try:
        if not wait_for_server(port):
            say("smoke: the app did not start. See %s" % log_path())
            return 1
        code, page = http("GET", "http://%s:%d/" % (LOCAL, port))
        if code != 200 or b"digitaltechz" not in page:
            say("smoke: the app page did not load (status %d)" % code)
            return 1
        code, js = http("GET", "http://%s:%d/forge.js" % (LOCAL, port))
        if code != 200 or b"createForge" not in js:
            say("smoke: forge.js did not load (status %d)" % code)
            return 1
        say("smoke: app serves its page")
        host = {"Host": "%s:%d" % (LOCAL, port)}
        code, keys = http_json("GET", "http://%s:%d/kit-keys.json" % (LOCAL, port), dict(host, **{"Sec-Fetch-Site": "same-origin"}))
        if code != 200 or not keys.get("freellmKey"):
            say("smoke: the page did not receive the FreeLLM API key. Run /digitaltechz-setup again.")
            return 1
        code_x, _ = http_json("GET", "http://%s:%d/kit-keys.json" % (LOCAL, port), dict(host, **{"Sec-Fetch-Site": "cross-site"}))
        code_h, _ = http_json("GET", "http://%s:%d/kit-keys.json" % (LOCAL, port), {"Host": "example.test"})
        if code_x != 403 or code_h != 403:
            say("smoke: the keys route answered a request it should have refused. Do not use this build.")
            return 1
        say("smoke: keys reach the app and are refused to everything else")
    finally:
        try:
            proc.terminate()
        except OSError:
            pass
    _, fkey = secret("freellm")
    code, out = http_json("POST", "https://api.free-llm-api.com/v1/chat/completions", auth_headers("freellm", fkey), {
        "model": "default", "messages": [{"role": "user", "content": "Reply with the single word OK."}]})
    text = "".join(b.get("text", "") for b in (out.get("content") or []) if isinstance(b, dict) and b.get("type") == "text")
    if code != 200 or not text.strip():
        msg = (out.get("error") or {}).get("message") if isinstance(out.get("error"), dict) else ""
        say("smoke: Claude did not answer (status %d). %s" % (code, (msg or "")[:160]))
        if code in (401, 403):
            say("       The Claude key was refused. Run /product-forge-setup and paste it again.")
        elif code == 400 and "credit" in (msg or "").lower():
            say("       The Anthropic account has no credit. Add some at https://console.anthropic.com/settings/billing")
        return 1
    say("smoke: Claude answered")
    for v in ("gemini", "openai"):
        _, k = secret(v)
        if k:
            if check_key(v, k) == 200:
                say("smoke: %s works (pictures on)" % VENDORS[v]["label"])
            else:
                say("smoke: %s was refused. Pictures are off until you fix it with /product-forge-setup." % VENDORS[v]["label"])
    say("SMOKE PASSED")
    return 0


def cmd_github(create):
    gh = shutil.which("gh")
    if not gh:
        say("GitHub CLI (gh) is not installed. Optional: install it from https://cli.github.com/ if you want a private backup of your exports.")
        return 1
    r = subprocess.run([gh, "auth", "status"], capture_output=True, text=True)
    if r.returncode != 0:
        say("not logged in to GitHub. Run: gh auth login   (then run this check again)")
        return 1
    say("GitHub: logged in")
    if not create:
        return 0
    folder = os.path.join(state_dir(), "products")
    os.makedirs(folder, exist_ok=True)
    if not os.path.isdir(os.path.join(folder, ".git")):
        subprocess.run(["git", "init", "-q"], cwd=folder, check=False)
        with open(os.path.join(folder, "README.md"), "w") as fh:
            fh.write("# My digitaltechz products\n\nExported books (HTML and Markdown) from digitaltechz. Private.\n")
    r = subprocess.run([gh, "repo", "view", "digitaltechz-products"], capture_output=True, text=True)
    if r.returncode != 0:
        r = subprocess.run([gh, "repo", "create", "digitaltechz-products", "--private", "--source", folder, "--remote", "origin", "--push"], capture_output=True, text=True, cwd=folder)
        if r.returncode != 0:
            say("could not create the repo: %s" % (r.stderr or r.stdout).strip()[:200])
            return 1
        say("created private repo digitaltechz-products. Drop exported books into %s and run: git add -A && git commit -m save && git push" % folder)
    else:
        say("repo digitaltechz-products already exists. Exports folder: %s" % folder)
    return 0


def cmd_stamp_version():
    os.makedirs(state_dir(), exist_ok=True)
    with open(os.path.join(state_dir(), "installed_version"), "w") as fh:
        fh.write(str(plugin_meta().get("version", "?")) + "\n")
    say("installed_version = %s" % plugin_meta().get("version", "?"))
    return 0


def cmd_status():
    env = read_env()
    inst = os.path.join(state_dir(), "installed_version")
    say("plugin version:      %s" % plugin_meta().get("version", "?"))
    say("installed version:   %s" % (open(inst).read().strip() if os.path.isfile(inst) else "not set up yet"))
    say("settings folder:     %s" % state_dir())
    say("FreeLLM key:         %s" % ("saved" if env.get("FREELLM_API_KEY") else "not set (required)"))
    say("Gemini key:          %s" % ("saved" if env.get("GEMINI_API_KEY") else "not set (optional, pictures)"))
    say("OpenAI key:          %s" % ("saved" if env.get("OPENAI_API_KEY") else "not set (optional, pictures)"))
    say("name on covers:      %s" % (env.get("FORGE_NAME") or "not set"))
    port = saved_port()
    live = server_pid() and wait_for_server(port, seconds=2)
    say("app:                 %s" % ("running at http://localhost:%d" % port if live else "not running (start it with /digitaltechz-start)"))
    return 0


def main(argv):
    ap = argparse.ArgumentParser(description="Product Forge doctor")
    ap.add_argument("--prereqs", action="store_true")
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--write-env", nargs="+")
    ap.add_argument("--validate")
    ap.add_argument("--save", action="store_true")
    ap.add_argument("--start", action="store_true")
    ap.add_argument("--port")
    ap = argparse.ArgumentParser(description="digitaltechz doctor")
