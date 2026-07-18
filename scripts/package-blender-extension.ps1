# SPDX-License-Identifier: Apache-2.0
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $repositoryRoot 'blender-extension'
$outputRoot = Join-Path $repositoryRoot 'out'
$destination = Join-Path $outputRoot 'simforge_bridge-0.1.0.zip'

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$entries = @(
    'blender_manifest.toml',
    'LICENSE',
    'simforge_bridge/__init__.py',
    'simforge_bridge/bridge.py',
    'simforge_bridge/protocol.py'
)

$stream = [System.IO.File]::Open($destination, [System.IO.FileMode]::Create)
try {
    $archive = [System.IO.Compression.ZipArchive]::new(
        $stream,
        [System.IO.Compression.ZipArchiveMode]::Create,
        $false
    )
    try {
        foreach ($entry in $entries) {
            $source = Join-Path $sourceRoot ($entry -replace '/', [System.IO.Path]::DirectorySeparatorChar)
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive,
                $source,
                $entry,
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    }
    finally {
        $archive.Dispose()
    }
}
finally {
    $stream.Dispose()
}

Write-Output $destination
