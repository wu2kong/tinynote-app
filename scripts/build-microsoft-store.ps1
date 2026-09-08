$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not $IsWindows) { throw 'Build the MSIX on Windows with PowerShell 7.' }

function Invoke-Checked([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed with exit code $LASTEXITCODE" }
}

$identity = Get-Content 'src-tauri/msix/identity.json' -Raw | ConvertFrom-Json
foreach ($field in @('name', 'publisher', 'publisherDisplayName', 'displayName')) {
    if (-not $identity.$field) { throw "Missing Partner Center identity field: $field" }
}
$version = (Get-Content 'package.json' -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'MSIX requires a numeric release version.' }
$packageVersion = "$version.0"

# Pin the official fixed runtime: no install-time download or external installer is needed.
$runtimeVersion = '152.0.4191.62'
$runtimeUrl = 'https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/0a4a34d9-ccaa-4cef-98b4-58cb313fbfeb/Microsoft.WebView2.FixedVersionRuntime.152.0.4191.62.x64.cab'
$work = Join-Path ([System.IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
New-Item -ItemType Directory $work | Out-Null
try {
    $cab = Join-Path $work 'runtime.cab'
    Invoke-WebRequest -Uri $runtimeUrl -OutFile $cab
    $expanded = Join-Path $work 'expanded'
    New-Item -ItemType Directory $expanded | Out-Null
    Invoke-Checked 'expand.exe' @($cab, '-F:*', $expanded)
    $runtimeExe = Get-ChildItem $expanded -Filter 'msedgewebview2.exe' -Recurse | Select-Object -First 1
    if (-not $runtimeExe) { throw 'The official runtime archive has no WebView2 executable.' }
    $runtimeSignature = Get-AuthenticodeSignature $runtimeExe.FullName
    if ($runtimeSignature.Status -ne 'Valid' -or $runtimeSignature.SignerCertificate.Subject -notmatch 'Microsoft Corporation') {
        throw 'The WebView2 executable must have a valid Microsoft signature.'
    }
    if (Test-Path 'src-tauri/WebView2') { Remove-Item 'src-tauri/WebView2' -Recurse -Force }
    Copy-Item $runtimeExe.Directory.FullName 'src-tauri/WebView2' -Recurse

    $env:VITE_DISTRIBUTION = 'microsoft-store'
    Invoke-Checked 'npm.cmd' @('run', 'tauri', '--', 'build', '--no-bundle', '--features', 'microsoft-store', '--target', 'x86_64-pc-windows-msvc', '--config', 'src-tauri/tauri.microsoftstore.conf.json', '--', '--no-default-features')
    $stage = Join-Path $work 'package'
    New-Item -ItemType Directory "$stage/Assets" -Force | Out-Null
    Copy-Item 'src-tauri/target/x86_64-pc-windows-msvc/release/app.exe' "$stage/TinyNote.exe"
    Copy-Item 'src-tauri/WebView2' "$stage/WebView2" -Recurse
    foreach ($icon in @('Square44x44Logo.png', 'Square150x150Logo.png', 'StoreLogo.png')) {
        Copy-Item "src-tauri/icons/$icon" "$stage/Assets/$icon"
    }
    $manifest = Get-Content 'src-tauri/msix/AppxManifest.xml' -Raw
    foreach ($field in @('name', 'publisher', 'publisherDisplayName', 'displayName')) {
        $manifest = $manifest.Replace("{{$field}}", [System.Security.SecurityElement]::Escape($identity.$field))
    }
    $manifest.Replace('{{version}}', $packageVersion) | Set-Content "$stage/AppxManifest.xml" -Encoding utf8
    $makeAppx = Get-ChildItem "${env:ProgramFiles(x86)}/Windows Kits/10/bin/*/x64/makeappx.exe" |
        Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
    if (-not $makeAppx) { throw 'Install the Windows SDK MSIX packaging tools.' }
    $out = 'dist-packages/microsoft-store'
    New-Item -ItemType Directory -Force $out | Out-Null
    $package = "$out/TinyNote_${packageVersion}_x64.msix"
    Invoke-Checked $makeAppx @('pack', '/d', $stage, '/p', $package, '/o')
    Copy-Item "$stage/AppxManifest.xml" "$out/AppxManifest.xml"
    [ordered]@{
        version = $packageVersion
        architecture = 'x64'
        sha256 = (Get-FileHash $package -Algorithm SHA256).Hash
        webview2Version = $runtimeVersion
        signing = 'Unsigned Microsoft Store submission package; Microsoft signs on distribution.'
        commerce = 'Dodo Payments; existing website licenses'
        updates = 'Microsoft Store'
    } | ConvertTo-Json | Set-Content "$out/package-report.json" -Encoding utf8
    Write-Host "Microsoft Store submission package: $package"
} finally {
    Remove-Item $work -Recurse -Force
}
