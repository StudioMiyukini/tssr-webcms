<#
  install-publication-hors-ligne.ps1 - Enregistre la tache planifiee
  "TSSR-WebCMS-PublicationHorsLigne" : publier-hors-ligne.ps1 chaque jour a 8h.

  L'heure est celle de la machine, reglee sur Paris (Romance Standard Time) —
  le declencheur suit donc l'heure d'ete sans rien avoir a changer.

  A executer UNE FOIS, sous le compte qui heberge le site.
  Desinstaller : Unregister-ScheduledTask -TaskName 'TSSR-WebCMS-PublicationHorsLigne' -Confirm:$false
#>
$script  = Join-Path $PSScriptRoot 'publier-hors-ligne.ps1'
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $script)
$trigger = New-ScheduledTaskTrigger -Daily -At 8am
# StartWhenAvailable : si le poste dormait a 8h, la publication se fait au reveil.
$set     = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName 'TSSR-WebCMS-PublicationHorsLigne' -Action $action -Trigger $trigger -Settings $set -Description 'Construit les archives du site hors-ligne et les depose sur la release GitHub (chaque jour a 8h).' -Force | Out-Null

$t = Get-ScheduledTask -TaskName 'TSSR-WebCMS-PublicationHorsLigne'
Write-Host ("Tache '{0}' enregistree - prochaine execution : {1}" -f $t.TaskName, (Get-ScheduledTaskInfo $t).NextRunTime)
