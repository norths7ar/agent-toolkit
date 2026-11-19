#requires -Version 7.0
[CmdletBinding()]
param(
    [string]$CodexRoot = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }),
    [string]$CodexExecutable,
    [switch]$Check
)

$ErrorActionPreference = 'Stop'
$CodexRoot = [IO.Path]::GetFullPath($CodexRoot)
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$promptRoot = Join-Path $repoRoot 'codex/instructions/base-instructions'
$mutex = $null
$ownsMutex = $false

function Get-FileDigest([string]$Path) {
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    }
    return $null
}

function Resolve-CodexExecutable {
    if ($CodexExecutable) { return $CodexExecutable }
    $candidates = @($env:CODEX_CLI_PATH)
    $configPath = Join-Path $CodexRoot 'config.toml'
    if (Test-Path -LiteralPath $configPath) {
        $config = [IO.File]::ReadAllText($configPath)
        $match = [regex]::Match($config, '(?m)^CODEX_CLI_PATH\s*=\s*(?<value>''[^'']+''|"(?:[^"\\]|\\.)+")\s*$')
        if ($match.Success) {
            $value = $match.Groups['value'].Value
            $candidates += $(if ($value.StartsWith("'")) { $value.Substring(1, $value.Length - 2) } else { $value | ConvertFrom-Json })
        }
    }
    $command = Get-Command codex -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { $candidates += $command.Source }
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $candidate }
    }
    throw 'Cannot locate Codex. Open the Codex app once, or pass -CodexExecutable with its executable path.'
}

function Publish-File([string]$Source, [string]$Destination) {
    New-Item -ItemType Directory -Path (Split-Path $Destination -Parent) -Force | Out-Null
    # Replacement must be staged on the destination volume, not the repository drive.
    $pending = "$Destination.$([guid]::NewGuid().ToString('N')).pending"
    try {
        [IO.File]::Copy($Source, $pending)
        if (Test-Path -LiteralPath $Destination) {
            [IO.File]::Replace($pending, $Destination, [NullString]::Value)
        }
        else { [IO.File]::Move($pending, $Destination) }
    }
    finally {
        if (Test-Path -LiteralPath $pending) { Remove-Item -LiteralPath $pending }
    }
}

try {
    $rootHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($CodexRoot.ToLowerInvariant())))
    $mutex = [Threading.Mutex]::new($false, "Local\CodexModelCatalog-$rootHash")
    try { $ownsMutex = $mutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (-not $ownsMutex) { throw 'Another model catalog refresh is running. Wait for it to finish.' }

    $bindingPath = Join-Path $promptRoot 'bindings.json'
    if (-not (Test-Path -LiteralPath $bindingPath)) {
        throw 'Repository bindings.json is missing.'
    }
    $bindings = Get-Content -LiteralPath $bindingPath -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable
    if ($bindings -isnot [Collections.IDictionary] -or -not $bindings.Count) { throw 'Repository bindings must be a nonempty model-to-Markdown mapping.' }
    $filenames = @($bindings.Values | Sort-Object -Unique)
    foreach ($name in $filenames) {
        if ($name -isnot [string] -or $name -notmatch '^[^/\\:]+\.md$' -or $name -match '^\.\.') { throw 'Bindings must reference Markdown filenames inside the repository prompt directory.' }
        if (-not (Test-Path -LiteralPath (Join-Path $promptRoot $name) -PathType Leaf)) { throw "Bound prompt is missing: $name" }
    }

    $stage = Join-Path $repoRoot ('.tmp/{0}-refresh-model-catalog-{1}' -f (Get-Date -Format yyyyMMdd), [guid]::NewGuid().ToString('N'))
    $stagedHome = Join-Path $stage 'generated'
    $backupRoot = Join-Path $stage 'before'
    New-Item -ItemType Directory -Path $stagedHome, $backupRoot -Force | Out-Null
    $locations = @{
        'model-catalog.json' = Join-Path $CodexRoot 'model-catalog.json'
        'official-model-catalog.json' = Join-Path $CodexRoot 'official-model-catalog.json'
        'model-catalog.state.json' = Join-Path $repoRoot 'codex/.local/model-catalog.state.json'
    }
    $paths = @($locations.Keys)
    $sourceDigests = @{}
    foreach ($name in (@('bindings.json') + $filenames)) {
        $sourceDigests[$name] = Get-FileDigest (Join-Path $promptRoot $name)
    }
    $digests = @{}
    foreach ($relative in $paths) {
        $path = $locations[$relative]
        $digests[$relative] = Get-FileDigest $path
        if ($digests[$relative]) {
            $backup = Join-Path $backupRoot $relative
            New-Item -ItemType Directory -Path (Split-Path $backup) -Force | Out-Null
            Copy-Item -LiteralPath $path -Destination $backup
            if ($relative -ne 'official-model-catalog.json') {
                Copy-Item -LiteralPath $backup -Destination (Join-Path $stagedHome $relative)
            }
        }
    }

    $exe = Resolve-CodexExecutable
    $versionOutput = & $exe --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'Codex version query failed.' }
    $versionMatch = [regex]::Match(($versionOutput -join "`n"), 'codex-cli\s+(\d+\.\d+\.\d+)')
    if (-not $versionMatch.Success) { throw 'Codex did not report a recognizable CLI version.' }
    $version = $versionMatch.Groups[1].Value
    Write-Output "Fetching official model catalog (Codex $version)..."
    try { $auth = Get-Content -LiteralPath (Join-Path $CodexRoot 'auth.json') -Raw -Encoding utf8 | ConvertFrom-Json }
    catch { throw 'Cannot read Codex login credentials. Sign in to the Codex app, then retry.' }
    if (-not $auth.tokens.access_token -or -not $auth.tokens.account_id) {
        throw 'No saved ChatGPT login is available. Sign in to the Codex app, then retry.'
    }
    $headers = @{
        Authorization = 'Bearer ' + $auth.tokens.access_token
        'ChatGPT-Account-Id' = $auth.tokens.account_id
        Originator = 'codex_cli_rs'
        'User-Agent' = "codex_cli_rs/$version"
    }
    try {
        $response = Invoke-WebRequest -Uri "https://chatgpt.com/backend-api/codex/models?client_version=$version" -Headers $headers -MaximumRedirection 0 -TimeoutSec 60 -SkipHttpErrorCheck
    }
    catch { throw 'Official model catalog request failed (network, TLS, timeout, or redirect). Existing catalog retained.' }
    finally { $headers = $null; $auth = $null }
    if ($response.StatusCode -eq 401) { throw 'Codex login has expired. Sign in again in Codex, then retry; no credentials were changed.' }
    if ($response.StatusCode -ne 200) { throw "Official model catalog returned HTTP $($response.StatusCode). Existing catalog retained." }
    try { $upstream = $response.Content | ConvertFrom-Json -AsHashtable }
    catch { throw 'Official model catalog was not valid JSON. Existing catalog retained.' }
    if ($upstream.models -isnot [array] -or -not $upstream.models.Count) { throw 'Official model catalog was empty or malformed. Existing catalog retained.' }
    $officialPath = Join-Path $stage 'official-model-catalog.json'
    [IO.File]::WriteAllText($officialPath, ([ordered]@{ models = $upstream.models } | ConvertTo-Json -Depth 100) + "`n", [Text.UTF8Encoding]::new($false))

    & (Join-Path $PSScriptRoot 'Prepare-ModelCatalog.ps1') -CodexRoot $stagedHome -SourceCatalog $officialPath -StatePath (Join-Path $stagedHome 'model-catalog.state.json')
    $generatedPath = Join-Path $stagedHome 'model-catalog.json'
    $generated = Get-Content -LiteralPath $generatedPath -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable
    $oldModels = @{}
    $previousPath = Join-Path $backupRoot 'model-catalog.json'
    if (Test-Path -LiteralPath $previousPath) {
        foreach ($model in (Get-Content -LiteralPath $previousPath -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable).models) { $oldModels[$model.slug] = $model }
    }
    $newIds = @($generated.models | ForEach-Object { $_.slug })
    foreach ($model in $generated.models) {
        if (-not $oldModels.ContainsKey($model.slug)) { Write-Output "Added: $($model.slug)" }
        elseif (($oldModels[$model.slug] | ConvertTo-Json -Depth 100 -Compress) -cne ($model | ConvertTo-Json -Depth 100 -Compress)) { Write-Output "Updated: $($model.slug)" }
    }
    foreach ($slug in $oldModels.Keys | Sort-Object) {
        if ($slug -notin $newIds) { Write-Output "Removed from official catalog: $slug (any repository binding is retained)." }
    }
    foreach ($relative in $paths) {
        if ((Get-FileDigest $locations[$relative]) -ne $digests[$relative]) { throw "Local input changed during refresh: $relative. Retry after editing finishes." }
    }
    foreach ($name in $sourceDigests.Keys) {
        if ((Get-FileDigest (Join-Path $promptRoot $name)) -ne $sourceDigests[$name]) { throw "Repository input changed during refresh: $name. Retry after editing finishes." }
    }
    $changed = (Get-FileDigest $generatedPath) -ne $digests['model-catalog.json']
    Write-Output "Result: $($generated.models.Count) models; catalog changed=$changed. Repository prompts and bindings applied without modification."
    if ($Check) { Write-Output 'Preview only; no Codex files changed.'; return }

    $publications = [ordered]@{
        'official-model-catalog.json' = $officialPath
        'model-catalog.state.json' = (Join-Path $stagedHome 'model-catalog.state.json')
        'model-catalog.json' = $generatedPath
    }
    $published = [Collections.Generic.List[string]]::new()
    try {
        foreach ($relative in $publications.Keys) {
            if ((Get-FileDigest $publications[$relative]) -eq $digests[$relative]) { continue }
            Publish-File $publications[$relative] $locations[$relative]
            $published.Add($relative)
        }
    }
    catch {
        $publishError = $_.Exception.Message
        $restoreErrors = [Collections.Generic.List[string]]::new()
        for ($index = $published.Count - 1; $index -ge 0; $index--) {
            $relative = $published[$index]
            $backup = Join-Path $backupRoot $relative
            $destination = $locations[$relative]
            try {
                if (Test-Path -LiteralPath $backup) { Publish-File $backup $destination }
                else { Remove-Item -LiteralPath $destination }
            }
            catch { $restoreErrors.Add("${relative}: $($_.Exception.Message)") }
        }
        if ($restoreErrors.Count) {
            throw "Publishing failed: $publishError. Restore incomplete: $($restoreErrors -join '; '). Backups: $backupRoot"
        }
        throw "Publishing failed: $publishError. Prior files restored. Backups: $backupRoot"
    }
    Write-Output "Backup and fetched source: $stage"
    if ($changed) { Write-Output 'Updated. Restart Codex to load the refreshed catalog.' }
    else { Write-Output 'Already up to date; no restart needed for this refresh.' }
}
catch {
    [Console]::Error.WriteLine("Model catalog refresh failed: $($_.Exception.Message)")
    exit 1
}
finally {
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}
