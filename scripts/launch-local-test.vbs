' SPDX-License-Identifier: Apache-2.0
Option Explicit

Dim fileSystem, shell, launcherDirectory, powerShellPath, command
Set fileSystem = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

launcherDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
powerShellPath = shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"
command = """" & powerShellPath & """ -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & launcherDirectory & "\launch-simforge.ps1"""

' Window style 0 keeps both PowerShell and the default Windows Terminal host invisible.
shell.Run command, 0, False
