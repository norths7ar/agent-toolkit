#requires -Version 7.0
[CmdletBinding()]
param(
    [string]$CodexRoot = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }),
    [string]$SourceCatalog,
    [switch]$Check
)

$ErrorActionPreference = 'Stop'
$CodexRoot = [IO.Path]::GetFullPath($CodexRoot)
$seedRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../instructions/base-instructions'))
$promptRoot = Join-Path $CodexRoot 'model-prompts'
$outputPath = Join-Path $CodexRoot 'model-catalog.json'
$statePath = Join-Path $promptRoot '.catalog-state.json'
if (-not $SourceCatalog) { $SourceCatalog = Join-Path $CodexRoot 'models_cache.json' }
$SourceCatalog = [IO.Path]::GetFullPath($SourceCatalog)
if ($SourceCatalog -eq $outputPath) { throw 'SourceCatalog must be the upstream catalog, not the generated output.' }

function Read-Json([string]$Path) {
    Get-Content -LiteralPath $Path -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable
}

function Get-TextHash([string]$Text) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { [Convert]::ToHexString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text))) }
    finally { $sha.Dispose() }
}

function Write-ChangedText([string]$Path, [string]$Text) {
    if ((Test-Path -LiteralPath $Path) -and [IO.File]::ReadAllText($Path) -ceq $Text) { return }
    # Write a sibling temporary file so readers never see a partially written catalog.
    $tempPath = "$Path.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        [IO.File]::WriteAllText($tempPath, $Text, [Text.UTF8Encoding]::new($false))
        [IO.File]::Move($tempPath, $Path, $true)
    }
    finally { if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath } }
}

$source = Read-Json $SourceCatalog
if (-not $source.models -or $source.models -isnot [array]) { throw 'Source catalog must contain a nonempty models array.' }

# Protect hand-edited output before seeding or changing any files.
if (Test-Path -LiteralPath $outputPath) {
    if (-not (Test-Path -LiteralPath $statePath)) {
        throw "Existing output has no generation record. Preserve or move it before preparing: $outputPath"
    }
    $state = Read-Json $statePath
    if ((Get-FileHash -LiteralPath $outputPath -Algorithm SHA256).Hash -ne $state.catalogSha256) {
        $edited = Read-Json $outputPath
        $changed = @(foreach ($model in $edited.models) {
            if ($state.promptHashes.Contains($model.slug) -and
                (Get-TextHash $model.model_messages.instructions_template) -ne $state.promptHashes[$model.slug]) {
                $model.slug
            }
        })
        $detail = if ($changed.Count) { 'Changed prompts: ' + ($changed -join ', ') } else { 'Catalog formatting, metadata, or model membership changed.' }
        throw "$detail. Nothing overwritten. Review $outputPath, copy intended prompt edits to $promptRoot, then move the edited catalog aside and rerun. When models share a Markdown file, reconcile their edits first."
    }
}

# Existing local Markdown and bindings take priority. Seed only missing files.
$bindingPath = Join-Path $promptRoot 'bindings.json'
$bindingSource = if (Test-Path -LiteralPath $bindingPath) { $bindingPath } else { Join-Path $seedRoot 'bindings.json' }
$bindings = Read-Json $bindingSource
if ($bindings -isnot [Collections.IDictionary]) { throw 'bindings.json must map exact model IDs to Markdown filenames.' }
$seeds = @{}
if ($bindingSource -ne $bindingPath) { $seeds[$bindingPath] = $bindingSource }
$texts = @{}
foreach ($filename in ($bindings.Values | Sort-Object -Unique)) {
    if ($filename -isnot [string] -or $filename -notmatch '^[^/\\:]+\.md$' -or $filename -match '^\.\.') {
        throw "Bindings must use Markdown filenames within model-prompts: $filename"
    }
    $localPath = Join-Path $promptRoot $filename
    $inputPath = $localPath
    if (-not (Test-Path -LiteralPath $localPath)) {
        $legacyPath = Join-Path $CodexRoot $filename
        $inputPath = if (Test-Path -LiteralPath $legacyPath) { $legacyPath } else { Join-Path $seedRoot $filename }
        $seeds[$localPath] = $inputPath
    }
    $body = [IO.File]::ReadAllText($inputPath)
    if ([string]::IsNullOrWhiteSpace($body)) { throw "Empty prompt: $inputPath" }
    $texts[$filename] = $body
}

$seen = @{}
$rows = @()
$hashes = [ordered]@{}
foreach ($model in $source.models) {
    if (-not $model.slug -or $seen.ContainsKey($model.slug)) { throw "Missing or duplicate model slug: $($model.slug)" }
    $seen[$model.slug] = $true
    if (-not $bindings.Contains($model.slug)) { continue }
    if ($model.model_messages -isnot [Collections.IDictionary] -or -not $model.model_messages.Contains('instructions_template')) {
        throw "Model has no supported instructions_template: $($model.slug)"
    }
    $filename = $bindings[$model.slug]
    $model.model_messages.instructions_template = $texts[$filename]
    $hashes[$model.slug] = Get-TextHash $texts[$filename]
    $rows += [pscustomobject]@{ Model = $model.slug; Prompt = $filename; Characters = $texts[$filename].Length }
}
foreach ($slug in $bindings.Keys) {
    if (-not $seen.ContainsKey($slug)) { Write-Warning "Bound model is absent from source; binding retained for later: $slug" }
}
if (-not $rows.Count) { throw 'No bound models matched the source catalog.' }

# The cache envelope (etag, account identity, fetched_at) is not part of the output catalog.
$json = ([ordered]@{ models = $source.models } | ConvertTo-Json -Depth 100) + "`n"
$newState = [ordered]@{
    catalogSha256 = Get-TextHash $json
    promptHashes = $hashes
}
$stateJson = ($newState | ConvertTo-Json -Depth 10) + "`n"
foreach ($destination in ($seeds.Keys | Sort-Object)) { Write-Output "SEED: $destination <- $($seeds[$destination])" }
$rows | Format-Table -AutoSize | Out-Host
$unchanged = (Test-Path -LiteralPath $outputPath) -and [IO.File]::ReadAllText($outputPath) -ceq $json
Write-Output "Catalog: $outputPath ($($source.models.Count) models, $($rows.Count) custom prompts, unchanged=$unchanged)"
if ($Check) { Write-Output 'Preview only; no files written.'; return }

New-Item -ItemType Directory -Path $promptRoot -Force | Out-Null
foreach ($destination in $seeds.Keys) { Copy-Item -LiteralPath $seeds[$destination] -Destination $destination }
Write-ChangedText $outputPath $json
Write-ChangedText $statePath $stateJson
Write-Output 'Prepared. config.toml and the upstream catalog were not modified; this command does not activate the catalog.'
