#!/bin/sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
dir=${HELIX_DIR:-$(cd "$here/../../.." && pwd)/helix}
rev=a714a818a3a4f6dd5aad3b003a78692f90a1703f
if [ ! -d "$dir/.git" ]; then
  git clone --filter=blob:none https://github.com/helix-editor/helix "$dir"
fi
if ! git -C "$dir" cat-file -e "$rev^{commit}" 2>/dev/null; then
  git -C "$dir" fetch --quiet https://github.com/helix-editor/helix "$rev"
fi
[ "$(git -C "$dir" rev-parse HEAD)" = "$rev" ] || git -C "$dir" checkout --quiet "$rev"
cp "$here/oracle.rs" "$dir/helix-term/tests/oracle.rs"
grammars="$dir/runtime/grammars"
case "$(uname)" in Darwin) ext=dylib ;; *) ext=so ;; esac
if [ ! -f "$grammars/markdown.$ext" ] || [ ! -f "$grammars/markdown_inline.$ext" ]; then
  src="$grammars/sources/markdown"
  if [ ! -d "$src/.git" ]; then
    git init -q "$src"
    git -C "$src" fetch -q --depth 1 https://github.com/tree-sitter-grammars/tree-sitter-markdown f969cd3ae3f9fbd4e43205431d0ae286014c05b5
    git -C "$src" checkout -q FETCH_HEAD
  fi
  for name in markdown markdown-inline; do
    out=$(echo "$name" | tr - _)
    cc -shared -fPIC -O2 -I "$src/tree-sitter-$name/src" "$src/tree-sitter-$name/src/parser.c" "$src/tree-sitter-$name/src/scanner.c" -o "$grammars/$out.$ext"
  done
fi
bun "$here/../../languages/build.ts" --out "$here/languages" --native "$grammars" $(cat "$here/languages.txt")
echo "Helix oracle ready in $dir"
