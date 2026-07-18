# SPDX-License-Identifier: Apache-2.0
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $repositoryRoot '.venv-usd'
$pythonPath = Join-Path $environmentPath 'Scripts\python.exe'

if (-not (Test-Path -LiteralPath $pythonPath)) {
    & py.exe -3.13 -m venv $environmentPath
}

& $pythonPath -m pip install --disable-pip-version-check 'usd-core==26.5'
& $pythonPath (Join-Path $repositoryRoot 'sidecars\usd_worker.py') doctor
if ($LASTEXITCODE -ne 0) {
    throw 'OpenUSD sidecar doctor failed.'
}
