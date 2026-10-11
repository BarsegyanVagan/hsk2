<#
  Скачивает данные о порядке черт для всех иероглифов из data/words.json
  в один файл data/strokes.json (нужен интернет).
  Источник: пакет hanzi-writer-data (Make Me a Hanzi, лицензия Arphic Public License).
  С ключом -Vendor также скачивает библиотеку Hanzi Writer в js/vendor/.

  Запуск: powershell -ExecutionPolicy Bypass -File scripts\fetch-strokes.ps1 [-Vendor]
#>
param([switch]$Vendor)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root     = Split-Path -Parent $PSScriptRoot
$dataUrl  = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1'
$libUrl   = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3'
$utf8     = New-Object System.Text.UTF8Encoding $false

function Get-Text([string]$url) {
  $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 30
  return $utf8.GetString($r.RawContentStream.ToArray())
}

if ($Vendor) {
  $vendorDir = Join-Path $root 'js\vendor'
  New-Item -ItemType Directory -Force $vendorDir | Out-Null
  foreach ($f in @(
      @{ url = "$libUrl/dist/hanzi-writer.min.js"; out = 'hanzi-writer.min.js' },
      @{ url = "$libUrl/LICENSE";                  out = 'hanzi-writer-LICENSE.txt' },
      @{ url = "$libUrl/COPYING.md";               out = 'hanzi-writer-COPYING.md' },
      @{ url = "$dataUrl/ARPHICPL.TXT";            out = 'ARPHICPL.TXT' })) {
    [IO.File]::WriteAllText((Join-Path $vendorDir $f.out), (Get-Text $f.url), $utf8)
    Write-Host "js/vendor/$($f.out)"
  }
}

$wordsFile = Join-Path $root 'data\words.json'
$json  = [IO.File]::ReadAllText($wordsFile, [Text.Encoding]::UTF8)
$words = $json | ConvertFrom-Json
$chars = New-Object System.Collections.Generic.List[string]
foreach ($w in $words) {
  foreach ($ch in $w.hanzi.ToCharArray()) {
    $code = [int]$ch
    if ($code -ge 0x3400 -and $code -le 0x9FFF -and -not $chars.Contains([string]$ch)) { $chars.Add([string]$ch) }
  }
}

Write-Host "Иероглифов: $($chars.Count). Скачиваю данные черт..."
$entries = New-Object System.Collections.Generic.List[string]
$missing = New-Object System.Collections.Generic.List[string]
$i = 0
foreach ($ch in $chars) {
  $i++
  try {
    $data = (Get-Text "$dataUrl/$([Uri]::EscapeDataString($ch)).json").Trim()
    if (-not $data.StartsWith('{')) { throw 'bad data' }
    $entries.Add('"' + $ch + '":' + $data)
  } catch {
    $missing.Add($ch)
  }
  if ($i % 25 -eq 0) { Write-Host "  $i / $($chars.Count)" }
}

if ($entries.Count -eq 0) {
  Write-Host 'Не удалось скачать данные (нет интернета?). data/strokes.json не изменён.' -ForegroundColor Red
  exit 1
}
$out = Join-Path $root 'data\strokes.json'
[IO.File]::WriteAllText($out, '{' + ($entries -join ",`n") + "}`n", $utf8)
Write-Host "Готово: data/strokes.json ($($entries.Count) иероглифов, $([math]::Round((Get-Item $out).Length / 1KB)) КБ)" -ForegroundColor Green
if ($missing.Count -gt 0) { Write-Host "Нет данных для: $($missing -join ' ')" -ForegroundColor Yellow }
