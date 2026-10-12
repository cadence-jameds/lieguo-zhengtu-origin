$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'game'
$port = 8771
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
$listener.Start()
$url = "http://localhost:$port/"
Write-Host "Lieguo Playable #1 v0.30.11"
Write-Host "Open: $url"
Write-Host 'Keep this window open while playing. Close it to stop the local server.'
Start-Process $url
$types = @{'.html'='text/html; charset=utf-8';'.js'='text/javascript; charset=utf-8';'.css'='text/css; charset=utf-8';'.json'='application/json';'.svg'='image/svg+xml';'.png'='image/png';'.webp'='image/webp';'.ico'='image/x-icon';'.map'='application/json';'.woff2'='font/woff2'}
try {
 while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
   $stream = $client.GetStream()
   $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
   $line = $reader.ReadLine()
   if (-not $line) { continue }
   while ($reader.ReadLine()) {}
   $request = $line.Split(' ')
   $route = [System.Uri]::UnescapeDataString($request[1].Split('?')[0]).TrimStart('/')
   if (-not $route) { $route = 'index.html' }
   $path = [System.IO.Path]::GetFullPath((Join-Path $root $route))
   $safeRoot = [System.IO.Path]::GetFullPath($root) + [System.IO.Path]::DirectorySeparatorChar
   $ok = $path.StartsWith($safeRoot, [System.StringComparison]::OrdinalIgnoreCase) -and [System.IO.File]::Exists($path)
   if ($ok) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $type = $types[[System.IO.Path]::GetExtension($path)]
    if (-not $type) { $type = 'application/octet-stream' }
    $status = '200 OK'
   } else {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not found')
    $type = 'text/plain'
    $status = '404 Not Found'
   }
   $header = "HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
   $head = [System.Text.Encoding]::ASCII.GetBytes($header)
   $stream.Write($head, 0, $head.Length)
   if ($request[0] -ne 'HEAD') { $stream.Write($bytes, 0, $bytes.Length) }
   $stream.Flush()
  } catch { Write-Host "Request error: $($_.Exception.Message)" }
  finally { $client.Dispose() }
 }
} finally { $listener.Stop() }
