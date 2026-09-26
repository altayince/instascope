$ErrorActionPreference = 'Stop'
git -C (Split-Path -Parent $PSScriptRoot) config core.hooksPath .githooks
if ($LASTEXITCODE -ne 0) { throw 'Could not install Git hooks.' }
Write-Host 'INS pre-push protection enabled.'
