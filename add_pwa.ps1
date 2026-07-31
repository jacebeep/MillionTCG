$ErrorActionPreference = "Stop"
$files = @('shop.html','sell.html','product.html')

$removeBlock = @"
      <li id="install-app-li" style="display:none; border-top: 1px solid rgba(255,255,255,0.08); margin-top: 8px; padding-top: 8px;">
        <a href="#" id="install-app-btn" style="color: #00e5ff; display:flex; align-items:center; gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16l-4-4h2.5V4h3v8H16l-4 4z"/><path d="M20 18H4v2h16v-2z"/></svg>
          Install App
        </a>
      </li>    </ul>
      </div>
"@

foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText((Join-Path (Get-Location) $f), [System.Text.Encoding]::UTF8)
    # Count occurrences
    $count = ([regex]::Matches($content, 'install-app-li')).Count
    Write-Host "$f has $count occurrences of install-app-li"
}
