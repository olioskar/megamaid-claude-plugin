#!/usr/bin/env python3
"""Migration from the plugin megamaid was forked from: notices, config translation, manifest move/copy.

Every name of the earlier plugin lives in this file, so the rest of megamaid never names it
(check-contract's old-name guard exempts this file and scripts/fixtures/migrate/). Loaded by
scripts/megamaid.py by file path; not run on its own. Stdlib only.

  notices(home, project_root, new_patterns) -> list of `notice:` lines for `megamaid.py config`
  read_old_config(dir) -> dict                  the earlier config at <dir>/.claude, or MigrateError
  translate(old, defaults) -> (new, dropped)    the spec's rule order: agents, effort, models, the rest
  move_manifest(home, project_root, new_patterns, mode) -> "moved|copied <src> -> <dst>"
"""
import json
import os
import shutil

OLD_CONFIG = "comb.config.json"
NEW_CONFIG = "megamaid.config.json"
OLD_MANIFEST = "docs/combs/PATTERNS.md"
OLD_TYPE = "comb:"
NEW_TYPE = "megamaid:"
RENAMED_LANES = {"the_desert": "vacu_suck"}
EMPTY = object()


class MigrateError(Exception):
    pass


def real(path):
    return os.path.realpath(path)


def real_parent(path):
    """path with its directory resolved but not the file itself, so a symlinked manifest stays the link."""
    return os.path.join(real(os.path.dirname(path)), os.path.basename(path))


def layer_dirs(home, project_root):
    """[home, project] realpaths; one entry when they are the same directory."""
    h, r = real(home), real(project_root)
    return [r] if h == r else [h, r]


def read_json(path):
    if not os.path.exists(path):
        raise MigrateError("%s: missing" % path)
    try:
        with open(path, encoding="utf-8-sig") as f:
            data = json.load(f)
    except json.JSONDecodeError as ex:
        raise MigrateError("invalid JSON in %s: %s" % (path, ex.msg))
    except UnicodeDecodeError:
        raise MigrateError("invalid JSON in %s: not UTF-8 text" % path)
    except OSError as ex:
        raise MigrateError("%s: %s" % (path, ex.strerror))
    if not isinstance(data, dict):
        raise MigrateError("%s: top level is not an object" % path)
    return data


def read_old_config(directory):
    return read_json(os.path.join(directory, ".claude", OLD_CONFIG))


def old_manifest(home, project_root):
    """Realpath of the earlier plugin's manifest, or None when its paths.patterns is null or not a string.

    Same result as deep-merging the earlier config layers over the default, for this one key:
    an object `paths` overrides `patterns` when present; null or a non-object replaces all of `paths`.
    Unreadable layers are skipped (the notice path must never fail `config`)."""
    value = OLD_MANIFEST
    for d in layer_dirs(home, project_root):
        try:
            layer = read_old_config(d)
        except MigrateError:
            continue
        if "paths" not in layer:
            continue
        p = layer["paths"]
        if isinstance(p, dict):
            if "patterns" in p:
                value = p["patterns"]
        else:
            value = None
    if not isinstance(value, str):
        return None
    return real_parent(os.path.join(project_root, value))


def new_manifest(project_root, new_patterns):
    if not isinstance(new_patterns, str):
        return None
    return real(os.path.join(project_root, new_patterns))


def notices(home, project_root, new_patterns):
    out = []
    for d in layer_dirs(home, project_root):
        old = os.path.join(d, ".claude", OLD_CONFIG)
        if os.path.exists(old) and not os.path.exists(os.path.join(d, ".claude", NEW_CONFIG)):
            out.append("notice: %s is not read; run /megamaid:configure to migrate it" % real(old))
    src, dst = old_manifest(home, project_root), new_manifest(project_root, new_patterns)
    if src and os.path.isfile(src) and dst and not os.path.exists(dst):
        out.append("notice: PATTERNS manifest at %s is not read; run /megamaid:configure to move or copy it" % src)
    return out


def keep(value, schema, path, dropped):
    """value filtered to the dotted paths that exist in schema. A leaf on either side is copied as is;
    an object left empty by dropping returns EMPTY (omitted by the caller)."""
    if not isinstance(value, dict) or not isinstance(schema, dict):
        return value
    out = {}
    for k, v in value.items():
        if k in schema:
            r = keep(v, schema[k], path + [k], dropped)
            if r is not EMPTY:
                out[k] = r
        else:
            dropped.append(".".join(path + [k]))
    return out if out or not value else EMPTY


def retype(entry):
    if isinstance(entry, dict) and isinstance(entry.get("subagent_type"), str) \
            and entry["subagent_type"].startswith(OLD_TYPE):
        entry = dict(entry)
        entry["subagent_type"] = NEW_TYPE + entry["subagent_type"][len(OLD_TYPE):]
    return entry


def translate(old, defaults):
    """A non-object `effort` is dropped (megamaid has no `effort` default to keep it against); a
    non-object `models` is copied as is (defaults has `models`, and a leaf on either side is copied)."""
    new, dropped = {}, []
    for k, v in old.items():
        if k == "agents":
            r = {role: retype(e) for role, e in v.items()} if isinstance(v, dict) else v
        elif k in ("models", "effort"):
            if not isinstance(v, dict) and k == "effort":
                dropped.append(k)
                continue
            if isinstance(v, dict):
                v = {RENAMED_LANES.get(lane, lane): x for lane, x in v.items()}
            r = keep(v, defaults.get("models"), [k], dropped)
        elif k in defaults:
            r = keep(v, defaults[k], [k], dropped)
        else:
            dropped.append(k)
            continue
        if r is not EMPTY:
            new[k] = r
    return new, dropped


def move_manifest(home, project_root, new_patterns, mode):
    src = old_manifest(home, project_root)
    if not src or not os.path.isfile(src):
        raise MigrateError("no PATTERNS manifest from an earlier install")
    dst = new_manifest(project_root, new_patterns)
    if not dst:
        raise MigrateError("paths.patterns is disabled")
    if os.path.exists(dst):
        raise MigrateError("%s exists; not overwritten" % dst)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if mode == "move":
        if os.path.islink(src):
            # Copy what the link points to, then drop the link: the shared file stays where it is.
            shutil.copy2(src, dst)
            os.unlink(src)
        else:
            shutil.move(src, dst)
        return "moved %s -> %s" % (src, dst)
    shutil.copy2(src, dst)
    return "copied %s -> %s" % (src, dst)
