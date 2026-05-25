# EDITH — GitHub App secret loader
# Run from D:\desktop\edith via:
#   .\scripts\setup-github-app.ps1
#
# Prompts for each value (masked for secrets), reads your .pem file, formats
# the private key as a single line with literal \n, and updates .env.local
# in place. Nothing is echoed back or written to logs.

param(
  [string]$EnvFile = "$PSScriptRoot\..\.env.local"
)

function Read-Secret($label) {
  $sec = Read-Host -AsSecureString -Prompt $label
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Read-Plain($label) {
  return (Read-Host -Prompt $label).Trim()
}

function Update-EnvLine([string]$content, [string]$key, [string]$value) {
  # In -replace's substitution string, only `$` is special (for backrefs).
  # `\` is literal. So we only need to escape `$`.
  $escapedValue = $value -replace '\$', '$$$$'
  $re = "(?m)^${key}=.*$"
  if ($content -match $re) {
    return [regex]::Replace($content, $re, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) "${key}=$value" })
  } else {
    return $content + "`n$key=$value`n"
  }
}

if (-not (Test-Path $EnvFile)) {
  Write-Host "Could not find $EnvFile" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "EDITH GitHub App setup" -ForegroundColor Cyan
Write-Host "----------------------" -ForegroundColor Cyan
Write-Host "Values you'll be asked for (find them on https://github.com/settings/apps/edith-bot-dev):"
Write-Host "  1. App ID (number at the top of the App's settings page)"
Write-Host "  2. Client ID"
Write-Host "  3. Client Secret (regenerate at the bottom if needed)"
Write-Host "  4. Webhook Secret (the hex string you set when creating the App)"
Write-Host "  5. Path to the .pem private-key file you downloaded"
Write-Host ""

$appId       = Read-Plain  "App ID"
$clientId    = Read-Plain  "Client ID"
$clientSec   = Read-Secret "Client Secret"
$webhookSec  = Read-Secret "Webhook Secret"
$pemPath     = Read-Plain  "Full path to .pem file (drag the file into this window)"
$pemPath     = $pemPath.Trim('"').Trim("'")

if (-not (Test-Path $pemPath)) {
  Write-Host "File not found: $pemPath" -ForegroundColor Red
  exit 1
}

$pem = Get-Content $pemPath -Raw
$pemOneLine = $pem -replace "`r`n", "\n" -replace "`n", "\n"
# Trim trailing \n if present.
$pemOneLine = $pemOneLine.TrimEnd("\n").TrimEnd("\")

$content = Get-Content $EnvFile -Raw
$content = Update-EnvLine $content "GITHUB_APP_ID"             $appId
$content = Update-EnvLine $content "GITHUB_APP_CLIENT_ID"      $clientId
$content = Update-EnvLine $content "GITHUB_APP_CLIENT_SECRET"  $clientSec
$content = Update-EnvLine $content "GITHUB_APP_WEBHOOK_SECRET" $webhookSec
$content = Update-EnvLine $content "GITHUB_APP_PRIVATE_KEY"    $pemOneLine

# Write back as UTF-8 (no BOM) — Node reads this correctly.
[IO.File]::WriteAllText((Resolve-Path $EnvFile), $content, [Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "Done. Wrote 5 keys to $EnvFile" -ForegroundColor Green
Write-Host "Now restart the dev server in your other terminal:" -ForegroundColor Cyan
Write-Host '   Ctrl+C, then:  $env:NODE_OPTIONS = "--use-system-ca --max-old-space-size=4096"; pnpm dev' -ForegroundColor Gray
Write-Host ""
