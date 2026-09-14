#!/usr/bin/env python3
"""Strukturprüfung für angereicherte Spec/Plan-Paare.

Aufruf aus dem Repo-Wurzelverzeichnis:  python3 tools/check_enrich.py

Prüft jedes Paar docs/ai-notes/plans/<datum>-<slug>.md +
docs/ai-notes/specs/<datum>-<slug>-design.md auf das, was die Pipeline und die
Hausregeln verlangen: `### Task N`-Überschriften (daran zählt classify-turns.sh
das Turn-Budget ab), Step-Checkboxen, Acceptance Criteria, Assumptions mit
datei:zeile-Beleg, Consequences, keine Platzhalter, keine Umlaut-\nTransliteration in der Prosa, und dass `run_in_background` nur als Verbot
vorkommt.

`info:`-Zeilen sind Hinweise, keine Fehler — eine Assumption über *neuen* Code
hat zu Recht kein bestehendes Verhalten zu belegen.
"""
import io, re, sys, glob, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
plans = sorted(glob.glob(os.path.join(root, "docs/ai-notes/plans/*.md")))
bad = 0
print(f"{'Plan':<46} {'Tasks':>5} {'AC':>3} {'Asm':>4} {'Cons':>4} {'Steps':>5}  Befund")
for pl in plans:
    base = os.path.basename(pl)[:-3]
    sp = os.path.join(root, f"docs/ai-notes/specs/{base}-design.md")
    p = io.open(pl, encoding="utf-8").read()
    problems = []
    tasks = len(re.findall(r'^### Task \d+:', p, re.M))
    steps = len(re.findall(r'^- \[ \] \*\*Step \d+', p, re.M))
    if tasks == 0: problems.append("KEINE Task-Überschriften")
    if steps == 0: problems.append("keine Step-Checkboxen")
    for pat, msg in [(r'\bTBD\b', "TBD"), (r'analog zu Task', "Rückverweis statt Code"),
                     (r'passende Fehlerbehandlung', "vager Schritt")]:
        if re.search(pat, p, re.I): problems.append(msg)
    # run_in_background darf nur als Verbot vorkommen
    lines = p.splitlines()
    for i, ln in enumerate(lines):
        if 'run_in_background' in ln:
            ctx = ' '.join(lines[max(0, i-2):i+2])
            if not re.search(r'niemals|verbiet|\bnie\b|kein|never|nicht', ctx, re.I):
                problems.append("run_in_background nicht als Verbot")
    if not re.search(r'^\*\*Spec:\*\*', p, re.M): problems.append("Kopf ohne **Spec:**")
    if not re.search(r'^## Global Constraints', p, re.M): problems.append("ohne Global Constraints")
    # Dateinamen und snake_case-Bezeichner gehoeren zu Recht in ASCII.
    prose = '\n'.join(l for l in p.splitlines()
                      if not re.search(r'2026-09-1\d-[\w-]+|docs/ai-notes/|_\w*(ueber|hoeh|staende)', l))
    if re.search(r'\b(ueber|moegl|waer(e|en)|fuer|koenn|muess|groess|hoeh|spaet|zunaech)\w*', prose, re.I):
        problems.append("Umlaut-Transliteration")
    if os.path.exists(sp):
        s = io.open(sp, encoding="utf-8").read()
        ac = len(re.findall(r'^- \[ \]', s, re.M))
        asm = len(re.findall(r'\*\*A\d+\*\*', s))
        cons = 1 if re.search(r'^## Consequences', s, re.M) else 0
        if ac == 0: problems.append("Spec ohne Acceptance Criteria")
        if asm == 0: problems.append("Spec ohne Assumptions")
        if cons == 0: problems.append("Spec ohne Consequences")
        # jede Assumption braucht einen datei:zeile-Beleg
        blks = re.findall(r'\*\*A\d+\*\*.*?(?=\n- \*\*A\d+\*\*|\n## |\Z)', s, re.S)
        unref = sum(1 for b in blks if not re.search(r'[\w/]+\.(js|html|md):\d+', b))
        if blks and unref == len(blks):
            problems.append("KEINE Assumption belegt")
        elif unref:
            problems.append(f"info: {unref}/{len(blks)} Assumptions ohne datei:zeile")
        if re.search(r'version\.js', p) and re.search(r'GAME_VERSION\s*=', p):
            problems.append("PRÜFEN: Plan hebt version.js — das macht der Release")
    else:
        ac = asm = cons = 0
        problems.append("SPEC FEHLT")
    if problems: bad += 1
    print(f"{base:<46} {tasks:>5} {ac:>3} {asm:>4} {cons:>4} {steps:>5}  {'; '.join(problems) if problems else 'ok'}")
print()
print(f"{len(plans)} Paare geprüft, {bad} mit Befund")
sys.exit(1 if bad else 0)
