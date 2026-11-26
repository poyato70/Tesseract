import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";

const windows = process.platform === "win32";
const powershell = process.env.TESSERACT_TEST_POWERSHELL ?? "powershell.exe";

it.skipIf(!windows)("sanitizes endpoints and classifies proxy, DNS, TLS, timeout, and HTTP failures", () => {
  const script = String.raw`
$ErrorActionPreference = 'Stop'
Import-Module $env:TESSERACT_PREFLIGHT_MODULE -Force
$label = Get-SafeEndpointLabel 'https://user:private-token@example.invalid/private/path?secret=private-query'
if ($label -ne 'https://example.invalid') { throw 'endpoint was not sanitized' }
$cases = [ordered]@{
  ProxyNameResolutionFailure = 'proxy'
  NameResolutionFailure = 'dns'
  TrustFailure = 'tls'
  SecureChannelFailure = 'tls'
  Timeout = 'timeout'
  ConnectFailure = 'connection'
}
foreach ($entry in $cases.GetEnumerator()) {
  $status = [System.Enum]::Parse([System.Net.WebExceptionStatus], $entry.Key)
  $exception = [System.Net.WebException]::new('secret-marker-must-not-be-returned', $status)
  $actual = Get-PreflightFailureKind -Exception $exception
  if ($actual -ne $entry.Value) { throw ($entry.Key + ' classified as ' + $actual) }
  $result = New-PreflightNetworkResult -FailureKind $actual
  if ($result.State -ne 'BLOQUEADO') { throw ($entry.Key + ' was not blocked') }
}
foreach ($status in @(200, 302)) {
  if ((New-PreflightNetworkResult -StatusCode $status).State -ne 'APROVADO') { throw 'success status misclassified' }
}
foreach ($status in @(401, 403, 407)) {
  $result = New-PreflightNetworkResult -StatusCode $status
  if ($result.State -ne 'AVISO') { throw ('HTTP ' + $status + ' misclassified') }
}
Add-Type -TypeDefinition @'
using System;
using System.Net;
public class PreflightTestProxy : IWebProxy {
    public ICredentials Credentials { get; set; }
    public Uri Result { get; set; }
    public bool Bypass { get; set; }
    public Uri GetProxy(Uri destination) { return Result; }
    public bool IsBypassed(Uri destination) { return Bypass; }
}
'@
Set-StrictMode -Version Latest
$endpoint = [Uri]'https://example.invalid/artifactory/api/npm/npm/'
$proxy = [PreflightTestProxy]::new()
if ($null -ne (Get-PreflightSystemProxyUri -Uri $endpoint -Proxy $proxy)) { throw 'null Windows proxy must use direct transport' }
$proxy.Result = $endpoint
if ($null -ne (Get-PreflightSystemProxyUri -Uri $endpoint -Proxy $proxy)) { throw 'destination URI must use direct transport' }
$proxy.Result = [Uri]'http://proxy.invalid:8080'
if ((Get-PreflightSystemProxyUri -Uri $endpoint -Proxy $proxy) -ne $proxy.Result) { throw 'configured system proxy was ignored' }
$proxy.Bypass = $true
if ($null -ne (Get-PreflightSystemProxyUri -Uri $endpoint -Proxy $proxy)) { throw 'system proxy bypass was ignored' }
$preflightAst = [System.Management.Automation.Language.Parser]::ParseFile($env:TESSERACT_PREFLIGHT_SCRIPT, [ref]$null, [ref]$null)
foreach ($name in @('Add-PreflightCheck', 'Test-Endpoint', 'Get-NpmValue', 'Get-NpmConfigArguments', 'Test-ConfiguredBoolean')) {
    $definition = $preflightAst.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $false)
    . ([scriptblock]::Create($definition.Extent.Text))
}
$defaultNpmArguments = @(Get-NpmConfigArguments)
if (($defaultNpmArguments -join ' ') -ne 'config list --json') { throw 'default npm configuration arguments changed' }
$outBbNpmArguments = @(Get-NpmConfigArguments -UseDefaultRegistry)
if (($outBbNpmArguments -join ' ') -ne 'config list --json --registry=https://registry.npmjs.org/') { throw 'OutBB did not select the public npm registry' }
$checks = [System.Collections.Generic.List[object]]::new()
function Invoke-UnauthenticatedHead {
    param([Uri]$Uri, [int]$TimeoutSeconds)
    if ($Uri.AbsolutePath -ne '/artifactory/api/npm/npm/') { throw 'registry path was lost' }
    New-PreflightNetworkResult -StatusCode 200
}
Test-Endpoint -Label 'Registry npm' -RawUri $endpoint.AbsoluteUri -TimeoutSeconds 1
if ($checks[0].State -ne 'APROVADO') { throw 'reachable endpoint blocked before HTTP probe' }
function Invoke-UnauthenticatedHead { throw [System.InvalidOperationException]::new('secret-marker') }
Test-Endpoint -Label 'Registry npm' -RawUri $endpoint.AbsoluteUri -TimeoutSeconds 1
if ($checks[1].State -ne 'BLOQUEADO' -or $checks[1].Summary -match 'DNS') { throw 'unknown failure was mislabeled as DNS' }
function Invoke-UnauthenticatedHead {
    New-PreflightNetworkResult -FailureKind 'dns'
}
Test-Endpoint -Label 'Registry npm' -RawUri $endpoint.AbsoluteUri -TimeoutSeconds 1
if ($checks[2].State -ne 'BLOQUEADO' -or $checks[2].Summary -notmatch 'DNS') { throw 'real DNS failure was not blocked' }
$preflightText = [System.IO.File]::ReadAllText($env:TESSERACT_PREFLIGHT_SCRIPT)
$npmStart = $preflightText.IndexOf('$npmCommand = Get-Command')
$npmEnd = $preflightText.IndexOf('$proxyConfigured =')
if ($npmStart -lt 0 -or $npmEnd -le $npmStart) { throw 'npm checks not found' }
$checks = [System.Collections.Generic.List[object]]::new()
$nodeAvailable = $false
$npmConfig = $null
$env:NODE_TLS_REJECT_UNAUTHORIZED = ''
. ([scriptblock]::Create($preflightText.Substring($npmStart, $npmEnd - $npmStart)))
foreach ($name in @('npm', 'npx', 'Registry npm configurado', 'Validação npm')) {
    $check = @($checks | Where-Object Name -eq $name)
    if ($check.Count -ne 1 -or $check[0].State -ne 'INFORMATIVO') { throw ($name + ' incorrectly evaluated without Node') }
}
if (@($checks | Where-Object Name -eq 'Registry npm').Count -ne 0) { throw 'registry was probed without npm configuration' }
if ((Get-NpmValue 'registry') -ne '') { throw 'unavailable npm configuration returned a value' }
$npmConfig = [pscustomobject]@{ registry = 'https://example.invalid/'; 'strict-ssl' = $false }
if ((Get-NpmValue 'registry') -ne 'https://example.invalid/') { throw 'cached registry not read' }
if ((Get-NpmValue 'strict-ssl') -ine 'false') { throw 'disabled TLS setting lost' }
$env:NODE_USE_ENV_PROXY = '0'
__PROXY_SETUP__
if ($env:NODE_USE_ENV_PROXY -ne '0') { throw 'explicit proxy opt-out was changed' }
$env:NODE_USE_ENV_PROXY = ''
__PROXY_SETUP__
if ($env:NODE_USE_ENV_PROXY -ne '1') { throw 'proxy default was not enabled' }
if ((Get-PreflightCheckState -Category 'Rede opcional' -NetworkState 'BLOQUEADO') -ne 'AVISO') { throw 'optional endpoint blocked installation' }
if ((Get-PreflightCheckState -Category 'Rede' -NetworkState 'BLOQUEADO') -ne 'BLOQUEADO') { throw 'required endpoint warning was weakened' }
'OK preflight core'
`;
  const serviceScript = readFileSync(`${process.cwd()}\\service.ps1`, "utf8");
  const proxySetup = serviceScript.match(/if \(-not \$env:NODE_USE_ENV_PROXY\) \{ \$env:NODE_USE_ENV_PROXY = '1' \}/)?.[0];
  expect(proxySetup).toBeDefined();
  const verifiedScript = script.replaceAll("__PROXY_SETUP__", proxySetup!);
  const result = spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", verifiedScript], {
    encoding: "utf8",
    timeout: 20_000,
    env: {
      ...process.env,
      TESSERACT_PREFLIGHT_MODULE: `${process.cwd()}\\scripts\\preflight-core.psm1`,
      TESSERACT_PREFLIGHT_SCRIPT: `${process.cwd()}\\preflight.ps1`,
    },
  });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(result.stdout).toContain("OK preflight core");
  expect(result.stdout + result.stderr).not.toContain("private-token");
  expect(result.stdout + result.stderr).not.toContain("private-query");
  expect(result.stdout + result.stderr).not.toContain("secret-marker");
}, 25_000);
