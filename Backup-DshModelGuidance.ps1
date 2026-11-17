#requires -Version 7.0
[CmdletBinding()]
param(
    [switch]$Check,
    [string]$DshRoot = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' })
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $DshRoot 'profiles/desktop/cordis.patch.yml'
$target = Join-Path $PSScriptRoot 'deepseek-harness/instructions/model-guidance.json'
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    Write-Output 'DSH Desktop configuration not found; existing backup retained.'
    return
}

$uv = Get-Command uv -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
$uvPath = if ($uv) { $uv.Source } else { 'C:/Users/jnkyl/.local/bin/uv.exe' }
if (-not (Test-Path -LiteralPath $uvPath -PathType Leaf)) { throw 'uv is required to read the DSH YAML configuration.' }

# BaseLoader preserves prompt text as strings and does not execute DSH-specific YAML tags.
$extract = @'
import json
import sys
from pathlib import Path

import yaml

patch = yaml.load(Path(sys.argv[1]).read_text(encoding="utf-8-sig"), Loader=yaml.BaseLoader)
entries = [
    entry for entry in (patch or [])
    if isinstance(entry, dict) and entry.get("id") == "local-model-guidance"
]
if len(entries) > 1:
    sys.exit("Multiple local-model-guidance entries; backup not updated.")
data = entries[0].get("config", {}).get("data") if entries else None
if data is None:
    print("null")
else:
    guides = {
        key: {"name": guide["name"], "text": guide["text"]}
        for key, guide in data.get("guides", {}).items()
    }
    bindings = data.get("bindings", {})
    print(json.dumps({"guides": guides, "bindings": bindings}, indent=2, sort_keys=True))
'@

$output = & $uvPath run --no-project --with 'PyYAML==6.0.3' python -c $extract $source
if ($LASTEXITCODE -ne 0) { throw 'Could not read DSH model guidance; existing backup retained.' }
if ($output -ceq 'null') {
    Write-Output 'No saved model guidance found; existing backup retained.'
    return
}

# Keep native stdout ASCII-safe, then render readable Unicode in the UTF-8 file.
$data = ($output -join "`n") | ConvertFrom-Json -AsHashtable
$json = ($data | ConvertTo-Json -Depth 10) + "`n"
if ((Test-Path -LiteralPath $target) -and [IO.File]::ReadAllText($target) -ceq $json) {
    Write-Output 'DSH model guidance backup is up to date.'
    return
}
Write-Output "UPDATE: $target"
if (-not $Check) { [IO.File]::WriteAllText($target, $json) }
