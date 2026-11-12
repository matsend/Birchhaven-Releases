param([Parameter(Mandatory=$true)][string]$DataRoot)
$ErrorActionPreference = 'Stop'
$processes = Get-Process -Name workerd | Where-Object { $_.Path.StartsWith($DataRoot, [StringComparison]::OrdinalIgnoreCase) }
if (-not $processes) { throw 'Bundled workerd is not running' }
$modules = @($processes | ForEach-Object { $_.Modules } | Where-Object { $_.ModuleName -ieq 'msvcp140.dll' })
if (-not $modules) { throw 'Microsoft runtime module was not found' }
foreach ($module in $modules) {
  if (-not $module.FileName.StartsWith($DataRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Workerd used system MSVC instead of the bundled runtime' }
}
Write-Output 'PASS: workerd uses the bundled Microsoft runtime'
