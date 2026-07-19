# SPDX-License-Identifier: Apache-2.0
param(
    [string] $Version = '0.1.1'
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot "out\release-v$Version"))
$expectedPrefix = [IO.Path]::GetFullPath((Join-Path $repositoryRoot 'out')) + [IO.Path]::DirectorySeparatorChar
if (-not $releaseRoot.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Release output escaped the repository out directory.'
}

if (Test-Path -LiteralPath $releaseRoot) {
    Remove-Item -LiteralPath $releaseRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null

$assets = [ordered]@{
    'SimForge-Setup.exe' = Join-Path $repositoryRoot 'out\make\squirrel.windows\x64\SimForge-Setup.exe'
    "SimForge-win32-x64-$Version.zip" = Join-Path $repositoryRoot "out\make\zip\win32\x64\SimForge-win32-x64-$Version.zip"
    'simforge_bridge-0.1.0.zip' = Join-Path $repositoryRoot 'out\simforge_bridge-0.1.0.zip'
}
foreach ($entry in $assets.GetEnumerator()) {
    if (-not (Test-Path -LiteralPath $entry.Value -PathType Leaf)) {
        throw "Release asset is missing: $($entry.Value)"
    }
    Copy-Item -LiteralPath $entry.Value -Destination (Join-Path $releaseRoot $entry.Key)
}

$sampleRoot = Join-Path $repositoryRoot 'out\release-sample\SimForge-Warehouse-Sample'
if (-not (Test-Path -LiteralPath (Join-Path $sampleRoot 'scene\project.blend') -PathType Leaf)) {
    throw 'Sanitized warehouse sample is missing; run the real warehouse acceptance with SIMFORGE_RELEASE_SAMPLE_DIR first.'
}
if (-not (Test-Path -LiteralPath (Join-Path $sampleRoot 'exports\verified-warehouse\scene.usda') -PathType Leaf)) {
    throw 'Verified warehouse USD entry point is missing from the release sample.'
}
$sanitizer = Join-Path $repositoryRoot 'scripts\sanitize-release-sample.mjs'
& node.exe $sanitizer $sampleRoot
if ($LASTEXITCODE -ne 0) { throw 'Warehouse sample private-path sanitization failed.' }
$usdPython = Join-Path $repositoryRoot '.tools\usd-runtime\python.exe'
$usdWorker = Join-Path $repositoryRoot 'sidecars\usd_worker.py'
& $usdPython $usdWorker verify --path (Join-Path $sampleRoot 'exports\verified-warehouse') | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Sanitized warehouse USD package failed deterministic reopen.' }
$sampleArchive = Join-Path $releaseRoot "SimForge-Warehouse-Sample-$Version.zip"
Compress-Archive -LiteralPath $sampleRoot -DestinationPath $sampleArchive -CompressionLevel Optimal

$privateMarkers = @(
    $env:USERPROFILE,
    $env:USERPROFILE.Replace('\', '/'),
    '\.codex\',
    '/.codex/',
    'feedback Session ID'
)
$textExtensions = @('.json', '.md', '.txt', '.usda', '.py', '.ts', '.tsx', '.xml', '.urdf')
foreach ($file in Get-ChildItem -LiteralPath $sampleRoot -Recurse -File) {
    if ($textExtensions -notcontains $file.Extension.ToLowerInvariant()) { continue }
    $content = Get-Content -LiteralPath $file.FullName -Raw
    foreach ($marker in $privateMarkers) {
        if ($content.IndexOf($marker, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
            throw "Private marker found in sample asset: $($file.FullName)"
        }
    }
}

$hashLines = foreach ($file in Get-ChildItem -LiteralPath $releaseRoot -File | Sort-Object Name) {
    if ($file.Name -eq 'SHA256SUMS.txt') { continue }
    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $($file.Name)"
}
[IO.File]::WriteAllLines(
    (Join-Path $releaseRoot 'SHA256SUMS.txt'),
    [string[]] $hashLines,
    [Text.UTF8Encoding]::new($false)
)

[pscustomobject]@{
    Version = $Version
    ReleaseRoot = $releaseRoot
    Assets = @(Get-ChildItem -LiteralPath $releaseRoot -File | Sort-Object Name | ForEach-Object {
        [pscustomobject]@{
            Name = $_.Name
            Bytes = $_.Length
            SHA256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    })
    PrivateMarkerScan = 'PASS'
}
