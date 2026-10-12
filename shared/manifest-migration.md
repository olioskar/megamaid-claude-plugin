# Shared block: moving a PATTERNS manifest from an earlier install

Run this when `megamaid.py config` printed `notice: PATTERNS manifest at <path> is not read`. The manifest named in the notice comes from the plugin megamaid was forked from; megamaid reads only its own `paths.patterns`.

1. Ask:

   ```
   A PATTERNS manifest from an earlier install is at <path> and is not read.
     (a) Move it to <paths.patterns>
     (b) Copy it to <paths.patterns>
     (c) Skip
   Pick one:
   ```

2. On (a) or (b), run from the project root, with `--move` for (a) or `--copy` for (b):

   ```
   python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" migrate manifest --move
   ```

   Show its one line of output. A non-zero exit prints why (no manifest found, `paths.patterns` disabled, or the target already exists). Show it and go on without the manifest.
3. On (c), go on. The notice repeats on later runs until a manifest exists at `paths.patterns`.
