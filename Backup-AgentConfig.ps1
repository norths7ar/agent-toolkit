#requires -Version 7.0
[CmdletBinding()]
param(
    [switch]$Check,
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents/skills'),
    [string]$CodexRoot = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }),
    [string]$DshRoot = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' })
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot

function Get-SkillFiles([string]$Root) {
    foreach ($entry in Get-ChildItem -LiteralPath $Root -Force) {
        if ($entry.Name -in @('.git', '.venv', 'node_modules', '__pycache__', '.ruff_cache', 'errors', 'feedback', 'local', 'local-config.md') -or $entry.Name -like '.env*') { continue }
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked source: $($entry.FullName)" }
        if ($entry.PSIsContainer) { Get-SkillFiles $entry.FullName }
        elseif ($entry.Extension -notin @('.pyc', '.pem', '.key', '.p12', '.pfx')) { $entry }
    }
}

$files = @([pscustomobject]@{
    Source = Join-Path $CodexRoot 'AGENTS.md'
    Target = Join-Path $repoRoot 'codex/instructions/AGENTS.md'
})
# DSH is optional; collect only its global instructions when present.
$dshInstructions = Join-Path $DshRoot 'AGENTS.md'
if (Test-Path -LiteralPath $dshInstructions -PathType Leaf) {
    $files += [pscustomobject]@{
        Source = $dshInstructions
        Target = Join-Path $repoRoot 'deepseek-harness/instructions/AGENTS.md'
    }
}
# Prefer editable model-prompts sources over legacy root-level copies of the same name.
$promptRoot = Join-Path $CodexRoot 'model-prompts'
$promptFiles = @()
if (Test-Path -LiteralPath $promptRoot -PathType Container) {
    $promptFiles = @(Get-ChildItem -LiteralPath $promptRoot -File -Filter '*.md')
    $bindingsPath = Join-Path $promptRoot 'bindings.json'
    if (Test-Path -LiteralPath $bindingsPath -PathType Leaf) {
        $files += [pscustomobject]@{
            Source = $bindingsPath
            Target = Join-Path $repoRoot 'codex/instructions/base-instructions/bindings.json'
        }
    }
}
$promptNames = @($promptFiles | ForEach-Object Name)
foreach ($instruction in Get-ChildItem -LiteralPath $CodexRoot -File -Filter '*instructions*.md') {
    if ($instruction.Name -in $promptNames) { continue }
    $promptFiles += $instruction
}
foreach ($instruction in $promptFiles) {
    $files += [pscustomobject]@{
        Source = $instruction.FullName
        Target = Join-Path $repoRoot "codex/instructions/base-instructions/$($instruction.Name)"
    }
}
$skills = @(Get-ChildItem -LiteralPath $SkillsRoot -Directory -Force | Where-Object {
    Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md') -PathType Leaf
})
foreach ($skill in $skills) {
    if ($skill.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked source: $($skill.FullName)" }
    $name = $skill.Name
    $sourceRoot = $skill.FullName
    foreach ($file in Get-SkillFiles $sourceRoot) {
        $relative = [IO.Path]::GetRelativePath($sourceRoot, $file.FullName)
        $files += [pscustomobject]@{ Source = $file.FullName; Target = Join-Path $repoRoot "skills/$name/$relative" }
    }
}
$changes = @(foreach ($file in $files) {
    $hash = (Get-FileHash -LiteralPath $file.Source).Hash
    if ((Test-Path -LiteralPath $file.Target) -and (Get-FileHash -LiteralPath $file.Target).Hash -eq $hash) { continue }
    $file
})
foreach ($file in $changes) {
    Write-Output "UPDATE: $($file.Target)"
    if ($Check) { continue }
    New-Item -ItemType Directory -Path (Split-Path $file.Target -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $file.Source -Destination $file.Target
    if ((Get-FileHash -LiteralPath $file.Source).Hash -ne (Get-FileHash -LiteralPath $file.Target).Hash) { throw "Copy failed: $($file.Target)" }
}
if ($Check) { "Preview: $($changes.Count) changed files." }
else { "Backup complete: $($changes.Count) files updated." }
