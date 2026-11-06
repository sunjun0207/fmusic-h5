# Build a debug APK. If JAVA_HOME is still JDK 8, use Android Studio's bundled JDK 17.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Find-Jdk17 {
    $studioJbr = @(
        'E:\SunJun\develop-software\Andriod Studio\v-2024-1-1\Android Studio\jbr',
        "$env:LOCALAPPDATA\Programs\Android Studio\jbr",
        'C:\Program Files\Android\Android Studio\jbr'
    )
    foreach ($path in $studioJbr) {
        if (Test-Path (Join-Path $path 'bin\java.exe')) { return $path }
    }
    return $null
}

function Find-Sdk {
    if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) { return $env:ANDROID_HOME }
    if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) { return $env:ANDROID_SDK_ROOT }
    $candidates = @(
        'E:\SunJun\develop-software\Andriod Studio\Sdk',
        "$env:LOCALAPPDATA\Android\Sdk"
    )
    foreach ($path in $candidates) {
        if (Test-Path (Join-Path $path 'platform-tools\adb.exe')) { return $path }
    }
    return $null
}

$javaHome = $env:JAVA_HOME
$javaMajor = 0
if ($javaHome -match 'jdk1\.8|jdk-8|\\1\.8') {
    $javaMajor = 8
} elseif ($javaHome -and (Test-Path (Join-Path $javaHome 'release'))) {
    $release = Get-Content (Join-Path $javaHome 'release') -ErrorAction SilentlyContinue | Out-String
    if ($release -match 'JAVA_VERSION="1\.(\d+)') { $javaMajor = [int]$Matches[1] }
    elseif ($release -match 'JAVA_VERSION="(\d+)') { $javaMajor = [int]$Matches[1] }
}
if ($javaMajor -lt 17) {
    $jdk17 = Find-Jdk17
    if (-not $jdk17) { throw 'JDK 17 is required. Install Android Studio or point JAVA_HOME at JDK 17.' }
    $env:JAVA_HOME = $jdk17
    Write-Host "JAVA_HOME=$jdk17"
}

$sdk = Find-Sdk
if (-not $sdk) { throw 'Android SDK not found. Install it from Android Studio first.' }
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$sdkDir = ($sdk -replace '\\', '/')
Set-Content -Path (Join-Path $root 'android\local.properties') -Value "sdk.dir=$sdkDir" -Encoding ascii
Write-Host "ANDROID_HOME=$sdk"

npm run build:pro
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location (Join-Path $root 'android')
try {
    & .\gradlew.bat assembleDebug --no-daemon
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}

$built = Join-Path $root 'android\app\build\outputs\apk\debug\app-debug.apk'
$destDir = Join-Path $root 'apk'
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$dest = Join-Path $destDir 'fmusic-h5_1.0.10.apk'
Copy-Item $built $dest -Force
Write-Host "APK=$dest"
