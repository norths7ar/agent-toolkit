#requires -Version 7.0
[CmdletBinding()]
param(
    [switch]$Check,
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents/skills'),
    [string]$CodexRoot = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }),
    [string]$DshRoot = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }),
    [string]$GeminiRoot = (Join-Path $env:USERPROFILE '.gemini')
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

function Get-RuleMarkdownFiles([string]$Root) {
    foreach ($entry in Get-ChildItem -LiteralPath $Root -Force) {
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked source: $($entry.FullName)" }
        if ($entry.PSIsContainer) { Get-RuleMarkdownFiles $entry.FullName }
        elseif ($entry.Extension -eq '.md') { $entry }
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
# Per-model prompts and bindings are maintained directly in this repository.
$skillLocations = @(
    @{ Source = $SkillsRoot; Target = 'skills' }
    @{ Source = (Join-Path $CodexRoot 'skills'); Target = 'codex/skills' }
)
foreach ($location in $skillLocations) {
    if ($location.Target -eq 'codex/skills' -and -not (Test-Path -LiteralPath $location.Source -PathType Container)) { continue }
    $skills = @(Get-ChildItem -LiteralPath $location.Source -Directory -Force | Where-Object {
        $_.Name -ne '.system' -and
        (Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md') -PathType Leaf)
    })
    foreach ($skill in $skills) {
        if ($skill.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked source: $($skill.FullName)" }
        $name = $skill.Name
        $sourceRoot = $skill.FullName
        foreach ($file in Get-SkillFiles $sourceRoot) {
            $relative = [IO.Path]::GetRelativePath($sourceRoot, $file.FullName)
            $files += [pscustomobject]@{ Source = $file.FullName; Target = Join-Path $repoRoot "$($location.Target)/$name/$relative" }
        }
    }
}
# Antigravity global customizations (non-secret assets only; runtime config.json, mcp_config.json, brain/ and builtin/ are excluded).
$geminiLegacyRule = Join-Path $GeminiRoot 'GEMINI.md'
if (Test-Path -LiteralPath $geminiLegacyRule -PathType Leaf) {
    $files += [pscustomobject]@{
        Source = $geminiLegacyRule
        Target = Join-Path $repoRoot 'antigravity/GEMINI.md'
    }
}
$antigravityConfig = Join-Path $GeminiRoot 'config'
if (Test-Path -LiteralPath $antigravityConfig -PathType Container) {
    foreach ($manifest in @('skills.json', 'plugins.json', 'hooks.json')) {
        $manifestPath = Join-Path $antigravityConfig $manifest
        if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
            $files += [pscustomobject]@{
                Source = $manifestPath
                Target = Join-Path $repoRoot "antigravity/$manifest"
            }
        }
    }
    $agyRulesRoot = Join-Path $antigravityConfig 'rules'
    if (Test-Path -LiteralPath $agyRulesRoot -PathType Container) {
        foreach ($ruleFile in Get-RuleMarkdownFiles $agyRulesRoot) {
            $relative = [IO.Path]::GetRelativePath($agyRulesRoot, $ruleFile.FullName)
            $files += [pscustomobject]@{
                Source = $ruleFile.FullName
                Target = Join-Path $repoRoot "antigravity/rules/$relative"
            }
        }
    }
    $agySkillsRoot = Join-Path $antigravityConfig 'skills'
    if (Test-Path -LiteralPath $agySkillsRoot -PathType Container) {
        $agySkills = @(Get-ChildItem -LiteralPath $agySkillsRoot -Directory -Force | Where-Object {
            Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md') -PathType Leaf
        })
        foreach ($skill in $agySkills) {
            if ($skill.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked source: $($skill.FullName)" }
            $name = $skill.Name
            $sourceRoot = $skill.FullName
            foreach ($file in Get-SkillFiles $sourceRoot) {
                $relative = [IO.Path]::GetRelativePath($sourceRoot, $file.FullName)
                $files += [pscustomobject]@{
                    Source = $file.FullName
                    Target = Join-Path $repoRoot "antigravity/skills/$name/$relative"
                }
            }
        }
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
