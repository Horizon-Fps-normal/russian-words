$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

while (($line = [Console]::In.ReadLine()) -ne $null) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $request = $null
  try {
    $request = $line | ConvertFrom-Json
    $method = if ($request.method) { [string]$request.method } else { "Get" }
    $timeoutSec = if ($request.timeoutSec) { [int]$request.timeoutSec } else { 45 }
    $invokeArgs = @{
      UseBasicParsing = $true
      Uri = $request.url
      Method = $method
      TimeoutSec = $timeoutSec
    }
    if ($request.headers) {
      $headers = @{}
      foreach ($property in $request.headers.PSObject.Properties) {
        $headers[$property.Name] = [string]$property.Value
      }
      $invokeArgs.Headers = $headers
    }
    if ($request.body) {
      $body = @{}
      foreach ($property in $request.body.PSObject.Properties) {
        $body[$property.Name] = [string]$property.Value
      }
      $invokeArgs.Body = $body
    }
    $response = Invoke-WebRequest @invokeArgs
    $result = [ordered]@{
      id = $request.id
      ok = $true
      status = [int]$response.StatusCode
      body = [string]$response.Content
    }
  } catch {
    $status = 0
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $status = [int]$_.Exception.Response.StatusCode
    }
    $result = [ordered]@{
      id = $request.id
      ok = $false
      status = $status
      error = [string]$_.Exception.Message
    }
  }
  [Console]::Out.WriteLine(($result | ConvertTo-Json -Compress -Depth 5))
  [Console]::Out.Flush()
}
