#!/usr/bin/env python3
"""Löst den CHANGELOG-Konflikt auf, der beim Mergen paralleler Feature-PRs entsteht.

Jeder angereicherte Plan trägt seinen Eintrag unter `## [Unreleased]` ein, also
kollidieren zwei PRs dort zwangsläufig — im Code merged git sauber. Aufruf im
konfliktbehafteten Arbeitsbaum nach `git merge origin/main`:

    python3 tools/resolve_changelog_conflict.py && git add CHANGELOG.md && git commit --no-edit

Behält die Einträge von main und hängt den des Branches an.
"""
import io,re,sys
p='CHANGELOG.md'
s=io.open(p,encoding='utf-8').read()
pat=re.compile(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> origin/main\n', re.S)
n=0
def repl(m):
    global n; n+=1
    ours, theirs = m.group(1), m.group(2)   # ours = branch entry, theirs = main's entries
    return theirs + "\n" + ours + "\n"
s2=pat.sub(repl, s)
assert n==1, f"expected 1 conflict, got {n}"
assert '<<<<<<<' not in s2 and '>>>>>>>' not in s2, "markers remain"
io.open(p,'w',encoding='utf-8').write(s2)
print("resolved", n, "conflict — main's entries first, branch entry appended")
