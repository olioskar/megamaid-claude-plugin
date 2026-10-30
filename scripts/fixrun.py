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
    """An item's write-set; `M1+M2` (a Step 3 group, one implementer pass) is the union of its members'."""
    ws = ctx["write_sets"](os.path.join(ctx["root"], folder))
    out = []
    for c in code.split("+"):
        if c not in ws:
            die("no instruction for %s in %s" % (c, folder))
        out += [p for p in ws[c] if p not in out]
    return out


def in_flight_paths(ctx, folder, codes):
    out = []
    for c in codes or []:
        out += write_set(ctx, folder, c)
    return out


def baseline_d0(ctx, folder, st, extra=()):
    """The dirty tree minus the run's own paths, the finished paths and `extra` (in-flight write-sets)."""
    skip = own_paths(ctx["root"], folder, ctx["cfg"]) + list(st.get("finished", {})) + list(extra)
    return [p for p in dirty(ctx["git"], ctx["root"]) if not under(p, skip)]


def reported_paths(root, paths):
    """Reported files as repo-relative paths (an implementer reports them from the repo root)."""
    out = []
    for p in paths or []:
        r = os.path.relpath(p, root) if os.path.isabs(p) else os.path.normpath(p)
        if r not in out:
            out.append(r)
    return out


def blob_of(git, root, path, write=False):
    """The path's content as a git blob id, or "absent"; `write` stores the object in .git/objects."""
    if not os.path.isfile(os.path.join(root, path)):
        return "absent"
    return git_run(git, root, "hash-object", *(["-w"] if write else []), "--", path).stdout.strip()


def changed(git, root, st, prefixes):
    """Paths under `prefixes` that differ from HEAD, or for a finished path (commits off) from its snapshot."""
    fin = st.get("finished", {})
    out = {p for p in dirty(git, root) if under(p, prefixes) and p not in fin}
    out |= {p for p, b in fin.items() if under(p, prefixes) and blob_of(git, root, p) != b}
    return out


def allowed(ctx, folder, st, code, flight):
    """The allowed set: D0, the run's own paths, the finished paths, C's and the in-flight write-sets."""
    return (list(st["d0"]) + own_paths(ctx["root"], folder, ctx["cfg"]) + list(st.get("finished", {}))
            + write_set(ctx, folder, code) + in_flight_paths(ctx, folder, flight))


def at_head(git, root, path):
    return git_run(git, root, "cat-file", "-e", "HEAD:%s" % path, check=False).returncode == 0


def restore(git, root, st, path):
    """Put a path back as its snapshot (a finished path, commits off) or HEAD has it: written or checked out
    when present there, deleted when absent. → restored|deleted|None."""
    snap = st.get("finished", {}).get(path)
    if snap and snap != "absent":
        data = subprocess.run([git, "-C", root, "cat-file", "blob", snap], capture_output=True)
        if data.returncode != 0:
            die("git cat-file blob %s: the snapshot of %s is gone" % (snap, path))
        full = os.path.join(root, path)
        os.makedirs(os.path.dirname(full) or root, exist_ok=True)
        with open(full, "wb") as f:
            f.write(data.stdout)
        return "restored"
    if snap is None and at_head(git, root, path):
        git_run(git, root, "checkout", "HEAD", "--", path)
        return "restored"
    full = os.path.join(root, path)
    git_run(git, root, "rm", "-q", "--cached", "--ignore-unmatch", "--", path)
    if os.path.lexists(full) and not os.path.isdir(full):
        os.remove(full)
        return "deleted"
    return None


def instruction_file(root, folder, code):
    d = os.path.join(root, folder)
    for n in sorted(os.listdir(d)):
        if n.endswith(".md") and (n.startswith(code + "-") or n == code + ".md"):
            return os.path.join(d, n)
    die("no instruction for %s in %s" % (code, folder))


def record_attempt(path, reviewer, plan_change):
    """Append `### Attempt <n> — FAIL` under `## Attempts` (created on the first); returns n."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    n = len(re.findall(r"^### Attempt \d+", text, re.M)) + 1
    add = "" if text.endswith("\n") else "\n"
    if not re.search(r"^## Attempts[ \t]*$", text, re.M):
        add += "\n## Attempts\n"
    add += "\n### Attempt %d — FAIL\n**Reviewer:** %s\n**Plan change:** %s\n" % (n, reviewer.strip(), plan_change.strip() or "none")
    with open(path, "a", encoding="utf-8") as f:
        f.write(add)
    return n


def named_paths(root, line):
    """Path-like tokens in an output line, repo-relative (`:12` line parts fall away with the token rule)."""
    out = []
    for tok in re.findall(r"[\w./@+-]+", line):
        if "/" not in tok and not re.search(r"\.[A-Za-z]{1,5}$", tok):
            continue
        tok = os.path.relpath(tok, root) if os.path.isabs(tok) else os.path.normpath(tok)
        out.append(tok)
    return out


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


def cmd_check(a, ctx, folder):
    st = load_state(ctx, folder)
    git, root = ctx["git"], ctx["root"]
    flight = [c for c in a.in_flight if c != a.code]
    ws = write_set(ctx, folder, a.code)
    rep_ = reported_paths(root, a.reported)
    fails = []  # (strength, why): 2 stop-batch, 1 stop-item
    now = head(git, root)
    if now != st["head"]:
        fails.append((2, "HEAD moved during implementer (%s → %s)" % (st["head"], now)))
    inside = [p for p in rep_ if under(p, ws)]
    got = changed(git, root, st, ws)
    missed = sorted(got - set(inside))
    if missed:
        fails.append((1, "%s changed but not reported" % " ".join(missed)))
    stale = [p for p in inside if p not in got]
    if stale:
        fails.append((1, "%s reported but unchanged" % " ".join(stale)))
    mates = in_flight_paths(ctx, folder, flight)
    for p in rep_:
        if p not in inside:
            fails.append((2 if under(p, mates) else 1, "%s reported outside ## Where" % p))
    ok = allowed(ctx, folder, st, a.code, flight)
    out = [p for p in dirty(git, root) if not under(p, ok)]
    if out:
        fails.append((2, "%s changed outside every in-flight write-set (%s)"
                      % (" ".join(out), " ".join([a.code] + flight))))
    if not fails:
        print("check %s: ok" % a.code)
        return
    first = max(fails, key=lambda f: f[0])
    print("check %s: %s — %s" % (a.code, "stop-batch" if first[0] == 2 else "stop-item", first[1]))
    for f in fails:
        if f is not first:
            print("reason %s" % f[1])


def cmd_revert(a, ctx, folder):
    st = load_state(ctx, folder)
    git, root = ctx["git"], ctx["root"]
    try:
        with open(a.reviewer_file, encoding="utf-8", errors="replace") as f:
            reviewer = f.read()
    except OSError as ex:
        die("%s: %s" % (a.reviewer_file, ex.strerror))
    ws = write_set(ctx, folder, a.code)
    mates = {c: write_set(ctx, folder, c) for c in a.in_flight if c != a.code}
    for p in reported_paths(root, a.reported):
        owner = next((c for c, w in mates.items() if under(p, w)), None)
        if owner:
            print("skipped %s — in %s's write-set" % (p, owner))
            continue
        done = restore(git, root, st, p)
        if done:
            print("%s %s" % (done, p))
    n = [record_attempt(instruction_file(root, folder, c), reviewer, a.plan_change) for c in a.code.split("+")]
    print("attempt %d recorded" % max(n))
    left = sorted(changed(git, root, st, ws))
    print("revert %s: %s" % (a.code, "dirty — %s" % " ".join(left) if left else "clean"))


def cmd_verify(a, ctx, folder):
    st = load_state(ctx, folder)
    base = st.get("verify")
    if base is None:
        print("verify: none configured")
        return
    now = run_verify(ctx["root"], base["cmd"])
    if now["exit"] == 0:
        print("verify: green")
        return
    new = [l for l in now["failing"] if l not in base["failing"]]
    if not new:
        print("verify: red before the run (unchanged)")
        return
    sets = {c: write_set(ctx, folder, c) for c in a.waiting + a.reviewing}
    failed = []
    for line in new:
        hit = [c for c, ws in sets.items() if any(under(p, ws) for p in named_paths(ctx["root"], line))]
        for c in hit or a.waiting:
            if c not in failed:
                failed.append(c)
    order = [c for c in a.waiting + a.reviewing if c in failed]
    print("verify: fail %s (exit %d) — %s" % (" ".join(order) or "none", now["exit"], new[0]))
    for line in new[1:]:
        print("line %s" % line)


def commit_message(code, title):
    if code.startswith("revise-"):
        return "revise %s: apply review revisions" % code[len("revise-"):]
    return "%s: %s" % (code, title)


def cmd_commit(a, ctx, folder):
    st = load_state(ctx, folder)
    git, root = ctx["git"], ctx["root"]
    paths = reported_paths(root, a.reported)
    if not paths:
        print("commit %s: skipped (no changes)" % a.code)
        return
    if st["commits"] == "off":
        for p in paths:
            st["finished"][p] = blob_of(git, root, p, write=True)
        save_state(ctx, folder, st)
        print("commit %s: skipped (commits off)" % a.code)
        return
    for args in (["add", "-A", "--"] + paths, ["commit", "-q", "-m", commit_message(a.code, a.title), "--"] + paths):
        p = git_run(git, root, *args, check=False)
        if p.returncode != 0:
            lines = [l for l in p.stderr.splitlines() if l.strip()]
            print("commit %s: failed — %s" % (a.code, lines[0].strip() if lines else "git %s exited %d" % (args[0], p.returncode)))
            return
    st["head"] = head(git, root)
    save_state(ctx, folder, st)
    print("commit %s: %s" % (a.code, st["head"]))
    flight = [c for c in a.in_flight if c != a.code]
    ok = list(st["d0"]) + own_paths(root, folder, ctx["cfg"]) + list(st["finished"]) + in_flight_paths(ctx, folder, flight)
    left = [p for p in dirty(git, root) if not under(p, ok)]
    if left:
        print("commit %s: tree not clean — %s" % (a.code, " ".join(left)))


COMMANDS = {"commit": cmd_commit, "verify": cmd_verify, "revert": cmd_revert, "check": cmd_check, "preflight": cmd_preflight, "start": cmd_start, "gate": cmd_gate, "resync": cmd_resync}


def run(a, ctx):
    folder = rel(ctx["root"], a.folder)
    if not os.path.isdir(os.path.join(ctx["root"], folder)):
        die("--folder %s: no such directory" % a.folder)
    COMMANDS[a.fix_cmd](a, ctx, folder)
