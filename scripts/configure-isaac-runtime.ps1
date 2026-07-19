param(
  [string]$PythonPath,
  [switch]$AcceptNvidiaEula
)

$ErrorActionPreference = 'Stop'

if (-not $AcceptNvidiaEula) {
  throw 'Pass -AcceptNvidiaEula only after the owner has accepted the NVIDIA Isaac Sim license terms.'
}

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $PythonPath) {
  $PythonPath = Join-Path $repositoryRoot '.tools\isaacsim-6.0.1\Scripts\python.exe'
}
$resolvedPython = [System.IO.Path]::GetFullPath($PythonPath)
if (-not (Test-Path -LiteralPath $resolvedPython -PathType Leaf)) {
  throw "Isaac Sim Python runtime was not found: $resolvedPython"
}

$worker = Join-Path $repositoryRoot 'sidecars\isaac_worker.py'
$doctorOutput = & $resolvedPython $worker doctor
if ($LASTEXITCODE -ne 0) {
  throw 'Isaac Sim worker doctor failed.'
}
$resultLine = $doctorOutput | Where-Object { $_ -like 'SIMFORGE_RESULT:*' } | Select-Object -Last 1
if (-not $resultLine) {
  throw 'Isaac Sim worker doctor returned no machine-readable result.'
}
$doctor = ($resultLine -replace '^SIMFORGE_RESULT:', '') | ConvertFrom-Json
if (-not $doctor.ok) {
  throw 'Isaac Sim runtime is not ready.'
}

$runtimeDirectory = Join-Path $env:LOCALAPPDATA 'SimForge\runtime'
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
$configurationPath = Join-Path $runtimeDirectory 'isaac-runtime.json'
$configuration = [ordered]@{
  schemaVersion = 1
  pythonPath = $resolvedPython
  productVersion = $doctor.version
  eulaAcceptedAt = [DateTime]::UtcNow.ToString('o')
}
$configurationJson = ($configuration | ConvertTo-Json) + [Environment]::NewLine
[IO.File]::WriteAllText($configurationPath, $configurationJson, [Text.UTF8Encoding]::new($false))
Write-Output "Configured NVIDIA Isaac Sim $($doctor.version) at $configurationPath"
