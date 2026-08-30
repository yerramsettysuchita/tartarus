# publish-patient-zero.ps1
# ---------------------------------------------------------------------------
# Copies examples/Tartarus-Patient-Zero OUT of this repo into a sibling folder
# and initializes it as its own standalone git repository, so it can live as a
# separate public GitHub repo and act as a realistic remote scan target.
#
# Run from the Tartarus project root:
#   powershell -ExecutionPolicy Bypass -File scripts/publish-patient-zero.ps1
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'

$src  = Join-Path $PSScriptRoot '..\examples\Tartarus-Patient-Zero'
$dest = Join-Path $PSScriptRoot '..\..\Tartarus-Patient-Zero'

if (Test-Path $dest) {
  Write-Host "[X] $dest already exists. Remove it or pick another location." -ForegroundColor Red
  exit 1
}

Write-Host "-> Copying Patient-Zero to $dest" -ForegroundColor Green
Copy-Item -Recurse $src $dest

# Never carry build artifacts / installed deps into the new repo.
foreach ($junk in 'node_modules','patient-zero.db','patient-zero.db-shm','patient-zero.db-wal','package-lock.json') {
  $p = Join-Path $dest $junk
  if (Test-Path $p) { Remove-Item -Recurse -Force $p }
}

Push-Location $dest
git init -q
git add -A
git commit -q -m "Tartarus-Patient-Zero: intentionally vulnerable demo target"
git branch -M main
Pop-Location

Write-Host ""
Write-Host "[OK] Standalone repo ready at $dest" -ForegroundColor Green
Write-Host ""
Write-Host "Next: create an EMPTY public GitHub repo named 'Tartarus-Patient-Zero', then run:" -ForegroundColor Yellow
Write-Host "  cd $dest"
Write-Host "  git remote add origin https://github.com/<YOUR_USERNAME>/Tartarus-Patient-Zero.git"
Write-Host "  git push -u origin main"
Write-Host ""
Write-Host "Then set TARGET_REPO=<YOUR_USERNAME>/Tartarus-Patient-Zero in the Tartarus .env" -ForegroundColor Yellow
