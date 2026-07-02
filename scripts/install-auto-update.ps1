<#
  install-auto-update.ps1 - Enregistre la tache planifiee "TSSR-WebCMS-AutoUpdate"
  qui lance auto-update.ps1 toutes les 2 heures (pull git + rebuild si le distant a bouge).
  A executer UNE FOIS, sous le compte qui heberge le site.
  Desinstaller : Unregister-ScheduledTask -TaskName 'TSSR-WebCMS-AutoUpdate' -Confirm:$false
#>
$script  = Join-Path $PSScriptRoot 'auto-update.ps1'
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $script)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration (New-TimeSpan -Days 3650)
$set     = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName 'TSSR-WebCMS-AutoUpdate' -Action $action -Trigger $trigger -Settings $set -Description 'Pull git + rebuild toutes les 2h si le depot distant a bouge (sinon ne fait rien).' -Force | Out-Null
Write-Host "Tache 'TSSR-WebCMS-AutoUpdate' enregistree (execution toutes les 2h)."
