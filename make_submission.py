"""Упаковка актуальных материалов без зависимостей и старых шаблонов."""
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
files = [ROOT / name for name in [
    "README.md", "My_practice.tex", "My_practice.pdf", "Presentation.tex",
    "Presentation.pdf", "build.ps1", "make_submission.py",
]]
files += [p for p in (ROOT / "report").rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.name not in {"body.tex", "methods.tex", "console.tex", "conclusion.tex", "slide-conclusion.tex", "slide-time-conclusion.tex"}]
# Исходный шаблон нужен для самостоятельной сборки My_practice.
files += [p for p in (ROOT / "template_settings").rglob("*") if p.is_file() and p.suffix in {".tex", ".clo", ".ist", ".bib"}]
files += [ROOT / "my_folder" / name for name in [
    "my_settings.tex", "practice.tex", "contents.tex", "introduction.tex",
    "chapter1.tex", "chapter2.tex", "chapter3.tex", "chapter4.tex",
    "conclusion.tex", "references.tex", "my_biblio.bib", "appendix1.tex", "appendix2.tex",
]]
app = ROOT / "benchmark_app"
for name in ["src", "tests", "data", "scripts"]:
    files += [p for p in (app / name).rglob("*") if p.is_file()]
files += [p for p in app.iterdir() if p.is_file() and p.suffix in {".py", ".json", ".txt", ".cjs", ".mjs"}]
for name in ["npm-2026-09-17", "mutations"]:
    files += [p for p in (app / "reports" / name).rglob("*") if p.is_file()]
output = ROOT / "submission.zip"
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for p in sorted(set(files)):
        archive.write(p, p.relative_to(ROOT).as_posix())
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    print(f"{output.name}: {len(archive.namelist())} файлов, {output.stat().st_size:,} байт; CRC проверен")

with zipfile.ZipFile(ROOT / "benchmark-code.zip", "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    archive.write(ROOT / "README.md", "README.md")
    for p in sorted(set(files)):
        if app in p.parents:
            archive.write(p, p.relative_to(ROOT).as_posix())
with zipfile.ZipFile(ROOT / "benchmark-code.zip") as archive:
    assert archive.testzip() is None
    print("Архив программы проверен:", len(archive.namelist()), "файлов")

