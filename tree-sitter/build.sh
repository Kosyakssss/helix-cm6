#!/bin/sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
ts_rev=v0.26.9
md_rev=f969cd3ae3f9fbd4e43205431d0ae286014c05b5
WASI_SDK_PATH=$(sh "$here/sdk.sh")
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -c advice.detachedHead=false clone -q --depth 1 --branch "$ts_rev" https://github.com/tree-sitter/tree-sitter "$tmp/ts"
git init -q "$tmp/md"
git -C "$tmp/md" fetch -q --depth 1 https://github.com/tree-sitter-grammars/tree-sitter-markdown "$md_rev"
git -C "$tmp/md" checkout -q FETCH_HEAD
cp "$here/binding.c" "$tmp/binding.c"
cd "$tmp"
cc="$WASI_SDK_PATH/bin/clang --target=wasm32-wasip1 -O2 -DNDEBUG -ffile-prefix-map=$tmp=."
$cc -c -I ts/lib/include -I ts/lib/src ts/lib/src/lib.c -o lib.o
$cc -c -I ts/lib/include binding.c -o binding.o
for name in markdown markdown-inline; do
  $cc -c -I "md/tree-sitter-$name/src" "md/tree-sitter-$name/src/parser.c" -o "$name-parser.o"
  $cc -c -I "md/tree-sitter-$name/src" "md/tree-sitter-$name/src/scanner.c" -o "$name-scanner.o"
done
exports=$(tr -d '"\n' < ts/lib/src/wasm/stdlib-symbols.txt | tr ',' '\n' | sed '/^$/d; s/^/-Wl,--export=/' | tr '\n' ' ')
$cc -mexec-model=reactor -Wl,--strip-all -Wl,--export-table -Wl,--growable-table -Wl,--export=__stack_pointer $exports lib.o binding.o markdown-parser.o markdown-scanner.o markdown-inline-parser.o markdown-inline-scanner.o -o tree-sitter.wasm
cp tree-sitter.wasm "$here/tree-sitter.wasm"
