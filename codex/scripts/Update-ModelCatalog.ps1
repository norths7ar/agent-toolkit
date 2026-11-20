#requires -Version 7.0
[CmdletBinding()]
param(
    [string]$CodexRoot = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }),
    [string]$CodexExecutable,
    [switch]$Check,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Text.UTF8Encoding]::new($false)
if (Get-Variable -Name PSStyle -ErrorAction SilentlyContinue) {
    $PSStyle.OutputRendering = 'PlainText'
}

$CodexRoot = [IO.Path]::GetFullPath($CodexRoot)
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$promptRoot = Join-Path $repoRoot 'codex/instructions/base-instructions'
$mutex = $null
$ownsMutex = $false
$logs = [Collections.Generic.List[string]]::new()
$jsonEmitted = $false
$failureDetails = @()

function Add-Log([string]$Text) {
    if ([string]::IsNullOrEmpty($Text)) { return }
    foreach ($line in ($Text -split "\r?\n")) {
        if ($line -eq '') { continue }
        $logs.Add($line)
        if (-not $Json) { Write-Output $line }
    }
}

function Emit-JsonResult([string]$State, [string]$Summary, [string[]]$Details = @()) {
    if (-not $Json) { return }
    $script:jsonEmitted = $true
    $payload = [ordered]@{
        state = $State
        summary = $Summary
        details = @($Details | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        logs = @($logs)
    }
    Write-Output ($payload | ConvertTo-Json -Depth 10 -Compress)
}

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
    Add-Log "Fetching official model catalog (Codex $version)..."
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

    $oldModels = @{}
    $previousPath = Join-Path $backupRoot 'model-catalog.json'
    if (-not (Test-Path -LiteralPath $previousPath)) {
        $previousPath = Join-Path $backupRoot 'official-model-catalog.json'
    }
    if (Test-Path -LiteralPath $previousPath) {
        foreach ($model in (Get-Content -LiteralPath $previousPath -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable).models) {
            $oldModels[$model.slug] = $model
        }
    }

    $unboundVisible = @($upstream.models | Where-Object { -not $bindings.Contains($_.slug) -and $_.visibility -ne 'hide' } | ForEach-Object { $_.slug } | Sort-Object)
    $hiddenKept = @($upstream.models | Where-Object { -not $bindings.Contains($_.slug) -and $_.visibility -eq 'hide' } | ForEach-Object { $_.slug } | Sort-Object)
    $upstreamIds = @($upstream.models | ForEach-Object { $_.slug })
    $addedFromPrev = @($upstreamIds | Where-Object { -not $oldModels.ContainsKey($_) } | Sort-Object)
    $removedFromPrev = @($oldModels.Keys | Where-Object { $_ -notin $upstreamIds } | Sort-Object)

    if ($unboundVisible.Count -gt 0) {
        if ($addedFromPrev.Count) { Add-Log ("Added: " + ($addedFromPrev -join ', ')) }
        if ($removedFromPrev.Count) { Add-Log ("Removed from official catalog: " + ($removedFromPrev -join ', ')) }
        if ($hiddenKept.Count) { Add-Log ("Hidden official models kept as-is: " + ($hiddenKept -join ', ')) }
        Add-Log ("Unbound visible models (action required): " + ($unboundVisible -join ', '))
        Add-Log "Fetched official snapshot: $officialPath"

        $details = [Collections.Generic.List[string]]::new()
        $details.Add("未绑定可见模型（需先处理 bindings.json）：$($unboundVisible -join ', ')")
        if ($addedFromPrev.Count) { $details.Add("新增官方模型：$($addedFromPrev -join ', ')") }
        if ($removedFromPrev.Count) { $details.Add("官方已移除模型：$($removedFromPrev -join ', ')") }
        if ($hiddenKept.Count) { $details.Add("隐藏模型原样保留：$($hiddenKept -join ', ')") }
        $details.Add("已保存官方目录快照：$officialPath")

        if ($Check) {
            $summary = "发现未绑定的可见模型：$($unboundVisible -join ', ')；请先编辑 bindings.json 后再刷新目录。"
            Add-Log $summary
            Add-Log 'Preview only; no Codex files changed.'
            Emit-JsonResult -State 'warning' -Summary $summary -Details $details
            return
        }
        $failureDetails = @($details)
        throw "已拦截刷新：存在未绑定的可见模型（$($unboundVisible -join ', ')），请先编辑 codex/instructions/base-instructions/bindings.json 后再试。"
    }

    $prepArgs = @{
        CodexRoot = $stagedHome
        SourceCatalog = $officialPath
        StatePath = (Join-Path $stagedHome 'model-catalog.state.json')
    }
    $prepOutput = & (Join-Path $PSScriptRoot 'Prepare-ModelCatalog.ps1') @prepArgs 3>&1
    foreach ($entry in $prepOutput) { Add-Log ($entry.ToString()) }

    $generatedPath = Join-Path $stagedHome 'model-catalog.json'
    $generated = Get-Content -LiteralPath $generatedPath -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable
    $added = [Collections.Generic.List[string]]::new()
    $updated = [Collections.Generic.List[string]]::new()
    $removed = [Collections.Generic.List[string]]::new()
    $newIds = @($generated.models | ForEach-Object { $_.slug })
    foreach ($model in $generated.models) {
        if (-not $oldModels.ContainsKey($model.slug)) {
            $added.Add($model.slug)
            Add-Log "Added: $($model.slug)"
        }
        elseif (($oldModels[$model.slug] | ConvertTo-Json -Depth 100 -Compress) -cne ($model | ConvertTo-Json -Depth 100 -Compress)) {
            $updated.Add($model.slug)
            Add-Log "Updated: $($model.slug)"
        }
    }
    foreach ($slug in ($oldModels.Keys | Sort-Object)) {
        if ($slug -notin $newIds) {
            $removed.Add($slug)
            Add-Log "Removed from official catalog: $slug (any repository binding is retained)."
        }
    }
    foreach ($relative in $paths) {
        if ((Get-FileDigest $locations[$relative]) -ne $digests[$relative]) { throw "Local input changed during refresh: $relative. Retry after editing finishes." }
    }
    foreach ($name in $sourceDigests.Keys) {
        if ((Get-FileDigest (Join-Path $promptRoot $name)) -ne $sourceDigests[$name]) { throw "Repository input changed during refresh: $name. Retry after editing finishes." }
    }

    $changed = (Get-FileDigest $generatedPath) -ne $digests['model-catalog.json']
    $boundCount = @($generated.models | Where-Object { $bindings.Contains($_.slug) }).Count
    Add-Log "Result: $($generated.models.Count) models ($boundCount bound, $($hiddenKept.Count) hidden kept as-is); catalog changed=$changed."

    $changeParts = [Collections.Generic.List[string]]::new()
    if ($added.Count) { $changeParts.Add("新增 $($added.Count) 个") }
    if ($updated.Count) { $changeParts.Add("更新 $($updated.Count) 个") }
    if ($removed.Count) { $changeParts.Add("移除 $($removed.Count) 个") }
    if ($changed -and -not $changeParts.Count) { $changeParts.Add('目录内容有变更') }

    $details = [Collections.Generic.List[string]]::new()
    if ($added.Count) { $details.Add("新增模型：$($added -join ', ')") }
    if ($updated.Count) { $details.Add("更新模型：$($updated -join ', ')") }
    if ($removed.Count) { $details.Add("官方已移除：$($removed -join ', ')") }
    if ($hiddenKept.Count) { $details.Add("隐藏模型原样保留：$($hiddenKept -join ', ')") }

    if ($Check) {
        if ($changed) {
            $state = 'warning'
            $summary = "检测到目录变更（$($changeParts -join '、')），当前仅检查未写入；确认后点击「刷新模型目录」生效。"
        }
        else {
            $state = 'success'
            $summary = "已是最新（$($generated.models.Count) 个模型，$boundCount 个已绑定，$($hiddenKept.Count) 个隐藏模型原样保留）。"
        }
        Add-Log 'Preview only; no Codex files changed.'
        Emit-JsonResult -State $state -Summary $summary -Details $details
        return
    }

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

    Add-Log "Backup and fetched source: $stage"
    $summary = if ($changed) {
        "模型目录已更新（$($changeParts -join '、')），重启 Codex 后生效。"
    }
    else {
        "模型目录已是最新（$($generated.models.Count) 个模型），无需重启 Codex。"
    }
    Add-Log $summary
    Emit-JsonResult -State 'success' -Summary $summary -Details $details
}
catch {
    $msg = $_.Exception.Message
    $logs.Add("Model catalog refresh failed: $msg")
    if ($Json) {
        if (-not $jsonEmitted) {
            Emit-JsonResult -State 'failed' -Summary $msg -Details $failureDetails
        }
    }
    else {
        [Console]::Error.WriteLine("Model catalog refresh failed: $msg")
    }
    exit 1
}
finally {
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}
