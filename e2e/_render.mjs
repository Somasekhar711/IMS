import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Builder, By, until } from 'selenium-webdriver';
import edge from 'selenium-webdriver/edge.js';

const dir = path.resolve('../docs/diagrams');
const driver = await new Builder().forBrowser('MicrosoftEdge').setEdgeOptions(new edge.Options().addArguments('--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', '--window-size=2000,2400', '--allow-file-access-from-files')).build();
try {
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.mmd')).sort()) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff"><div id="wrap" style="display:inline-block;padding:24px;background:#fff"><pre class="mermaid">${source.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre></div>
<script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs';
mermaid.initialize({ startOnLoad: false, theme: 'base', themeVariables: { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '15px', primaryColor: '#EEF3E2', primaryBorderColor: '#3F6B55', primaryTextColor: '#14251F', lineColor: '#3F6B55', secondaryColor: '#F5F6F0', tertiaryColor: '#FBFBF8', actorBkg: '#EEF3E2', actorBorder: '#3F6B55', noteBkgColor: '#FFF8D6' }, flowchart: { useMaxWidth: false, nodeSpacing: 28, rankSpacing: 70 }, sequence: { useMaxWidth: false }, class: { useMaxWidth: false }, er: { useMaxWidth: false } });
try { await mermaid.run(); document.body.dataset.done = 'ok'; } catch (e) { document.body.dataset.done = 'error: ' + e.message; }
</script>`;
    const page = path.join(dir, '_page.html');
    fs.writeFileSync(page, html);
    await driver.get(pathToFileURL(page).href);
    await driver.wait(async () => (await driver.executeScript('return document.body.dataset.done')) != null, 30000, 'mermaid did not finish');
    const status = await driver.executeScript('return document.body.dataset.done');
    const wrap = await driver.findElement(By.id('wrap'));
    const rect = await wrap.getRect();
    await driver.manage().window().setRect({ width: Math.ceil(rect.width) + 60, height: Math.ceil(rect.height) + 160 });
    fs.writeFileSync(path.join(dir, file.replace('.mmd', '.png')), await (await driver.findElement(By.id('wrap'))).takeScreenshot(), 'base64');
    console.log(file, status, Math.round(rect.width), 'x', Math.round(rect.height));
    fs.rmSync(page);
  }
} finally {
  await driver.quit();
}
