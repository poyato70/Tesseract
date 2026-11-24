<#
  Publica este checkout no GitHub como poyato70/Tesseract (privado).
  Usa o git e o gh já autenticados do usuário. Grava o log em publish-github.log.
#>
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$log = Join-Path $PSScriptRoot 'publish-github.log'
Start-Transcript -LiteralPath $log -Force | Out-Null
try {
    $repo = 'Tesseract'
    $owner = (gh api user --jq .login).Trim()
    if (-not $owner) { throw 'gh não está autenticado. Rode: gh auth login' }

    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.git'))) {
        git init -b main | Out-Host
    }
    if (-not (git config user.name)) {
        $id = (gh api user --jq .id).Trim()
        git config user.name $owner
        git config user.email "$id+$owner@users.noreply.github.com"
    }

    git add -A
    $pending = git status --porcelain
    if ($pending) {
        git commit -F (Join-Path $PSScriptRoot 'docs\relatorios\commit-missao-22.txt') | Out-Host
    }

    $exists = $true
    gh repo view "$owner/$repo" --json name 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { $exists = $false }

    if (-not $exists) {
        gh repo create "$owner/$repo" --private --description 'Tesseract — FinOps & IA: integrações MCP, agentes e observabilidade' --source . --remote origin --push | Out-Host
    } else {
        if (-not (git remote 2>$null | Select-String -SimpleMatch 'origin')) {
            git remote add origin "https://github.com/$owner/$repo.git"
        }
        git push -u origin main | Out-Host
    }
    if ($LASTEXITCODE -ne 0) { throw "Push falhou (código $LASTEXITCODE)." }
    Write-Host ""
    Write-Host "PUBLICADO: https://github.com/$owner/$repo" -ForegroundColor Green
} catch {
    Write-Host "FALHOU: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    Stop-Transcript | Out-Null
    Read-Host 'Pressione Enter para fechar'
}
