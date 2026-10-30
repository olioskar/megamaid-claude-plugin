#!/usr/bin/env python3
"""The fix round's mechanical steps: `megamaid.py fix <cmd>` (skills/fix/SKILL.md calls them).

Loaded by scripts/megamaid.py by file path; not run on its own. Stdlib only. Every input a
command acts on comes on the call; no command reads an earlier verdict. The state file,
`.megamaid/fix/<folder slug>.json` under the repo root, holds only the run baseline and, with
commits off, the finished items' snapshots. The CLI contract is megamaid.py's docstring.

  find_git() -> str            first runnable git (PATH, then /opt/homebrew/bin, /usr/local/bin)
  repo_root(git) -> str        git's top level; exit 2 outside a repository
  run(a, ctx)                  dispatch a `fix` subcommand; ctx: cfg, write_sets, state_dir, slugify, git, root
"""
import json
import os
import re
import shutil
import subprocess
import sys

FALLBACK_GITS = ("/opt/homebrew/bin/git", "/usr/local/bin/git")
FAILING = re.compile(r"(?i)\b(fail|failed|failing|error|not ok)\b")


def die(msg, code=2):
    sys.stdout.flush()
    sys.stderr.write("megamaid.py: %s\n" % msg)
    sys.exit(code)


# --------------------------------------------------------------------- git

def find_git():
    """`MEGAMAID_GIT_CANDIDATES` (colon-separated, tests only) replaces the two fallback paths."""
    env = os.environ.get("MEGAMAID_GIT_CANDIDATES")
    fallbacks = env.split(":") if env is not None else list(FALLBACK_GITS)
    tried = ["git"] + fallbacks
    on_path = shutil.which("git")
    for cand in ([on_path] if on_path else []) + fallbacks:
        try:
            if subprocess.run([cand, "--version"], capture_output=True, timeout=20).returncode == 0:
                return cand
        except (OSError, subprocess.SubprocessError):
            continue
    die("no runnable git (tried: %s)" % ", ".join(tried))


def git_run(git, root, *args, check=True):
    p = subprocess.run([git, "-C", root] + list(args), capture_output=True, text=True)
    if check and p.returncode != 0:
        die("git %s: %s" % (" ".join(args), (p.stderr.strip().splitlines() or ["exited %d" % p.returncode])[0]))
    return p


def repo_root(git):
    p = subprocess.run([git, "rev-parse", "--show-toplevel"], capture_output=True, text=True)
    if p.returncode != 0:
        die("not inside a git repository (the fix commands need one): %s" % p.stderr.strip())
    return os.path.realpath(p.stdout.strip())


def head(git, root):
    return git_run(git, root, "rev-parse", "HEAD").stdout.strip()


def dirty(git, root):
    """Repo-relative paths `git status` reports, untracked files listed one by one; a rename gives both."""
    out = git_run(git, root, "status", "--porcelain=v1", "-z", "-uall").stdout
    parts, paths, i = out.split("\0"), set(), 0
    while i < len(parts):
        e = parts[i]
        i += 1
        if len(e) < 4:
            continue
        paths.add(e[3:])
        if e[0] in "RC":
            paths.add(parts[i])
            i += 1
    return sorted(paths)


# ------------------------------------------------------------------- paths

def under(path, prefixes):
    for p in prefixes:
        p = p.rstrip("/")
        if path == p or path.startswith(p + "/"):
            return True
    return False


def rel(root, path):
    """A path given on the command line (cwd-relative or absolute) as a repo-relative one."""
    full = os.path.realpath(path)
    r = os.path.relpath(full, root)
    if r == ".." or r.startswith("../"):
        die("%s is outside the repository %s" % (path, root))
    return r


def own_paths(root, folder, cfg):
    """The run's own paths: the instruction folder and paths.reviews, repo-relative."""
    own = [folder]
    paths = cfg.get("paths")
    reviews = paths.get("reviews") if isinstance(paths, dict) else None
    if isinstance(reviews, str) and reviews:
        r = os.path.relpath(os.path.realpath(os.path.join(root, reviews)), root)
        if not (r == ".." or r.startswith("../")):
            own.append(r)
    return own


def meets(paths, ws):
    """Paths among `paths` inside the write-set `ws` (a directory entry covers everything under it)."""
    return [p for p in paths if under(p, ws)]


# ------------------------------------------------------------------- state

def state_path(ctx, folder):
    return os.path.join(ctx["state_dir"]("fix", ctx["root"]), "%s.json" % ctx["slugify"](folder))


def load_state(ctx, folder):
    p = state_path(ctx, folder)
    try:
        with open(p, encoding="utf-8") as f:
            st = json.load(f)
    except (OSError, ValueError):
        st = None
    if not isinstance(st, dict) or st.get("folder") != folder:
        die("no fix state for %s; run megamaid.py fix start first" % folder)
    return st


def save_state(ctx, folder, st):
    p = state_path(ctx, folder)
    with open(p + ".tmp", "w", encoding="utf-8") as f:
        json.dump(st, f, indent=1, sort_keys=True)
        f.write("\n")
    os.replace(p + ".tmp", p)


def failing_lines(output, exit_code):
    """Exit 0 is green, whatever the output. Otherwise the lines that look like failures, or every
    non-empty line when none does."""
    if exit_code == 0:
        return []
    lines = [l.rstrip() for l in output.splitlines() if l.strip()]
    hits = [l for l in lines if FAILING.search(l) or l.lstrip().startswith("✗")]
    return hits or lines


def run_verify(root, cmd):
    p = subprocess.run(cmd, shell=True, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                       text=True, errors="replace")
    return {"cmd": cmd, "exit": p.returncode, "failing": failing_lines(p.stdout, p.returncode)}


def write_set(ctx, folder, code):
    ws = ctx["write_sets"](os.path.join(ctx["root"], folder))
    if code not in ws:
        die("no instruction for %s in %s" % (code, folder))
    return ws[code]


def in_flight_paths(ctx, folder, codes):
    out = []
    for c in codes or []:
        out += write_set(ctx, folder, c)
    return out


def baseline_d0(ctx, folder, st, extra=()):
    """The dirty tree minus the run's own paths, the finished paths and `extra` (in-flight write-sets)."""
    skip = own_paths(ctx["root"], folder, ctx["cfg"]) + list(st.get("finished", {})) + list(extra)
    return [p for p in dirty(ctx["git"], ctx["root"]) if not under(p, skip)]


def print_head_d0(st):
    print("head: %s" % st["head"])
    print("d0: %s" % (" ".join(st["d0"]) if st["d0"] else "none"))


# ---------------------------------------------------------------- commands

def cmd_preflight(a, ctx, folder):
    own = own_paths(ctx["root"], folder, ctx["cfg"])
    left = [p for p in dirty(ctx["git"], ctx["root"]) if not under(p, own)]
    if not left:
        print("preflight: clean")
    for p in left:
        print("dirty %s" % p)


def cmd_start(a, ctx, folder):
    verify = None if a.verify == "none" else run_verify(ctx["root"], a.verify)
    st = {"folder": folder, "head": head(ctx["git"], ctx["root"]), "commits": a.commits,
          "verify": verify, "finished": {}}
    st["d0"] = baseline_d0(ctx, folder, st)
    save_state(ctx, folder, st)
    print_head_d0(st)
    if verify is None:
        print("verification: none configured")
    elif verify["exit"] == 0:
        print("verification: green")
    else:
        print("verification: red (%d failing lines)" % len(verify["failing"]))
    print("commits: %s" % a.commits)
    for code, ws in ctx["write_sets"](os.path.join(ctx["root"], folder)).items():
        hit = meets(st["d0"], ws)
        if hit:
            print("not-dispatched %s: %s" % (code, " ".join(hit)))


def cmd_gate(a, ctx, folder):
    st = load_state(ctx, folder)
    hit = meets(st["d0"], write_set(ctx, folder, a.code))
    print("gate %s: %s" % (a.code, "not-dispatched — %s" % " ".join(hit) if hit else "ok"))


def cmd_resync(a, ctx, folder):
    st = load_state(ctx, folder)
    st["head"] = head(ctx["git"], ctx["root"])
    st["d0"] = baseline_d0(ctx, folder, st, in_flight_paths(ctx, folder, a.in_flight))
    save_state(ctx, folder, st)
    print_head_d0(st)


COMMANDS = {"preflight": cmd_preflight, "start": cmd_start, "gate": cmd_gate, "resync": cmd_resync}


def run(a, ctx):
    folder = rel(ctx["root"], a.folder)
    if not os.path.isdir(os.path.join(ctx["root"], folder)):
        die("--folder %s: no such directory" % a.folder)
    COMMANDS[a.fix_cmd](a, ctx, folder)
