# Отчёт использует pdfLaTeX исходного шаблона; презентация — XeLaTeX. Нужен Biber.
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    foreach ($document in @('My_practice', 'Presentation')) {
        $texEngine = if ($document -eq 'My_practice') { 'pdflatex' } else { 'xelatex' }
        & $texEngine -interaction=nonstopmode -halt-on-error "$document.tex"
        if ($LASTEXITCODE -ne 0) { throw "Ошибка LaTeX: $document" }
        if ($document -eq 'My_practice') {
            & biber $document
            if ($LASTEXITCODE -ne 0) { throw "Ошибка Biber: $document" }
        }
        1..2 | ForEach-Object {
            & $texEngine -interaction=nonstopmode -halt-on-error "$document.tex"
            if ($LASTEXITCODE -ne 0) { throw "Ошибка LaTeX: $document" }
        }
    }
} finally { Pop-Location }
