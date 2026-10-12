param([string]$Root = 'G:\Projects\Lieguo')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $Root
$base = '4ed0f1073aafbc675b24bf8351818e76a45a76a9'
$branch = (git branch --show-current).Trim()
$commit = (git rev-parse HEAD).Trim()
if ($branch -ne 'work/r3-browser-verification' -or $commit -eq $base) { throw 'Expected the new delta commit on the verification branch.' }
if (@(git status --porcelain).Count -ne 0) { throw 'Tracked/untracked source must be clean before sealing.' }
$out = Join-Path $Root 'artifacts/r3-browser-delta-2026-10-13'
New-Item -ItemType Directory -Path $out -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$source = Join-Path $out 'R3_Browser_Delta_Source.zip'
$bundle = Join-Path $out 'R3_Browser_Delta.bundle'
$evidence = Join-Path $out 'R3_Browser_Delta_Evidence.zip'
foreach ($target in @($source,$bundle,$evidence)) { if (Test-Path -LiteralPath $target) { throw "Refusing to overwrite existing seal: $target" } }
git archive --format=zip "--output=$source" $commit
if ($LASTEXITCODE -ne 0) { throw 'git archive failed' }
git bundle create $bundle $branch
if ($LASTEXITCODE -ne 0) { throw 'git bundle create failed' }
git bundle verify $bundle
if ($LASTEXITCODE -ne 0) { throw 'git bundle verify failed' }
git merge-base --is-ancestor $base $commit
if ($LASTEXITCODE -ne 0) { throw 'Original R3 baseline is not an ancestor.' }
$manifestPath = Join-Path $Root 'docs/validation/r3-delta-2026-10-12/manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$zip = [System.IO.Compression.ZipFile]::Open($evidence,[System.IO.Compression.ZipArchiveMode]::Create)
try {
 foreach ($row in $manifest.files) {
  $file = Join-Path $Root $row.path
  $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $row.sha256) { throw "Evidence changed: $($row.path)" }
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file,$row.path,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
 }
 [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$manifestPath,'docs/validation/r3-delta-2026-10-12/manifest.json',[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
} finally { $zip.Dispose() }
Write-Output 'Evidence packaged; checking every archived file SHA256.'
$read = [System.IO.Compression.ZipFile]::OpenRead($evidence)
$bytes = [long]0
try {
 foreach ($row in $manifest.files) {
  $entry = $read.GetEntry($row.path)
  if ($null -eq $entry -or $entry.Length -ne $row.bytes) { throw "Evidence entry mismatch: $($row.path)" }
  $stream = $entry.Open(); $sha = [System.Security.Cryptography.SHA256]::Create()
  try { $hash = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant() } finally { $stream.Dispose(); $sha.Dispose() }
  if ($hash -ne $row.sha256) { throw "Archived evidence hash mismatch: $($row.path)" }
  $bytes += $entry.Length
 }
 $entryCount = $read.Entries.Count
} finally { $read.Dispose() }
$srcRead = [System.IO.Compression.ZipFile]::OpenRead($source)
try {
 $sourceEntries = @($srcRead.Entries | Where-Object { $_.Name })
 $bad = @($sourceEntries | Where-Object { $_.FullName -like 'artifacts/*' -or $_.FullName -like 'node_modules/*' -or $_.FullName -like 'docs/validation/*.zip' })
 if ($bad.Count -gt 0) { throw 'Ignored artifacts accidentally entered source archive.' }
 $sourceCount = $sourceEntries.Count
 $sourceMax = ($sourceEntries | Measure-Object Length -Maximum).Maximum
} finally { $srcRead.Dispose() }
$verification = [ordered]@{commit=$commit;baseline=$base;baselineIsAncestor=$true;bundleVerified=$true;evidenceEntries=$entryCount;evidenceFilesSHA256Verified=$manifest.files.Count;evidenceUncompressedBytes=$bytes;sourceFileEntries=$sourceCount;sourceLargestFileBytes=$sourceMax;ignoredTracesExcludedFromGit=$true}
$verification | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $out 'archive-verification.json') -Encoding utf8
Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $out 'raw-evidence-manifest.json')
$report = Get-Content -LiteralPath 'docs/validation/r3-delta-2026-10-12/REPORT.md' -Raw
($report + "`n`nFinal sealed commit: $commit`n封存驗證：archive-verification.json；完整檔案校驗：SHA256SUMS。`n") | Set-Content -LiteralPath (Join-Path $out 'Browser_Delta_Fix_Report.md') -Encoding utf8
$artifacts = @($source,$bundle,$evidence) | ForEach-Object { [ordered]@{file=[System.IO.Path]::GetFileName($_);bytes=(Get-Item -LiteralPath $_).Length;sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()} }
$checkpoint = [ordered]@{project=$Root;branch=$branch;commit=$commit;baseline=$base;version='0.30.49';scope='R3 Browser Delta only';createdAt=(Get-Date).ToString('o');browser='Chrome 154.0.8037.98 / Playwright 1.64.0';regression=@{targetedPassed=140;r3Passed=1095;r3Skipped=1;r3Failed=0;baselineLegacyArtFailures=3};typecheck='PASS';productionBuild='PASS';chromeGovernanceApplications='36/36 committed across 6 speed/load cases';saveLoadRecovery='PASS, no final impact replay';physicalPhone='MANUAL PENDING';astraGate='NOT DECLARED PASS';artifacts=$artifacts;verification=$verification;evidenceManifest='raw-evidence-manifest.json';report='Browser_Delta_Fix_Report.md';sha256Manifest='SHA256SUMS'}
$checkpoint | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $out 'checkpoint.json') -Encoding utf8
$sealed = @('R3_Browser_Delta_Source.zip','R3_Browser_Delta.bundle','R3_Browser_Delta_Evidence.zip','raw-evidence-manifest.json','Browser_Delta_Fix_Report.md','archive-verification.json','checkpoint.json')
$sums = foreach ($file in $sealed) { $hash=(Get-FileHash -LiteralPath (Join-Path $out $file) -Algorithm SHA256).Hash.ToLowerInvariant(); "$hash  $file" }
$sums | Set-Content -LiteralPath (Join-Path $out 'SHA256SUMS') -Encoding ascii
Write-Output ($checkpoint | ConvertTo-Json -Depth 10)
