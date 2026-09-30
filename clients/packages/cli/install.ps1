& {
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$Repo = "polarsource/polar"
$TagPrefix = "@polar-sh/cli@"
$BinaryName = "polar.exe"
$Archive = "polar-windows-x64.zip"
$InstallDir = Join-Path $HOME ".polar\bin"
$Headers = @{ "User-Agent" = "polar-cli-installer" }

function Write-Info { param($Message) Write-Host "==> $Message" -ForegroundColor Green }
function Write-Warn { param($Message) Write-Host "warning: $Message" -ForegroundColor Yellow }
function Stop-Install { param($Message) throw "Polar CLI install failed: $Message" }

function Get-LatestRelease {
    $Latest = $null
    for ($Page = 1; $Page -le 10; $Page++) {
        $Releases = Invoke-RestMethod -Headers $Headers `
            -Uri "https://api.github.com/repos/$Repo/releases?per_page=100&page=$Page"
        if ($Releases.Count -eq 0) { break }
        foreach ($Release in $Releases) {
            if ($Release.draft -or $Release.prerelease) { continue }
            if (-not $Release.tag_name.StartsWith($TagPrefix)) { continue }
            $Parsed = $null
            $Number = $Release.tag_name.Substring($TagPrefix.Length)
            if (-not [version]::TryParse($Number, [ref]$Parsed)) { continue }
            if ($null -eq $Latest -or $Parsed -gt $Latest.Version) {
                $Latest = @{ Version = $Parsed; Tag = $Release.tag_name }
            }
        }
    }
    return $Latest
}

$Architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
if ($Architecture -ne "AMD64") {
    Stop-Install "Unsupported architecture: $Architecture. Only x64 is supported."
}

Write-Info "Finding the latest Polar CLI release..."
try {
    $Release = Get-LatestRelease
} catch {
    Stop-Install "Could not reach GitHub. Check your network connection."
}
if ($null -eq $Release) {
    Stop-Install "No Polar CLI release found."
}
Write-Info "Version: $($Release.Version)"

$BaseUrl = "https://github.com/$Repo/releases/download/$([uri]::EscapeDataString($Release.Tag))"
$TempDir = Join-Path $env:TEMP "polar-install-$([guid]::NewGuid())"
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

try {
    $ArchivePath = Join-Path $TempDir $Archive
    $ChecksumsPath = Join-Path $TempDir "checksums.txt"

    Write-Info "Downloading..."
    try {
        Invoke-WebRequest -Uri "$BaseUrl/$Archive" -OutFile $ArchivePath -UseBasicParsing
        Invoke-WebRequest -Uri "$BaseUrl/checksums.txt" -OutFile $ChecksumsPath -UseBasicParsing
    } catch {
        Stop-Install "Download failed. This release may not include a Windows build."
    }

    Write-Info "Verifying checksum..."
    $Expected = Get-Content $ChecksumsPath |
        Where-Object { ($_ -split '\s+')[1] -eq $Archive } |
        ForEach-Object { ($_ -split '\s+')[0].ToLower() } |
        Select-Object -First 1
    if (-not $Expected) {
        Stop-Install "No checksum found for $Archive."
    }
    $Actual = (Get-FileHash -Path $ArchivePath -Algorithm SHA256).Hash.ToLower()
    if ($Actual -ne $Expected) {
        Stop-Install "Checksum mismatch. Expected $Expected, got $Actual."
    }

    Write-Info "Installing to $InstallDir..."
    Expand-Archive -LiteralPath $ArchivePath -DestinationPath $TempDir -Force
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    try {
        Copy-Item -Path (Join-Path $TempDir $BinaryName) -Destination (Join-Path $InstallDir $BinaryName) -Force
    } catch {
        Stop-Install "Could not write $BinaryName. If polar is running, close it and try again."
    }

    $UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    $OnPath = ($UserPath -split ';') -contains $InstallDir
    if (-not $OnPath) {
        [Environment]::SetEnvironmentVariable("PATH", "$InstallDir;$UserPath", "User")
        $env:PATH = "$InstallDir;$env:PATH"
    }

    Write-Info "Polar CLI $($Release.Version) installed."
    Write-Host ""
    Write-Host "  Run 'polar --help' to get started."
    Write-Host ""
    if (-not $OnPath) {
        Write-Warn "Restart other open terminals so they pick up the new PATH."
    }
} finally {
    Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}
}
