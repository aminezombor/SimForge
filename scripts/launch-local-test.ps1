# SPDX-License-Identifier: Apache-2.0
$ErrorActionPreference = 'Stop'

$installRoot = $PSScriptRoot
$appPath = Join-Path $installRoot 'app\SimForge.exe'
$appWorkingDirectory = Join-Path $installRoot 'app'
$blenderPath = Join-Path $installRoot 'blender\blender.exe'
$blenderLauncherPath = Join-Path $installRoot 'blender\blender-launcher.exe'
$runtimeDirectory = Join-Path $env:LOCALAPPDATA 'SimForge\runtime'
$projectScenePath = Join-Path $env:LOCALAPPDATA 'SimForge\projects\default\scene\main.blend'
$starterScenePath = Join-Path $installRoot 'SimForge Starter.blend'

function Show-LaunchError([string] $message) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
        $message,
        'SimForge Launcher',
        [System.Windows.MessageBoxButton]::OK,
        [System.Windows.MessageBoxImage]::Error
    ) | Out-Null
}

try {
    if (-not (Test-Path -LiteralPath $appPath -PathType Leaf)) {
        throw "SimForge is missing at $appPath"
    }
    if (-not (Test-Path -LiteralPath $blenderPath -PathType Leaf)) {
        throw "Blender 4.5 LTS is missing at $blenderPath"
    }
    if (-not (Test-Path -LiteralPath $blenderLauncherPath -PathType Leaf)) {
        throw "The windowless Blender launcher is missing at $blenderLauncherPath"
    }
    if (-not (Test-Path -LiteralPath $starterScenePath -PathType Leaf)) {
        throw "The clean SimForge starter scene is missing at $starterScenePath"
    }

    $env:SIMFORGE_BLENDER_PATH = $blenderPath
    $env:SIMFORGE_AUTO_CONNECT = '1'

    $simForgeProcesses = @(Get-Process -Name 'SimForge' -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -eq $appPath })
    if ($simForgeProcesses.Count -eq 0) {
        Start-Process -FilePath $appPath -WorkingDirectory $appWorkingDirectory | Out-Null
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(20)
    $descriptorReady = $false
    do {
        $simForgeProcesses = @(Get-Process -Name 'SimForge' -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -eq $appPath })
        $installedProcessIds = @($simForgeProcesses | ForEach-Object { $_.Id })
        $descriptors = @(Get-ChildItem -LiteralPath $runtimeDirectory -Filter '*.json' -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTimeUtc -Descending)
        foreach ($descriptorFile in $descriptors) {
            try {
                $descriptor = Get-Content -Raw -LiteralPath $descriptorFile.FullName | ConvertFrom-Json
                if ($installedProcessIds -contains [int]$descriptor.appPid) {
                    $descriptorReady = $descriptor.port -and ([DateTime]::Parse($descriptor.expiresAt).ToUniversalTime() -gt [DateTime]::UtcNow)
                    if ($descriptorReady) { break }
                }
            }
            catch {
                continue
            }
        }
        if (-not $descriptorReady) { Start-Sleep -Milliseconds 250 }
    } while (-not $descriptorReady -and [DateTime]::UtcNow -lt $deadline)

    if (-not $descriptorReady) {
        throw 'SimForge opened, but its authenticated Blender bridge did not become ready within 20 seconds.'
    }

    $blenderRunning = @(Get-Process -Name 'blender' -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -eq $blenderPath }).Count -gt 0
    if (-not $blenderRunning) {
        if (Test-Path -LiteralPath $projectScenePath -PathType Leaf) {
            Start-Process -FilePath $blenderLauncherPath -ArgumentList @("`"$projectScenePath`"") -WorkingDirectory (Split-Path -Parent $blenderPath) | Out-Null
        }
        else {
            Start-Process -FilePath $blenderLauncherPath -ArgumentList @("`"$starterScenePath`"") -WorkingDirectory (Split-Path -Parent $blenderPath) | Out-Null
        }
    }
}
catch {
    Show-LaunchError $_.Exception.Message
    exit 1
}
