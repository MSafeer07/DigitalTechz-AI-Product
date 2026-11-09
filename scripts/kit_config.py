"""Runtime config loader shipped inside every Society kit.

Reads ~/.society/<kit>/config.json and ~/.society/<kit>/.env once, then
answers dotted lookups. A missing key raises a clear error that names the
setup command, so nothing ever runs half-configured with a silent None.

    from kit_config import CFG
    list_id = CFG["clickup.list_id"]
    token   = CFG.env("CLICKUP_API_TOKEN")
"""
import json
import os

_MISSING = object()


class KitConfigError(RuntimeError):
    pass


def _detect_kit():
    if os.environ.get("SOCIETY_KIT"):
        return os.environ["SOCIETY_KIT"]
    roots = []
    if os.environ.get("CLAUDE_PLUGIN_ROOT"):
        roots.append(os.environ["CLAUDE_PLUGIN_ROOT"])
    here = os.path.dirname(os.path.abspath(__file__))
    for _ in range(5):
        roots.append(here)
        here = os.path.dirname(here)
    for r in roots:
        p = os.path.join(r, ".claude-plugin", "plugin.json")
        if os.path.isfile(p):
            try:
                with open(p) as fh:
                    name = json.load(fh).get("name")
                if name:
                    return name
            except (OSError, ValueError):
                pass
    raise KitConfigError("cannot tell which kit this is: set SOCIETY_KIT or run from inside the plugin")


class _Cfg(object):
    def __init__(self, kit=None):
        self._kit = kit
        self._data = None
        self._env = None

    @property
    def kit(self):
        if self._kit is None:
            self._kit = _detect_kit()
        return self._kit

    @property
    def home(self):
        return os.path.expanduser(os.environ.get("SOCIETY_HOME", "~/.society"))

    @property
    def dir(self):
        return os.path.join(self.home, self.kit)

    def _load(self):
        if self._data is not None:
            return
        cfg_path = os.path.join(self.dir, "config.json")
        if not os.path.isfile(cfg_path):
            raise KitConfigError("no config found at %s. Run /%s-setup first." % (cfg_path, self.kit))
        try:
            with open(cfg_path) as fh:
                self._data = json.load(fh)
        except ValueError as e:
            raise KitConfigError("config.json is not valid JSON (%s). Run /%s-setup to rewrite it." % (e, self.kit))
        self._env = {}
        env_path = os.path.join(self.dir, ".env")
        if os.path.isfile(env_path):
            with open(env_path, errors="replace") as fh:
                for line in fh:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    self._env[k.strip()] = v.strip().strip('"').strip("'")

    def get(self, path, default=_MISSING):
        self._load()
        node = self._data
        for part in path.split("."):
            if isinstance(node, dict) and part in node:
                node = node[part]
            else:
                if default is not _MISSING:
                    return default
                raise KitConfigError("config key '%s' is missing. Run /%s-setup." % (path, self.kit))
        if node in ("", None) or (isinstance(node, str) and node.startswith("{{")):
            if default is not _MISSING:
                return default
            raise KitConfigError("config key '%s' is not filled in. Run /%s-setup." % (path, self.kit))
        return node

    def __getitem__(self, path):
        return self.get(path)

    def env(self, name, default=_MISSING):
        self._load()
        val = os.environ.get(name) or self._env.get(name)
        if not val:
            if default is not _MISSING:
                return default
            raise KitConfigError("%s is not set. Run /%s-setup and paste the key when asked." % (name, self.kit))
        return val

    def state_dir(self):
        p = os.path.join(self.dir, "state")
        os.makedirs(p, exist_ok=True)
        return p

    def log_dir(self):
        p = os.path.join(self.dir, "logs")
        os.makedirs(p, exist_ok=True)
        return p


CFG = _Cfg()
