# SPDX-License-Identifier: Apache-2.0
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$appSource = Join-Path $repositoryRoot 'out\SimForge-win32-x64'
$blenderSource = Join-Path $repositoryRoot '.tools\blender-4.5.11\blender-4.5.11-windows-x64'
$extensionArchive = Join-Path $repositoryRoot 'out\simforge_bridge-0.1.0.zip'
$launcherSource = Join-Path $repositoryRoot 'scripts\launch-local-test.ps1'
$windowlessLauncherSource = Join-Path $repositoryRoot 'scripts\launch-local-test.vbs'
$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\SimForge'
$appDestination = Join-Path $installRoot 'app'
$blenderDestination = Join-Path $installRoot 'blender'
$launcherDestination = Join-Path $installRoot 'launch-simforge.ps1'
$windowlessLauncherDestination = Join-Path $installRoot 'launch-simforge.vbs'
$starterSceneDestination = Join-Path $installRoot 'SimForge Starter.blend'
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'SimForge.lnk'
$legacyShortcutPath = Join-Path $desktop 'SimForge Hackathon.lnk'
$expectedBlenderExecutableHash = '0949E462F677C3E341913A838C6E2F54CC1C811CCB6F281AE9B3FF5926A2B255'

function Assert-File([string] $path, [string] $label) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "$label is missing: $path"
    }
}

function Copy-Tree([string] $source, [string] $destination) {
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    & robocopy.exe $source $destination /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "Copy failed from $source to $destination (robocopy exit $LASTEXITCODE)"
    }
}

Assert-File (Join-Path $appSource 'SimForge.exe') 'Packaged SimForge application'
Assert-File (Join-Path $blenderSource 'blender.exe') 'Verified Blender 4.5.11 LTS build'
Assert-File $extensionArchive 'Packaged SimForge Blender extension'
Assert-File $launcherSource 'SimForge launcher'
Assert-File $windowlessLauncherSource 'Windowless SimForge launcher'

$actualBlenderExecutableHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $blenderSource 'blender.exe')).Hash
if ($actualBlenderExecutableHash -ne $expectedBlenderExecutableHash) {
    throw 'The Blender source executable does not match the hash-verified 4.5.11 LTS build.'
}

$runningInstalledProcesses = @(
    Get-Process -Name 'SimForge', 'blender' -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and $_.Path.StartsWith($installRoot, [StringComparison]::OrdinalIgnoreCase) }
)
if ($runningInstalledProcesses.Count -gt 0) {
    throw 'Close the installed SimForge and Blender windows before updating the local test installation.'
}

Copy-Tree $appSource $appDestination
Copy-Tree $blenderSource $blenderDestination
Copy-Item -LiteralPath $launcherSource -Destination $launcherDestination -Force
Copy-Item -LiteralPath $windowlessLauncherSource -Destination $windowlessLauncherDestination -Force

$installedBlender = Join-Path $blenderDestination 'blender.exe'
& $installedBlender --background --command extension install-file -r user_default --enable $extensionArchive
if ($LASTEXITCODE -ne 0) {
    throw "Blender extension installation failed (exit $LASTEXITCODE)"
}
& $installedBlender --background --python-expr "import bpy; bpy.context.preferences.view.show_splash = False; bpy.ops.wm.save_userpref()"
if ($LASTEXITCODE -ne 0) {
    throw "Blender no-splash preference setup failed (exit $LASTEXITCODE)"
}
$env:SIMFORGE_STARTER_SCENE_PATH = $starterSceneDestination
try {
    & $installedBlender --background --factory-startup --python-expr "import bpy, os; bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False); bpy.context.scene.unit_settings.system='METRIC'; bpy.context.scene.unit_settings.scale_length=1.0; bpy.context.scene.unit_settings.length_unit='METERS'; bpy.ops.wm.save_as_mainfile(filepath=os.environ['SIMFORGE_STARTER_SCENE_PATH'])"
    if ($LASTEXITCODE -ne 0) {
        throw "SimForge clean starter scene creation failed (exit $LASTEXITCODE)"
    }
}
finally {
    Remove-Item Env:SIMFORGE_STARTER_SCENE_PATH -ErrorAction SilentlyContinue
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = (Join-Path $env:SystemRoot 'System32\wscript.exe')
$shortcut.Arguments = "//B //Nologo `"$windowlessLauncherDestination`""
$shortcut.WorkingDirectory = $appDestination
$shortcut.IconLocation = "$(Join-Path $appDestination 'SimForge.exe'),0"
$shortcut.Description = 'Launch the current SimForge hackathon build with Blender 4.5 LTS'
$shortcut.Save()

if (Test-Path -LiteralPath $legacyShortcutPath) {
    $legacyShortcut = $shell.CreateShortcut($legacyShortcutPath)
    if (
        $legacyShortcut.TargetPath -eq (Join-Path $env:SystemRoot 'System32\wscript.exe') -and
        $legacyShortcut.Arguments -like "*$windowlessLauncherDestination*"
    ) {
        Remove-Item -LiteralPath $legacyShortcutPath -Force
    }
}

[pscustomobject]@{
    InstallRoot = $installRoot
    Application = Join-Path $appDestination 'SimForge.exe'
    Blender = $installedBlender
    BlenderExtension = 'simforge_bridge enabled in user_default'
    StarterScene = $starterSceneDestination
    Shortcut = $shortcutPath
    LegacyShortcutRemoved = -not (Test-Path -LiteralPath $legacyShortcutPath)
}
