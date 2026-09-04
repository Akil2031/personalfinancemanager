param(
    [string]$ProjectRoot = (Get-Location).Path,
    [double]$Scale = 1.18
)

$ErrorActionPreference = 'Stop'

if ($Scale -lt 1.05 -or $Scale -gt 1.35) {
    throw "Scale should normally be between 1.05 and 1.35. Current value: $Scale"
}

$roots = @(
    (Join-Path $ProjectRoot 'app'),
    (Join-Path $ProjectRoot 'src')
)

$files = foreach ($root in $roots) {
    if (Test-Path $root) {
        Get-ChildItem -Path $root -Recurse -File -Include *.tsx,*.ts,*.jsx,*.js |
            Where-Object { $_.FullName -notmatch '\\node_modules\\' }
    }
}
$files = $files | Sort-Object FullName -Unique

if (-not $files) {
    throw "No app/src TypeScript or JavaScript files were found under: $ProjectRoot"
}

$utf8 = New-Object System.Text.UTF8Encoding($false)

function New-ScaledFontSize([string]$value) {
    $number = [double]$value
    $scaled = [math]::Round($number * $Scale, 0)
    if ($number -ge 10 -and $scaled -lt 12) { $scaled = 12 }
    return [int]$scaled
}

$changed = 0
$total = 0
$backupRoot = Join-Path $ProjectRoot '.pfm-font-backup-v3'

foreach ($file in $files) {
    $original = [System.IO.File]::ReadAllText($file.FullName, $utf8)
    $text = $original

    $text = [regex]::Replace($text, '(?m)(fontSize\s*:\s*)(\d+(?:\.\d+)?)', {
        param($m)
        $m.Groups[1].Value + (New-ScaledFontSize $m.Groups[2].Value)
    })

    $text = [regex]::Replace($text, '(?m)(fontSize\s*=\s*\{\s*)(\d+(?:\.\d+)?)(\s*\})', {
        param($m)
        $m.Groups[1].Value + (New-ScaledFontSize $m.Groups[2].Value) + $m.Groups[3].Value
    })

    if ($text -ne $original) {
        $relative = $file.FullName.Substring($ProjectRoot.TrimEnd('\').Length).TrimStart('\')
        $backup = Join-Path $backupRoot $relative
        $backupDir = Split-Path $backup -Parent

        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        [System.IO.File]::WriteAllText($backup, $original, $utf8)
        [System.IO.File]::WriteAllText($file.FullName, $text, $utf8)
        $changed++
    }

    $total++
}

Write-Host "PFM Typography Upgrade complete." -ForegroundColor Green
Write-Host ("Scanned files : " + $total)
Write-Host ("Changed files : " + $changed)
Write-Host ("Scale         : " + $Scale + " (18% default)")
Write-Host "Encoding      : UTF-8 explicit"
Write-Host ("Backup folder : " + $backupRoot)
Write-Host ""
Write-Host "Run this only once on a given source."
Write-Host "Next step: npx expo start --clear"
