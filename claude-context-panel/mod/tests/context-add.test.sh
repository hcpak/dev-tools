#!/usr/bin/env bash
# Checks of bin/context-add against a throwaway HOME: bash plugins/context-pane/tests/context-add.test.sh
set -uo pipefail
cli="$(cd "$(dirname "$0")/.." && pwd)/bin/context-add"
export HOME; HOME=$(mktemp -d); export CLAUDE_CODE_SESSION_ID=test-session
file="$HOME/.claude/tasks/test-session/.panel-context"
fail=0
check() { if [[ "$2" -eq 0 ]]; then echo "PASS $1"; else echo "FAIL $1"; fail=1; fi; }
archived() { cut -f2- "$file.archive" 2>/dev/null; }

"$cli" --todo "보고서 보내기" >/dev/null
"$cli" --add "초안 https://x.test/1" >/dev/null
"$cli" --done "보고서" >/dev/null
archived | grep -qx $'완료\ttodo: 보고서 보내기'; check "--done keeps the finished todo in the archive, marked 완료" $?
"$cli" --rm 1 >/dev/null
archived | grep -qx $'삭제\t초안 https://x.test/1'; check "--rm keeps the removed line in the archive, marked 삭제" $?
[[ ! -s "$file" ]]; check "both lines left the panel" $?
cut -f1 "$file.archive" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$'; check "each archive line starts with its time" $?

CONTEXT_TODO_MAX=1 "$cli" --todo a >/dev/null; CONTEXT_TODO_MAX=1 "$cli" --todo b >/dev/null
archived | grep -qx $'밀려남\ttodo: a'; check "a line pushed out by the cap is marked 밀려남" $?

"$cli" --done "없는 것" >/dev/null 2>&1
[[ $(wc -l < "$file.archive") -eq 3 ]]; check "a refused removal archives nothing" $?

# Two removals at once (two quick presses, a hook and the person) must not lose a line:
# every line is either still in the panel or in the archive, never both, never neither.
lost=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
    rm -f "$file" "$file.archive"
    for t in aaa bbb ccc; do "$cli" --todo "$t" >/dev/null; done
    "$cli" --done 1 >/dev/null 2>&1 & "$cli" --done 2 >/dev/null 2>&1 & wait
    left=$(sed 's/^todo: //' "$file"); gone=$(cut -f3 "$file.archive" | sed 's/^todo: //')
    all=$(printf '%s\n%s\n' "$left" "$gone" | sed '/^$/d' | sort | tr '\n' ' ')
    [[ "$all" == "aaa bbb ccc " ]] || lost=$((lost + 1))
done
[[ $lost -eq 0 ]]; check "two removals at once lose nothing ($lost of 10 runs did)" $?

rm -rf "$HOME"
exit $fail
