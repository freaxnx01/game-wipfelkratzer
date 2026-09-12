import json
import sys
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:8973"

SEED_STATE = {
    "floors": 10, "rooms": {}, "nuts": 99, "bridge": True, "garden": True,
    "night": False, "cutaway": False, "fulfilled": {}, "wallpaper": {}, "flooring": {},
}

FLOORS = list(range(0, 11)) + ["roof"]

pageerrors = []
failures = []


def check_grid_visibility(page, viewport_label):
    for k in FLOORS:
        print(f"  grid check {viewport_label} floor={k}", flush=True)
        page.evaluate("(k) => window.wipfelkratzer.enterEdit(k)", k)
        page.wait_for_timeout(950)
        result = page.evaluate(
            """(k) => {
                const wk = window.wipfelkratzer;
                const { camera } = wk;
                const parent = wk.parentOf(k);
                const cols = wk.colsOf(k);
                const rows = 2;
                const out = [];
                for (let cell = 0; cell < cols * rows; cell++) {
                    const { x, z } = wk.cellPos(k, cell);
                    const world = new wk.THREE.Vector3(x, 0.2, z);
                    parent.localToWorld(world);
                    const proj = world.clone().project(camera);
                    const sx = (proj.x * 0.5 + 0.5) * innerWidth;
                    const sy = (-proj.y * 0.5 + 0.5) * innerHeight;
                    out.push({ cell, sx, sy });
                }
                return out;
            }""",
            k,
        )
        for r in result:
            if not (0 <= r["sx"] <= page.viewport_size["width"] and 0 <= r["sy"] <= page.viewport_size["height"]):
                failures.append(
                    f"[{viewport_label}] floor={k} cell={r['cell']} OUT OF BOUNDS sx={r['sx']:.1f} sy={r['sy']:.1f}"
                )
        page.evaluate("() => window.wipfelkratzer.exitEdit()")
        page.wait_for_timeout(950)


def check_resize_while_editing(page):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.wait_for_timeout(300)
    page.evaluate("() => window.wipfelkratzer.enterEdit(5)")
    page.wait_for_timeout(1100)
    page.set_viewport_size({"width": 820, "height": 1180})
    page.wait_for_timeout(400)
    result = page.evaluate(
        """() => {
            const wk = window.wipfelkratzer;
            const k = wk.edit.k;
            const { camera } = wk;
            const parent = wk.parentOf(k);
            const cols = wk.colsOf(k);
            const out = [];
            for (let cell = 0; cell < cols * 2; cell++) {
                const { x, z } = wk.cellPos(k, cell);
                const world = new wk.THREE.Vector3(x, 0.2, z);
                parent.localToWorld(world);
                const proj = world.clone().project(camera);
                const sx = (proj.x * 0.5 + 0.5) * innerWidth;
                const sy = (-proj.y * 0.5 + 0.5) * innerHeight;
                out.push({ cell, sx, sy });
            }
            return out;
        }"""
    )
    for r in result:
        if not (0 <= r["sx"] <= 820 and 0 <= r["sy"] <= 1180):
            failures.append(f"[resize-while-editing] cell={r['cell']} OUT OF BOUNDS sx={r['sx']:.1f} sy={r['sy']:.1f}")
    page.evaluate("() => window.wipfelkratzer.exitEdit()")
    page.wait_for_timeout(1100)


def check_real_tap_selects(page):
    page.set_viewport_size({"width": 820, "height": 1180})
    page.wait_for_timeout(300)
    page.evaluate("() => window.wipfelkratzer.enterEdit(3)")
    page.wait_for_timeout(1100)
    added = page.evaluate(
        """() => {
            const wk = window.wipfelkratzer;
            const before = (wk.state.rooms[3] || []).length;
            return before;
        }"""
    )
    page.evaluate(
        """() => {
            const catalogItem = document.querySelector('#catalog .item');
            if (catalogItem) catalogItem.click();
        }"""
    )
    page.wait_for_timeout(300)
    cellinfo = page.evaluate(
        """() => {
            const wk = window.wipfelkratzer;
            const rooms = wk.state.rooms[3] || [];
            const entry = rooms[rooms.length - 1];
            if (!entry) return null;
            const parent = wk.parentOf(3);
            const world = new wk.THREE.Vector3(entry.x, entry.y, entry.z);
            parent.localToWorld(world);
            const proj = world.clone().project(wk.camera);
            const sx = (proj.x * 0.5 + 0.5) * innerWidth;
            const sy = (-proj.y * 0.5 + 0.5) * innerHeight;
            return { sx, sy, id: entry.id };
        }"""
    )
    if not cellinfo:
        failures.append("[real-tap] could not add catalog item to seed a target cell")
    else:
        page.mouse.move(cellinfo["sx"], cellinfo["sy"])
        page.mouse.down()
        page.mouse.up()
        page.wait_for_timeout(300)
        selbar_on = page.evaluate("() => document.getElementById('selbar').classList.contains('on')")
        if not selbar_on:
            failures.append(f"[real-tap] real click at ({cellinfo['sx']:.1f},{cellinfo['sy']:.1f}) did not select item '{cellinfo['id']}'")
    page.evaluate("() => window.wipfelkratzer.exitEdit()")
    page.wait_for_timeout(1100)


def check_save_compat(page):
    v030_state = {
        "floors": 3, "rooms": {"0": [], "1": [], "2": [], "3": []}, "nuts": 5,
        "bridge": False, "garden": False, "night": False, "cutaway": False,
        "fulfilled": {}, "wallpaper": "holz", "flooring": {},
    }
    page.evaluate(
        "(s) => localStorage.setItem('wipfelkratzer-v1', JSON.stringify(s))", v030_state
    )
    page.goto(BASE_URL, wait_until="networkidle")
    page.wait_for_timeout(500)


def main():
    viewport_matrix = [
        ("820x1180", 820, 1180),
        ("400x900", 400, 900),
        ("1024x1024", 1024, 1024),
        ("1280x800", 1280, 800),
        ("1920x1080", 1920, 1080),
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])

        page = browser.new_page()
        page.on("pageerror", lambda exc: pageerrors.append(str(exc)))
        page.goto(BASE_URL, wait_until="networkidle")
        page.evaluate("(s) => localStorage.setItem('wipfelkratzer-v1', JSON.stringify(s))", SEED_STATE)
        page.close()

        for label, w, h in viewport_matrix:
            page = browser.new_page(viewport={"width": w, "height": h})
            page.on("pageerror", lambda exc: pageerrors.append(f"[{label}] {exc}"))
            page.goto(BASE_URL, wait_until="networkidle")
            page.wait_for_timeout(500)
            check_grid_visibility(page, label)
            if w > h:
                page.screenshot(path=f".superpowers/sdd/2026-09-12-issue-17-kamera-hochformat/landscape-{label}.png")
            page.close()

        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda exc: pageerrors.append(f"[resize] {exc}"))
        page.goto(BASE_URL, wait_until="networkidle")
        page.evaluate("(s) => localStorage.setItem('wipfelkratzer-v1', JSON.stringify(s))", SEED_STATE)
        page.reload(wait_until="networkidle")
        check_resize_while_editing(page)
        page.close()

        page = browser.new_page(viewport={"width": 820, "height": 1180})
        page.on("pageerror", lambda exc: pageerrors.append(f"[real-tap] {exc}"))
        page.goto(BASE_URL, wait_until="networkidle")
        page.evaluate("(s) => localStorage.setItem('wipfelkratzer-v1', JSON.stringify(s))", SEED_STATE)
        page.reload(wait_until="networkidle")
        check_real_tap_selects(page)
        page.close()

        page = browser.new_page(viewport={"width": 820, "height": 1180})
        page.on("pageerror", lambda exc: pageerrors.append(f"[save-compat] {exc}"))
        check_save_compat(page)
        page.close()

        browser.close()

    print(f"Total pageerrors: {len(pageerrors)}")
    for e in pageerrors:
        print("  PAGEERROR:", e)
    print(f"Total failures: {len(failures)}")
    for f in failures:
        print("  FAIL:", f)

    if pageerrors or failures:
        sys.exit(1)
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
