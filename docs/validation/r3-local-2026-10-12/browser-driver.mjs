import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

const outDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-TW', timezoneId: 'Asia/Taipei' });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const page = await context.newPage();
const logs = [];
const record = (type, data) => logs.push({ at: new Date().toISOString(), type, ...data });
page.on('console', m => record('console', { level: m.type(), text: m.text(), location: m.location() }));
page.on('pageerror', e => record('pageerror', { message: e.message, stack: e.stack }));
page.on('requestfailed', r => record('requestfailed', { url: r.url(), failure: r.failure(), resourceType: r.resourceType() }));
page.on('response', r => { if (r.status() >= 400) record('http-error', { url: r.url(), status: r.status() }); });
const actions = [];
const flush = async () => {
  await fs.writeFile(path.join(outDir, 'console.json'), JSON.stringify(logs, null, 2));
  await fs.writeFile(path.join(outDir, 'actions.json'), JSON.stringify(actions, null, 2));
};
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(outDir, '01-home.png'), fullPage: true });
console.log(JSON.stringify({ ready: true, browser: browser.version(), url: page.url(), text: await page.locator('body').innerText() }));
await flush();
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  if (!line.trim()) continue;
  let task;
  try {
    task = JSON.parse(line);
    const started = new Date().toISOString();
    const result = await new Function('page', 'context', 'browser', 'fs', 'path', 'outDir', `return (async () => { ${task.code} })();`)(page, context, browser, fs, path, outDir);
    if (task.shot) await page.screenshot({ path: path.join(outDir, task.shot), fullPage: true });
    const text = task.snapshot === false ? undefined : await page.locator('body').innerText();
    actions.push({ started, finished: new Date().toISOString(), ...task, result, text });
    await flush();
    console.log(JSON.stringify({ ok: true, id: task.id, result, text }));
    if (task.close) { await context.tracing.stop({ path: path.join(outDir, 'trace.zip') }); await browser.close(); break; }
  } catch (e) {
    actions.push({ at: new Date().toISOString(), ...task, error: String(e), stack: e.stack });
    await flush();
    console.log(JSON.stringify({ ok: false, id: task?.id, error: String(e) }));
  }
}
