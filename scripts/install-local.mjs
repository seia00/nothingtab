/* Runs the built page on this Mac as a login item, at http://127.0.0.1:8124/,
   so nothing between Safari and the page touches the network.

     npm run install-local     build, copy, (re)start — also how you update it
     npm run uninstall-local   stop it and remove everything this added

   The copy lives in ~/Library/Application Support/nothingtab rather than the
   project folder: macOS keeps background programs out of Desktop, Documents
   and Downloads, so a login item reading from there would be refused. */

import { cp, mkdir, rm, rename, writeFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir, userInfo } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LABEL = "com.nothingtab.local";
const PORT = 8124;
const HOME = homedir();
const APP_DIR = join(HOME, "Library/Application Support/nothingtab");
const PLIST = join(HOME, "Library/LaunchAgents", `${LABEL}.plist`);
const LOG = join(HOME, "Library/Logs/nothingtab.log");
const DOMAIN = `gui/${userInfo().uid}`;
const SERVICE = `${DOMAIN}/${LABEL}`;
const PAGE = `http://127.0.0.1:${PORT}/`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const escapeXml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function plist() {
  const args = [process.execPath, join(APP_DIR, "dev-server.mjs"), "--dir", "dist", "--port", String(PORT)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args.map((a) => `    <string>${escapeXml(a)}</string>`).join("\n")}
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(APP_DIR)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${escapeXml(LOG)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(LOG)}</string>
</dict>
</plist>
`;
}

/** launchctl that reports failure instead of throwing. */
async function launchctl(...args) {
  try {
    const { stdout } = await exec("launchctl", args);
    return { ok: true, out: stdout };
  } catch (err) {
    return { ok: false, out: `${err.stderr || err.message}`.trim() };
  }
}

const isLoaded = async () => (await launchctl("print", SERVICE)).ok;

async function copyApp() {
  await access(join(ROOT, "dist/index.html")).catch(() => fail("No build in dist/ — run npm run build first."));
  await mkdir(join(APP_DIR, "api"), { recursive: true });
  await Promise.all([
    cp(join(ROOT, "dev-server.mjs"), join(APP_DIR, "dev-server.mjs")),
    cp(join(ROOT, "api/suggest.js"), join(APP_DIR, "api/suggest.js")),
    cp(join(ROOT, "vercel.json"), join(APP_DIR, "vercel.json")),
    writeFile(join(APP_DIR, "package.json"), `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`),
  ]);

  // The page goes in beside the live one and is swapped in with renames, so a
  // tab opened mid-update never gets half of one build and half of another.
  const live = join(APP_DIR, "dist");
  const next = join(APP_DIR, "dist.next");
  const old = join(APP_DIR, "dist.old");
  await rm(next, { recursive: true, force: true });
  await rm(old, { recursive: true, force: true });
  await cp(join(ROOT, "dist"), next, { recursive: true });
  await rename(live, old).catch(() => { /* first install: nothing live yet */ });
  await rename(next, live);
  await rm(old, { recursive: true, force: true });
}

async function start() {
  if (await isLoaded()) {
    await launchctl("bootout", SERVICE);
    for (let i = 0; i < 20 && (await isLoaded()); i++) await sleep(150);
  }
  for (let attempt = 1; ; attempt++) {
    const res = await launchctl("bootstrap", DOMAIN, PLIST);
    if (res.ok) return;
    if (attempt === 4) fail(`launchctl bootstrap failed: ${res.out}`);
    await sleep(400);
  }
}

async function verify() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(PAGE, { cache: "no-store" });
      const html = await res.text();
      if (res.ok && /src="\/app-[\w-]+\.js"/.test(html)) return;
    } catch {
      /* not listening yet */
    }
    await sleep(200);
  }
  fail(`Nothing answered at ${PAGE}. See ${LOG}`);
}

async function install() {
  await copyApp();
  await mkdir(dirname(PLIST), { recursive: true });
  await mkdir(dirname(LOG), { recursive: true });
  await writeFile(PLIST, plist());
  await start();
  await verify();
  const pid = (await launchctl("print", SERVICE)).out.match(/\bpid = (\d+)/)?.[1];
  console.log(`✓ nothingtab is running at ${PAGE}${pid ? ` (pid ${pid})` : ""}`);
  console.log(`  page      ${join(APP_DIR, "dist")}`);
  console.log(`  login     ${PLIST}`);
  console.log(`  log       ${LOG}`);
}

async function uninstall() {
  if (await isLoaded()) await launchctl("bootout", SERVICE);
  await rm(PLIST, { force: true });
  await rm(APP_DIR, { recursive: true, force: true });
  await rm(LOG, { force: true });
  console.log("✓ nothingtab login item stopped and removed");
}

if (process.platform !== "darwin") fail("This sets up a macOS login item, so it only runs on a Mac.");

(process.argv.includes("--uninstall") ? uninstall() : install()).catch((err) => fail(err.message || String(err)));
