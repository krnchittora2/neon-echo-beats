# Packages the game for Poki: dist/neon-echo-poki.zip with index.html at the zip root.
# Usage (from repo root):  powershell -ExecutionPolicy Bypass -File scripts/build-poki.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$root  = Split-Path -Parent $PSScriptRoot
$dist  = Join-Path $root 'dist'
$zip   = Join-Path $dist 'neon-echo-poki.zip'
$files = @('index.html', 'style.css', 'game.js', 'poki.js', 'favicon.ico',
           'fonts/orbitron-latin.woff2', 'fonts/OFL.txt')

New-Item -ItemType Directory -Force $dist | Out-Null
if (Test-Path $zip) { Remove-Item $zip -Confirm:$false }

$archive = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
try {
    foreach ($f in $files) {
        $src = Join-Path $root $f
        if (-not (Test-Path $src)) { throw "Missing file: $f" }
        # forward slashes so paths survive on non-Windows servers
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive, $src, $f.Replace('\', '/'), 'Optimal')
    }
} finally { $archive.Dispose() }

$kb = [math]::Round((Get-Item $zip).Length / 1KB, 1)
Write-Host "Built $zip ($kb KB, $($files.Count) files)"
