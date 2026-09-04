param(
    [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'

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

# Keep this script ASCII-only. This prevents the repair script itself from
# being affected by source-file encoding problems.
$utf8 = New-Object System.Text.UTF8Encoding($false)
$cp1252 = [System.Text.Encoding]::GetEncoding(1252)

function Get-MojibakeScore([string]$value) {
    $score = 0

    foreach ($ch in $value.ToCharArray()) {
        $n = [int][char]$ch

        # Common characters seen when UTF-8 bytes were decoded as CP1252.
        if ($n -eq 0x00E2 -or
            $n -eq 0x00C3 -or
            $n -eq 0x00C2 -or
            $n -eq 0x00F0 -or
            $n -eq 0x00EF -or
            $n -eq 0x0092 -or
            $n -eq 0x0093 -or
            $n -eq 0x0094 -or
            $n -eq 0xFFFD) {
            $score++
        }
    }

    return $score
}

function Repair-Mojibake([string]$text) {
    $beforeScore = Get-MojibakeScore $text

    if ($beforeScore -eq 0) {
        return $text
    }

    try {
        # Re-encode the incorrectly decoded text as CP1252 and decode those
        # bytes as UTF-8. This recovers common corrupted Unicode characters.
        $bytes = $cp1252.GetBytes($text)
        $candidate = $utf8.GetString($bytes)
        $afterScore = Get-MojibakeScore $candidate

        if ($candidate.IndexOf([char]0xFFFD) -lt 0 -and $afterScore -lt $beforeScore) {
            return $candidate
        }
    }
    catch {
        # Leave the file unchanged when a safe conversion is not possible.
    }

    return $text
}

$changed = 0
$total = 0
$backupRoot = Join-Path $ProjectRoot '.pfm-encoding-backup-v3'

foreach ($file in $files) {
    # Explicit UTF-8 is critical. Do not use Get-Content or Set-Content
    # without an Encoding argument in Windows PowerShell 5.1.
    $original = [System.IO.File]::ReadAllText($file.FullName, $utf8)
    $text = Repair-Mojibake $original

    if ($text -ne $original) {
        $relative = $file.FullName.Substring($ProjectRoot.TrimEnd('\').Length).TrimStart('\')
        $backup = Join-Path $backupRoot $relative
        $backupDir = Split-Path $backup -Parent

        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        [System.IO.File]::WriteAllText($backup, $original, $utf8)
        [System.IO.File]::WriteAllText($file.FullName, $text, $utf8)

        $changed++
        Write-Host ("Fixed: " + $relative)
    }

    $total++
}

Write-Host ""
Write-Host "PFM UTF-8 encoding repair complete." -ForegroundColor Green
Write-Host ("Scanned files : " + $total)
Write-Host ("Changed files : " + $changed)
Write-Host ("Backup folder : " + $backupRoot)
Write-Host ""
Write-Host "Font sizes were NOT changed." -ForegroundColor Yellow
Write-Host "Run: npx expo start --clear"
