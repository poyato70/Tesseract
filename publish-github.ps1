<#
  Publica este checkout no GitHub como poyato70/Tesseract (privado).
  Usa o git e o gh já autenticados do usuário. Grava o log em publish-github.log.
#>
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$log = Join-Path $PSScriptRoot ('publish-github-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
try { Start-Transcript -LiteralPath $log -Force | Out-Null } catch { Write-Host "Sem log: $($_.Exception.Message)" }
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

    # CI: o arquivo de workflow vem da missão 21 (só leitura dela)
    $ci = Join-Path $PSScriptRoot '.github\workflows\ci.yml'
    $ciSource = Join-Path (Split-Path $PSScriptRoot -Parent) 'Tesseract-missao-21\.github\workflows\ci.yml'
    if (-not (Test-Path -LiteralPath $ci) -and (Test-Path -LiteralPath $ciSource)) {
        New-Item -ItemType Directory -Force -Path (Split-Path $ci -Parent) | Out-Null
        Copy-Item -LiteralPath $ciSource -Destination $ci
    }
    git add -A
    $pending = git status --porcelain
    if ($pending) {
        $hasHead = (cmd /c "git rev-parse --verify HEAD >nul 2>nul & echo %errorlevel%").Trim() -eq '0'
        $hasRemote = [bool](git remote)
        if ($hasHead -and -not $hasRemote) {
            # ainda não publicado: incorpora ao commit inicial
            git commit --amend --no-edit | Out-Host
        } else {
            git commit -F (Join-Path $PSScriptRoot 'docs\relatorios\commit-missao-22.txt') | Out-Host
        }
    }

    # comandos nativos escrevem progresso em stderr: não tratar como exceção
    $ErrorActionPreference = 'Continue'
    $exists = $true
    $null = cmd /c "gh repo view $owner/$repo --json name >nul 2>nul"
    if ($LASTEXITCODE -ne 0) { $exists = $false }

    if (-not $exists) {
        gh repo create "$owner/$repo" --private --description 'Tesseract - FinOps e IA: integracoes MCP, agentes e observabilidade' --source . --remote origin --push 2>&1 | Out-Host
    } else {
        if (-not (git remote 2>$null | Select-String -SimpleMatch 'origin')) {
            git remote add origin "https://github.com/$owner/$repo.git"
        }
        git push -u origin main 2>&1 | Out-Host
    }
    if ($LASTEXITCODE -ne 0) { throw "Push falhou (código $LASTEXITCODE)." }
    Write-Host ""
    Write-Host "PUBLICADO: https://github.com/$owner/$repo" -ForegroundColor Green
} catch {
    Write-Host "FALHOU: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    try { Stop-Transcript | Out-Null } catch {}
    Read-Host 'Pressione Enter para fechar'
}
