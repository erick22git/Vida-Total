Add-Type -AssemblyName System.Drawing
$dir = "C:\Erick\app movil\vida-total-web\public\foods"
$files = Get-ChildItem -Path $dir -Filter "*.jpg"

foreach ($f in $files) {
    $pngPath = [System.IO.Path]::ChangeExtension($f.FullName, ".png")
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    $img.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $img.Dispose()
    Remove-Item $f.FullName -Force
    Write-Output "Converted: $($f.Name) -> $($f.BaseName).png"
}
