param([ValidateSet('dev','check','preview','test:e2e')][string]$Task = 'dev')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $portable = Get-ChildItem -LiteralPath (Join-Path $root '.tools') -Directory -Filter 'node-*-win-x64' | Sort-Object Name -Descending | Select-Object -First 1
  if (-not $portable) { throw 'Install Node.js 24 LTS and reopen your terminal.' }
  $env:Path = $portable.FullName + ';' + $env:Path
}
& npm.cmd run $Task
exit $LASTEXITCODE
