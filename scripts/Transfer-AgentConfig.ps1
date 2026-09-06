#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Backup', 'Restore')][string]$Direction,
    [switch]$Apply,
    [Parameter(Mandatory)][string]$SkillsRoot,
    [Parameter(Mandatory)][string]$CodexRoot
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'agent-config.json') -Raw | ConvertFrom-Json
$mappings = [Collections.Generic.List[object]]::new()
foreach ($name in $manifest.skills) {
    if ($name -notmatch '^[a-z0-9]+(-[a-z0-9]+)*$') { throw "Invalid skill name: $name" }
    $mappings.Add(@{ Live = Join-Path $SkillsRoot $name; Saved = Join-Path $repoRoot "skills/$name"; Key = "skills/$name"; Directory = $true })
}
$mappings.Add(@{ Live = Join-Path $CodexRoot 'AGENTS.md'; Saved = Join-Path $repoRoot 'instructions/AGENTS.md'; Key = 'instructions/AGENTS.md'; Directory = $false })

function Get-SkillFiles {
    param([string]$Root)
    # Only enumerate ordinary files. Machine state and credentials are not skill sources.
    foreach ($entry in Get-ChildItem -LiteralPath $Root -Force) {
        if ($entry.Name -in @('.git', '.venv', 'node_modules', '__pycache__', '.ruff_cache', 'errors', 'feedback', 'local', 'local-config.md') -or $entry.Name -like '.env*') { continue }
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Review linked path before copying: $($entry.FullName)" }
        if ($entry.PSIsContainer) { Get-SkillFiles $entry.FullName }
        elseif ($entry.Extension -notin @('.pyc', '.pem', '.key', '.p12', '.pfx')) { $entry }
    }
}

$changes = [Collections.Generic.List[object]]::new()
foreach ($mapping in $mappings) {
    $source = if ($Direction -eq 'Backup') { $mapping.Live } else { $mapping.Saved }
    $destination = if ($Direction -eq 'Backup') { $mapping.Saved } else { $mapping.Live }
    if (-not (Test-Path -LiteralPath $source)) { throw "Missing source; no changes applied: $source" }
    if ($mapping.Directory -and -not (Test-Path -LiteralPath (Join-Path $source 'SKILL.md') -PathType Leaf)) { throw "Missing SKILL.md: $source" }
    $files = if ($mapping.Directory) { @(Get-SkillFiles $source) } else { @(Get-Item -LiteralPath $source) }
    $sourceNames = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($file in $files) {
        $relative = if ($mapping.Directory) { [IO.Path]::GetRelativePath($source, $file.FullName) } else { '' }
        [void]$sourceNames.Add($relative)
        $target = if ($relative) { Join-Path $destination $relative } else { $destination }
        $key = if ($relative) { Join-Path $mapping.Key $relative } else { $mapping.Key }
        if (Test-Path -LiteralPath $target) {
            if ((Get-FileHash -LiteralPath $file.FullName).Hash -eq (Get-FileHash -LiteralPath $target).Hash) { continue }
            $kind = 'UPDATE'
        } else { $kind = 'ADD' }
        $changes.Add(@{ Source = $file.FullName; Target = $target; Key = $key; Kind = $kind })
    }
    if ($mapping.Directory -and (Test-Path -LiteralPath $destination)) {
        foreach ($file in Get-SkillFiles $destination) {
            $relative = [IO.Path]::GetRelativePath($destination, $file.FullName)
            if (-not $sourceNames.Contains($relative)) { Write-Warning "Destination-only file retained; review explicitly: $($file.FullName)" }
        }
    }
}
foreach ($change in $changes) { "$Direction $($change.Kind): $($change.Target)" }
if (-not $Apply) { "Preview only: $($changes.Count) changed files; nothing written."; return }
if ($changes.Count -eq 0) { 'Already up to date.'; return }

if ($Direction -eq 'Restore') {
    $rollbackRoot = Join-Path $repoRoot ('local/restore-backups/' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
    New-Item -ItemType Directory -Path $rollbackRoot -Force | Out-Null
    # Save all preimages before overwriting any live file.
    foreach ($change in $changes) {
        if ($change.Kind -eq 'UPDATE') {
            $preimage = Join-Path $rollbackRoot $change.Key
            New-Item -ItemType Directory -Path (Split-Path $preimage) -Force | Out-Null
            Copy-Item -LiteralPath $change.Target -Destination $preimage
        }
    }
    $changes | Select-Object Target, Key, Kind | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $rollbackRoot 'manifest.json') -Encoding utf8
    "Pre-restore files saved: $rollbackRoot"
}
foreach ($change in $changes) {
    New-Item -ItemType Directory -Path (Split-Path $change.Target) -Force | Out-Null
    Copy-Item -LiteralPath $change.Source -Destination $change.Target
    if ((Get-FileHash -LiteralPath $change.Source).Hash -ne (Get-FileHash -LiteralPath $change.Target).Hash) { throw "Copy verification failed: $($change.Target)" }
}
"$Direction complete: $($changes.Count) files copied and hash-verified. No files deleted."
