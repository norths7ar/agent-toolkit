#requires -Version 7.0
[CmdletBinding()]
param(
    [switch]$Apply,
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents/skills'),
    [string]$CodexRoot = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' })
)

& (Join-Path $PSScriptRoot 'Transfer-AgentConfig.ps1') -Direction Restore -Apply:$Apply -SkillsRoot $SkillsRoot -CodexRoot $CodexRoot
