<#
  publier-hors-ligne.ps1 - Construit les archives du site hors-ligne et les
  depose sur la release GitHub, puis journalise. Lance chaque jour a 8h (heure
  de Paris) par la tache "TSSR-WebCMS-PublicationHorsLigne".

  A la main : powershell -ExecutionPolicy Bypass -File scripts\publier-hors-ligne.ps1
  Forcer un depot meme sans changement : ... -File ... -Force
  Journal : logs\publication-hors-ligne.log
#>
param([switch]$Force)

$racine = Split-Path $PSScriptRoot -Parent
$journal = Join-Path $racine 'logs\publication-hors-ligne.log'
New-Item -ItemType Directory -Force -Path (Split-Path $journal) | Out-Null

function Log($m) {
  $ligne = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  Add-Content -Path $journal -Value $ligne -Encoding utf8
  Write-Host $ligne
}

Set-Location $racine
Log "--- Publication du site hors-ligne ---"

$args = @('tsx', 'scripts/publier-hors-ligne.mts')
if ($Force) { $args += '--force' }

# npx tsx : le meme runtime que le serveur, pas de build intermediaire a maintenir.
$sortie = & npx @args 2>&1
$code = $LASTEXITCODE
foreach ($ligne in $sortie) { Log $ligne }

if ($code -eq 0) { Log "OK." } else { Log "ECHEC (code $code)." }
exit $code
