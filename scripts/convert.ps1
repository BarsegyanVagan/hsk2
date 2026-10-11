<#
  Конвертер слов: hsk_2_1_15.txt -> data/words.json

  Запуск (Windows): двойной клик по update-words.cmd в корне проекта
  или:  powershell -ExecutionPolicy Bypass -File scripts\convert.ps1
  Свои пути:  ... -File scripts\convert.ps1 -InputFile my.txt -OutputFile data\words.json

  Формат входного файла:
    УРОК N
    иероглифы   пиньинь   перевод
      > пример по-китайски | пиньинь примера | перевод примера   (необязательно)
  Пометки перед иероглифами:
    ★ (или *)  слово сверх программы HSK 2
    @          имя собственное
  Строки из ===== и ----- и пустые строки пропускаются.

  Как разбирается строка слова:
    - иероглифы: непрерывный блок китайских символов в начале строки
      (плюс точки и многоточия, например 一边...一边...);
    - перевод: начинается с первого слова, содержащего кириллицу;
    - пиньинь: всё, что между ними (может содержать пробелы: chī yào, shénme shíhou).
  Поэтому выравнивание колонок не важно, достаточно хотя бы одного пробела
  между колонками.
#>
param(
  [string]$InputFile,
  [string]$OutputFile
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch {}

$root = Split-Path -Parent $PSScriptRoot
if (-not $InputFile)  { $InputFile  = Join-Path $root 'hsk_2_1_15.txt' }
if (-not $OutputFile) { $OutputFile = Join-Path (Join-Path $root 'data') 'words.json' }
$InputFile  = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($InputFile)
$OutputFile = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputFile)

if (-not (Test-Path -LiteralPath $InputFile)) {
  Write-Host "Не найден файл со словами: $InputFile" -ForegroundColor Red
  exit 1
}

# Регулярки записаны через \u, чтобы не зависеть от кодировки самого скрипта.
$cjk        = '㐀-䶿一-鿿豈-﫿'
$hanziChars = "[$cjk、-〿！-￯\.…·-]"
$reWord     = "^\s*(?<marks>[★☆*@]*)\s*(?<hanzi>[$cjk]$hanziChars*)(?<rest>\s.*)?$"
$reExample  = '^\s*>\s*(?<ex>.+)$'
$reLesson   = '^\s*УРОК\s+(?<n>\d+)\s*$'   # "УРОК N"
$reSkip     = '^\s*([=\-_*~])\1{2,}\s*$'                      # =====, -----
$reCyrillic = '[Ѐ-ӿ]'

$lines   = [IO.File]::ReadAllLines($InputFile, [Text.Encoding]::UTF8)
$words   = New-Object System.Collections.Generic.List[object]
$errors  = New-Object System.Collections.Generic.List[string]
$lesson  = $null
$seenLessons = @{}

for ($ln = 0; $ln -lt $lines.Length; $ln++) {
  $line = $lines[$ln].Replace([string][char]0xFEFF, '').TrimEnd()
  $num  = $ln + 1

  if ($line.Trim() -eq '' -or $line -match $reSkip) { continue }

  $m = [regex]::Match($line, $reLesson, 'IgnoreCase')
  if ($m.Success) {
    $lesson = [int]$m.Groups['n'].Value
    if ($seenLessons.ContainsKey($lesson)) {
      Write-Host "Внимание: заголовок урока $lesson встречается повторно (строка $num)" -ForegroundColor Yellow
    }
    $seenLessons[$lesson] = $true
    continue
  }

  # Пример к предыдущему слову: "> 句子 | jùzi | перевод"
  $m = [regex]::Match($line, $reExample)
  if ($m.Success -and $null -ne $lesson) {
    $parts = @($m.Groups['ex'].Value.Split('|') | ForEach-Object { $_.Trim() })
    if ($words.Count -eq 0) { $errors.Add("строка ${num}: пример стоит до первого слова"); continue }
    if ($parts.Count -ne 3 -or ($parts | Where-Object { -not $_ })) {
      $errors.Add("строка ${num}: пример должен быть в виде «иероглифы | пиньинь | перевод»: '$line'"); continue
    }
    $last = $words[$words.Count - 1]
    if ($last.example) { $errors.Add("строка ${num}: у слова $($last.hanzi) уже есть пример"); continue }
    $last.example = [pscustomobject]@{ zh = $parts[0]; py = $parts[1]; ru = $parts[2] }
    continue
  }

  $m = [regex]::Match($line, $reWord)
  if (-not $m.Success) {
    # Строки до первого урока (общий заголовок файла) игнорируются.
    if ($null -ne $lesson) { $errors.Add("строка ${num}: не похоже на слово: '$line'") }
    continue
  }
  if ($null -eq $lesson) {
    $errors.Add("строка ${num}: слово стоит до первого заголовка «УРОК N»")
    continue
  }

  $marks = $m.Groups['marks'].Value
  $hanzi = $m.Groups['hanzi'].Value.Trim()
  $rest  = $m.Groups['rest'].Value
  $pinyin = ''
  $translation = ''

  $c = [regex]::Match($rest, $reCyrillic)
  if ($c.Success) {
    # Отступаем к началу слова, в котором нашлась кириллица (чтобы не потерять «, ( и т.п.)
    $i = $c.Index
    while ($i -gt 0 -and -not [char]::IsWhiteSpace($rest[$i - 1])) { $i-- }
    $pinyin      = $rest.Substring(0, $i)
    $translation = $rest.Substring($i)
  } else {
    # Перевод без кириллицы: делим по двум и более пробелам
    $parts = ([regex]'\s{2,}').Split($rest.Trim(), 2)
    $pinyin = $parts[0]
    if ($parts.Length -eq 2) { $translation = $parts[1] }
  }

  $pinyin      = ([regex]::Replace($pinyin, '\s+', ' ')).Trim()
  $translation = ([regex]::Replace($translation, '\s+', ' ')).Trim()

  if (-not $pinyin)      { $errors.Add("строка ${num}: пустой пиньинь: '$line'"); continue }
  if (-not $translation) { $errors.Add("строка ${num}: пустой перевод: '$line'"); continue }
  if ($pinyin -match "[$cjk]|$reCyrillic" -or $pinyin -notmatch '\p{L}') {
    $errors.Add("строка ${num}: странный пиньинь '$pinyin': '$line'"); continue
  }

  $words.Add([pscustomobject]@{
    lesson      = $lesson
    hanzi       = $hanzi
    pinyin      = $pinyin
    translation = $translation
    extra       = ($marks -match '[★☆*]')
    proper      = ($marks -match '@')
    example     = $null
  })
}

if ($errors.Count -gt 0) {
  Write-Host "Ошибки разбора ($($errors.Count)):" -ForegroundColor Red
  $errors | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  Write-Host 'words.json НЕ записан.' -ForegroundColor Red
  exit 1
}
if ($words.Count -eq 0) {
  Write-Host 'Не найдено ни одного слова. words.json НЕ записан.' -ForegroundColor Red
  exit 1
}

function ConvertTo-JsonString([string]$s) {
  $s = $s.Replace('\', '\\').Replace('"', '\"')
  $s = [regex]::Replace($s, '[\x00-\x1F]', { param($x) '\u{0:x4}' -f [int][char]$x.Value })
  return '"' + $s + '"'
}

$jsonLines = foreach ($w in $words) {
  $line = '  { "lesson": ' + $w.lesson +
    ', "hanzi": '       + (ConvertTo-JsonString $w.hanzi) +
    ', "pinyin": '      + (ConvertTo-JsonString $w.pinyin) +
    ', "translation": ' + (ConvertTo-JsonString $w.translation)
  if ($w.extra)  { $line += ', "extra": true' }
  if ($w.proper) { $line += ', "proper": true' }
  if ($w.example) {
    $line += ', "example": { "zh": ' + (ConvertTo-JsonString $w.example.zh) +
      ', "py": ' + (ConvertTo-JsonString $w.example.py) +
      ', "ru": ' + (ConvertTo-JsonString $w.example.ru) + ' }'
  }
  $line + ' }'
}
$json = "[`n" + ($jsonLines -join ",`n") + "`n]`n"

$outDir = Split-Path -Parent $OutputFile
if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Force $outDir | Out-Null }
[IO.File]::WriteAllText($OutputFile, $json, (New-Object System.Text.UTF8Encoding $false))

# Сводка для сверки
$groups = $words | Group-Object lesson | Sort-Object { [int]$_.Name }
$summary = ($groups | ForEach-Object { "У$($_.Name): $($_.Count)" }) -join ', '
$emptyLessons = $seenLessons.Keys | Where-Object { -not ($words | Where-Object lesson -eq $_) }
$extraCount   = @($words | Where-Object extra).Count
$properCount  = @($words | Where-Object proper).Count
$noExample    = @($words | Where-Object { -not $_.example })
$unique       = @($words | ForEach-Object { "$($_.hanzi)|$($_.pinyin)" } | Sort-Object -Unique).Count

Write-Host "Готово: $OutputFile" -ForegroundColor Green
Write-Host "Карточек: $($words.Count) (разных слов: $unique), уроков: $($groups.Count)"
Write-Host $summary
Write-Host "★ сверх программы: $extraCount, имён собственных: $properCount, с примерами: $($words.Count - $noExample.Count)"
if ($noExample.Count -gt 0) { Write-Host "Без примера: $(($noExample | ForEach-Object { $_.hanzi }) -join ', ')" -ForegroundColor Yellow }
foreach ($e in $emptyLessons) { Write-Host "Внимание: в уроке $e нет ни одного слова" -ForegroundColor Yellow }
