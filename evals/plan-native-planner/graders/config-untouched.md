---
type: regex
pattern: "JSON\\.parse\\(fs\\.readFileSync\\(path, 'utf8'\\)\\)"
target: { source: file, path: src/config.js }
match: contains
---
