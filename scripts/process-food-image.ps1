param (
    [string]$Url,
    [string]$OutputFile
)

Add-Type -AssemblyName System.Drawing

try {
    $client = New-Object System.Net.WebClient
    $client.Headers.Add("User-Agent", "VidaTotalApp/1.0 (https://vidatotal.app; contact@vidatotal.app)")
    $bytes = $client.DownloadData($Url)
    $ms = New-Object System.IO.MemoryStream($bytes, 0, $bytes.Length)
    $orig = [System.Drawing.Image]::FromStream($ms)

    $cropSize = [Math]::Min($orig.Width, $orig.Height)
    $x = [int](($orig.Width - $cropSize) / 2)
    $y = [int](($orig.Height - $cropSize) / 2)

    $target = New-Object System.Drawing.Bitmap 800, 800
    $g = [System.Drawing.Graphics]::FromImage($target)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $srcRect = New-Object System.Drawing.Rectangle $x, $y, $cropSize, $cropSize
    $destRect = New-Object System.Drawing.Rectangle 0, 0, 800, 800
    $g.DrawImage($orig, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    if ($OutputFile.ToLower().EndsWith(".png")) {
        $target.Save($OutputFile, [System.Drawing.Imaging.ImageFormat]::Png)
    } else {
        $target.Save($OutputFile, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    }

    $g.Dispose()
    $target.Dispose()
    $orig.Dispose()
    $ms.Dispose()

    Write-Output "SUCCESS"
} catch {
    Write-Error $_
}
