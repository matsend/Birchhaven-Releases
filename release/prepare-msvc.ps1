$ErrorActionPreference = 'Stop'
# App-local runtime deployment: keep the official, unmodified redistributable
# DLLs beside the programs that use them. No machine-wide installer or UAC.
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
$vs = & $vswhere -latest -products '*' -property installationPath
if (-not $vs) { throw 'Visual Studio redistributable directory was not found' }
$folders = Get-ChildItem -Directory "$vs/VC/Redist/MSVC/*/x64/Microsoft.VC*.CRT"
$crt = $folders | Where-Object { Test-Path (Join-Path $_.FullName 'msvcp140_atomic_wait.dll') } | Sort-Object { [version](Get-Item (Join-Path $_.FullName 'msvcp140.dll')).VersionInfo.FileVersionRaw } -Descending | Select-Object -First 1
if (-not $crt) { throw 'The required x64 Visual C++ runtime was not found' }
$destinations = @('output/node', 'output/Birchhaven-Singleplayer/node_modules/@cloudflare/workerd-windows-64/bin', 'output/Birchhaven-Singleplayer/node_modules/workerd/bin')
$receipt = @()
foreach ($dll in (Get-ChildItem -LiteralPath $crt.FullName -Filter '*.dll')) {
  $signature = Get-AuthenticodeSignature -LiteralPath $dll.FullName
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft') { throw "Invalid Microsoft signature: $($dll.Name)" }
  foreach ($destination in $destinations) {
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    Copy-Item -LiteralPath $dll.FullName -Destination $destination
  }
  $receipt += @{ name=$dll.Name; version=$dll.VersionInfo.FileVersion; sha256=(Get-FileHash -LiteralPath $dll.FullName -Algorithm SHA256).Hash.ToLower() }
}
foreach ($required in @('msvcp140.dll','msvcp140_atomic_wait.dll','vcruntime140.dll','vcruntime140_1.dll')) {
  if (-not (Test-Path "output/node/$required")) { throw "Missing redistributable: $required" }
}
$receipt | ConvertTo-Json | Set-Content -Encoding utf8 output/node/msvc-runtime-receipt.json
@'
Microsoft Visual C++ Runtime
Copyright Microsoft Corporation. All rights reserved.
These unmodified redistributable binaries are deployed app-locally from the
licensed Visual Studio installation on the Windows build runner.
Redistribution list and terms:
https://learn.microsoft.com/visualstudio/releases/2026/redistribution
https://visualstudio.microsoft.com/license-terms/
Deployment reference:
https://learn.microsoft.com/cpp/windows/redistributing-visual-cpp-files
These components are updated with the Birchhaven Windows client.
'@ | Set-Content -Encoding utf8 output/node/MSVC-RUNTIME-NOTICE.txt
Write-Output "Bundled $($receipt.Count) signed Microsoft runtime DLLs from $($crt.Name)"
