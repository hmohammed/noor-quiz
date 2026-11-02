# Merge — T011

## git fetch origin
Exit 0. origin fetched.

## git rebase origin/main
First attempt exited 1: unstaged line-ending noise (`core.autocrlf`) made rebase refuse, with an empty `git diff`. Stashed that noise, then rebase exited 0: `Current branch factory/T011-edit-profile is up to date.` Stash dropped. No conflict.
