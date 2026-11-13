"""Builds docs/StockIt-Project-Report.pdf from docs/PROJECT_REPORT.md.

    python docs/build_pdf.py

Needs Python with the `markdown` and `pypdf` packages, and Microsoft Edge
(used headless to print the styled HTML to PDF). The PDF is printed twice:
the first pass finds the page each section starts on, the second fills those
page numbers into the contents page.
"""
import html
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import markdown
from pypdf import PdfReader

DOCS = Path(__file__).resolve().parent
SOURCE = DOCS / 'PROJECT_REPORT.md'
OUTPUT = DOCS / 'StockIt-Project-Report.pdf'
EDGE_CANDIDATES = [
    Path(r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'),
    Path(r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'),
]
LANDSCAPE_FIGURES = {'5-er-database.png'}  # too wide to read on a portrait page
# Largest height for each diagram, chosen so its labels stay readable and it
# shares a page with the text around it instead of leaving a gap.
FIGURE_HEIGHTS = {
    '1-use-case.png': '128mm',
    '2-class.png': '150mm',
    '3-sequence-sales-order.png': '190mm',
    '4-activity-sign-in.png': '175mm',
}

CSS = """
@page { size: A4; margin: 20mm 18mm 18mm 18mm;
  @top-right { content: "StockIt — Project Report"; font: 8pt 'Segoe UI', Arial, sans-serif; color: #7a8a82; }
  @bottom-center { content: counter(page); font: 9pt 'Segoe UI', Arial, sans-serif; color: #55665d; } }
@page :first { margin: 0; @top-right { content: none; } @bottom-center { content: none; } }
@page wide { size: A4 landscape; margin: 14mm 16mm 14mm 16mm; }

* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 10.5pt/1.55 'Segoe UI', Arial, sans-serif; color: #1d2a24; }

/* Cover */
.cover { height: 297mm; padding: 34mm 24mm 26mm; display: flex; flex-direction: column; justify-content: space-between;
  background: #153A33; color: #F5F6F0; break-after: page; }
.cover .kicker { font-size: 10pt; letter-spacing: .28em; text-transform: uppercase; color: #CDEB5C; font-weight: 600; }
.cover h1 { margin: 18mm 0 6mm; font-size: 46pt; line-height: 1; letter-spacing: -.02em; font-weight: 700; }
.cover .subtitle { font-size: 17pt; line-height: 1.35; color: #DCE7DF; max-width: 140mm; }
.cover .mark { width: 16mm; height: 16mm; border-radius: 4mm; background: #CDEB5C; color: #153A33; display: grid; place-items: center; font-weight: 800; font-size: 16pt; }
.cover table.details { border-collapse: collapse; width: 100%; font-size: 11pt; }
.cover table.details td { padding: 3.2mm 0; border-bottom: 1px solid rgba(245,246,240,.25); color: #F5F6F0; background: transparent !important; }
.cover table.details td:first-child { width: 42mm; color: #B9CFC6; }
.cover .stack { font-size: 10pt; color: #B9CFC6; }

/* Contents */
.toc { break-after: page; }
.toc h2 { margin-top: 0; }
.toc ol { list-style: none; padding: 0; margin: 8mm 0 0; }
.toc li { display: flex; align-items: baseline; gap: 3mm; padding: 3mm 0; border-bottom: 1px solid #e3e8e1; font-size: 12pt; }
.toc li .n { width: 8mm; color: #3F6B55; font-weight: 700; }
.toc li .t { flex: 1; }
.toc li .p { color: #55665d; font-variant-numeric: tabular-nums; }
.toc .figs { margin-top: 12mm; }
.toc .figs h3 { font-size: 11pt; color: #3F6B55; text-transform: uppercase; letter-spacing: .12em; }
.toc .figs li { font-size: 10.5pt; padding: 2mm 0; }

/* Body */
h2 { font-size: 17pt; color: #153A33; margin: 9mm 0 3mm; padding-bottom: 2mm; border-bottom: 2px solid #CDEB5C; break-after: avoid; }
h2:first-of-type { margin-top: 0; }
section.chapter + section.chapter h2 { margin-top: 10mm; }
h3 { font-size: 12pt; color: #153A33; margin: 6mm 0 2mm; break-after: avoid; }
p { margin: 0 0 2.6mm; }
p strong:first-child { color: #153A33; }
ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
li { margin: 0 0 1mm; }
code { font: 9pt Consolas, monospace; background: #eef2ea; padding: .2mm 1.2mm; border-radius: 1mm; }

table { width: 100%; border-collapse: collapse; margin: 2mm 0 5mm; font-size: 9.3pt; line-height: 1.4; break-inside: auto; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { background: #153A33; color: #F5F6F0; text-align: left; font-weight: 600; padding: 2.2mm 2.5mm; }
td { padding: 2mm 2.5mm; border-bottom: 1px solid #e1e6de; vertical-align: top; }
tbody tr:nth-child(even) td { background: #f6f8f3; }

figure { margin: 4mm 0 6mm; text-align: center; break-inside: avoid; }
figure img { max-width: 100%; max-height: 205mm; border: 1px solid #e1e6de; border-radius: 2mm; padding: 2mm; background: #fff; }
figcaption { margin-top: 2mm; font-size: 9pt; color: #55665d; }
figcaption b { color: #153A33; }
figure.wide { page: wide; break-before: page; break-after: page; margin: 0; }
figure.wide img { max-height: 165mm; }
"""


def find_edge():
    for candidate in EDGE_CANDIDATES:
        if candidate.exists():
            return candidate
    found = shutil.which('msedge')
    if found:
        return Path(found)
    raise SystemExit('Microsoft Edge was not found; it is needed to print the PDF.')


def body_html(source_text):
    # Drop the Markdown title: the cover page carries it.
    text = re.sub(r'\A# .*\n', '', source_text)
    rendered = markdown.markdown(text, extensions=['tables', 'sane_lists'])

    figures = []

    def figure(match):
        alt, src = match.group(1), match.group(2)
        figures.append(alt)
        number = f'6.{len(figures)}'
        path = (DOCS / src).resolve().as_uri()
        wide = ' wide' if Path(src).name in LANDSCAPE_FIGURES else ''
        height = FIGURE_HEIGHTS.get(Path(src).name)
        style = f' style="max-height:{height}"' if height else ''
        return f'<figure class="figure{wide}"><img src="{path}" alt="{html.escape(alt)}"{style}><figcaption><b>Figure {number}.</b> {html.escape(alt)}</figcaption></figure>'

    # Markdown renders an image on its own line as <p><img alt="..." src="..." /></p>.
    rendered = re.sub(r'<p><img alt="([^"]*)" src="([^"]+)" ?/?></p>', figure, rendered)

    # One <section> per numbered chapter.
    parts = re.split(r'(?=<h2>)', rendered)
    sections = ''.join(f'<section class="chapter">{part}</section>' for part in parts if part.strip())
    chapters = re.findall(r'<h2>(\d+)\. ([^<]+)</h2>', rendered)
    return sections, chapters, figures


def page_html(sections, chapters, figures, pages=None):
    pages = pages or {}
    toc_rows = ''.join(
        f'<li><span class="n">{number}</span><span class="t">{html.escape(html.unescape(title))}</span><span class="p">{pages.get(number, "")}</span></li>'
        for number, title in chapters
    )
    figure_rows = ''.join(
        f'<li><span class="n">6.{index}</span><span class="t">{html.escape(alt)}</span><span class="p">{pages.get(f"fig{index}", "")}</span></li>'
        for index, alt in enumerate(figures, start=1)
    )
    cover = """
<section class="cover">
  <div>
    <div class="mark">S</div>
    <p class="kicker" style="margin-top:14mm">Software Engineering Lab · Project Report</p>
    <h1>StockIt</h1>
    <p class="subtitle">A web-based Inventory Management System for small businesses</p>
  </div>
  <div>
    <table class="details">
      <tr><td>Submitted by</td><td>&nbsp;</td></tr>
      <tr><td>Roll number</td><td>&nbsp;</td></tr>
      <tr><td>Course</td><td>Software Engineering Lab</td></tr>
      <tr><td>Date</td><td>November 2026</td></tr>
      <tr><td>Repository</td><td>github.com/Somasekhar711/IMS</td></tr>
    </table>
    <p class="stack" style="margin-top:8mm">React · Express · Node.js · PostgreSQL · Jest · Selenium · JUnit 5</p>
  </div>
</section>"""
    toc = f"""
<section class="toc">
  <h2>Contents</h2>
  <ol>{toc_rows}</ol>
  <div class="figs"><h3>Figures</h3><ol>{figure_rows}</ol></div>
</section>"""
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>StockIt — Project Report</title><style>{CSS}</style></head><body>{cover}{toc}{sections}</body></html>'


def print_pdf(edge, html_text, workdir, target):
    page = workdir / 'report.html'
    page.write_text(html_text, encoding='utf-8')
    target = Path(target)
    target.unlink(missing_ok=True)
    subprocess.run([
        str(edge), '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--no-first-run',
        f'--user-data-dir={workdir / "profile"}', '--allow-file-access-from-files',
        f'--print-to-pdf={target}', page.as_uri(),
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)  # no pipes: Edge's background process would hold them open

    # On Windows msedge.exe hands the job to a background process and returns
    # at once, so wait until the PDF exists and has stopped growing.
    deadline = time.time() + 90
    last_size = -1
    while time.time() < deadline:
        size = target.stat().st_size if target.exists() else -1
        if size > 0 and size == last_size:
            return
        last_size = size
        time.sleep(1)
    raise SystemExit(f'Edge did not produce {target}')


def locate_pages(pdf_path, chapters, figures):
    texts = [(page.extract_text() or '') for page in PdfReader(str(pdf_path)).pages]
    found = {}
    for number, title in chapters:
        heading = f'{number}. {html.unescape(title)}'.split(' ')[:4]
        for index, text in enumerate(texts[2:], start=3):  # skip cover and contents
            flat = ' '.join(text.split())
            if ' '.join(heading) in flat:
                found[number] = index
                break
    for index, alt in enumerate(figures, start=1):
        label = f'Figure 6.{index}.'
        for page_number, text in enumerate(texts[2:], start=3):
            if label in text:
                found[f'fig{index}'] = page_number
                break
    return found, len(texts)


def main():
    edge = find_edge()
    sections, chapters, figures = body_html(SOURCE.read_text(encoding='utf-8'))
    with tempfile.TemporaryDirectory() as temp:
        workdir = Path(temp)
        draft = workdir / 'draft.pdf'
        print_pdf(edge, page_html(sections, chapters, figures), workdir, draft)
        pages, _ = locate_pages(draft, chapters, figures)
        print_pdf(edge, page_html(sections, chapters, figures, pages), workdir, OUTPUT)
    final_pages, count = locate_pages(OUTPUT, chapters, figures)
    missing = [number for number, _ in chapters if number not in final_pages]
    print(f'Wrote {OUTPUT.name}: {count} pages; sections start on {final_pages}')
    if missing:
        print(f'Warning: could not find the start page of sections {missing}')


if __name__ == '__main__':
    main()
