<#
  auto-update.ps1 - Met a jour le depot depuis origin/main SEULEMENT si le distant a bouge.
  - Ne fait RIEN si aucune modification (deja a jour).
  - Ne touche a rien si des modifications locales non commitees existent (securite).
  - N'avance qu'en fast-forward (aucun reset destructif).
  - Rebuild le front (et npm install si les dependances ont change), puis redemarre PM2 si dispo.
  Planifie toutes les 2h (voir scripts/install-auto-update.ps1).
#>
$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$logDir = Join-Path $repo 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir 'auto-update.log'
function Log($m) { "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m | Tee-Object -FilePath $log -Append }

git fetch origin main
if ($LASTEXITCODE -ne 0) { Log "ERREUR : git fetch a echoue (reseau ?)."; exit 1 }

$local  = (git rev-parse HEAD).Trim()
$remote = (git rev-parse origin/main).Trim()
$base   = (git merge-base HEAD origin/main).Trim()

if ($local -eq $remote) { Log "Aucune modification (deja a jour)."; exit 0 }

$dirty = git status --porcelain
if ($dirty) { Log "SKIP : modifications locales non commitees presentes (pull non effectue)."; exit 0 }
if ($base -ne $local) { Log "SKIP : historique divergent (local en avance ou conflit)."; exit 0 }

Log ("Mise a jour : {0} -> {1}" -f $local.Substring(0,7), $remote.Substring(0,7))
$changed = git diff --name-only $local $remote
$nChanged = ($changed | Measure-Object).Count
git merge --ff-only origin/main
if ($LASTEXITCODE -ne 0) { Log "ERREUR : le fast-forward a echoue."; exit 1 }

if ($changed -match 'package(-lock)?\.json') { Log "Dependances modifiees -> npm install"; npm install --no-audit --no-fund | Out-Null }

Log "Build du front (npm run build)..."
npm run build | Out-Null
if ($LASTEXITCODE -ne 0) { Log "ERREUR : le build a echoue."; exit 1 }

# Redemarrage PM2 (necessaire si code serveur modifie ; le front est deja servi apres build).
if ($changed -match '^server/') {
  $pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
  if ($pm2) { pm2 restart webcms | Out-Null; Log "PM2 redemarre (webcms)." }
  else { Log "Code serveur modifie mais PM2 introuvable : lancer manuellement 'pm2 restart webcms'." }
}

Log ("OK : mis a jour ({0} fichier(s)) et rebuild." -f $nChanged)
