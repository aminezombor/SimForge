# SPDX-License-Identifier: Apache-2.0
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$toolsRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot '.tools'))
$runtimeRoot = [IO.Path]::GetFullPath((Join-Path $toolsRoot 'usd-runtime'))
$worker = Join-Path $repositoryRoot 'sidecars\usd_worker.py'
$venvPackages = Join-Path $repositoryRoot '.venv-usd\Lib\site-packages'

if (-not $runtimeRoot.StartsWith($toolsRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'USD runtime target escaped the repository tools directory.'
}

if (Test-Path -LiteralPath (Join-Path $runtimeRoot 'python.exe') -PathType Leaf) {
    & (Join-Path $runtimeRoot 'python.exe') $worker doctor
    if ($LASTEXITCODE -eq 0) {
        Write-Output $runtimeRoot
        exit 0
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $venvPackages 'pxr') -PathType Container)) {
    throw 'Run scripts/bootstrap-usd.ps1 before preparing the portable runtime.'
}

$basePrefix = & py.exe -3.13 -c 'import sys; print(sys.prefix)'
if ($LASTEXITCODE -ne 0 -or -not $basePrefix) {
    throw 'Python 3.13 could not be located.'
}
$basePrefix = [IO.Path]::GetFullPath($basePrefix.Trim())
$staging = [IO.Path]::GetFullPath((Join-Path $toolsRoot ('usd-runtime-staging-' + [guid]::NewGuid().ToString('N'))))
New-Item -ItemType Directory -Path $staging -Force | Out-Null

& robocopy.exe $basePrefix $staging /E /XD Doc include libs Scripts tcl site-packages /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) {
    throw "Python runtime copy failed (robocopy exit $LASTEXITCODE)."
}

$portablePackages = Join-Path $staging 'Lib\site-packages'
New-Item -ItemType Directory -Path $portablePackages -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $venvPackages 'pxr') -Destination $portablePackages -Recurse -Force
$usdDistInfo = Get-ChildItem -LiteralPath $venvPackages -Filter 'usd_core-*.dist-info' -Directory | Select-Object -First 1
if (-not $usdDistInfo) {
    throw 'Pinned usd-core distribution metadata is missing.'
}
Copy-Item -LiteralPath $usdDistInfo.FullName -Destination $portablePackages -Recurse -Force

& (Join-Path $staging 'python.exe') $worker doctor
if ($LASTEXITCODE -ne 0) {
    throw 'Prepared OpenUSD runtime failed its doctor check.'
}

if (Test-Path -LiteralPath $runtimeRoot) {
    Remove-Item -LiteralPath $runtimeRoot -Recurse -Force
}
Move-Item -LiteralPath $staging -Destination $runtimeRoot
Write-Output $runtimeRoot
