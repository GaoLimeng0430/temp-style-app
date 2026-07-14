@echo off
chcp 65001 >nul
title 衣温 - 温度穿搭助手
echo ================================
echo   👔 衣温 - 穿搭助手已启动
echo ================================
echo.
echo   🌐 打开浏览器访问:
echo   http://localhost:8080
echo.
echo   或: http://127.0.0.1:8080
echo.
echo ================================
echo   按 Ctrl+C 停止服务
echo ================================
echo.

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -Command "
$port=8080;
$root='%~dp0';
$l=New-Object System.Net.HttpListener;
$l.Prefixes.Add('http://localhost:'+$port+'/');
$l.Prefixes.Add('http://127.0.0.1:'+$port+'/');
$l.Start();
$m=@{'.html'='text/html; charset=utf-8';'.css'='text/css; charset=utf-8';'.js'='application/javascript; charset=utf-8'};
while($l.IsListening){
  $c=$l.GetContext();
  $p=$c.Request.Url.AbsolutePath;
  if($p-eq'/'){$p='/index.html'};
  $f=$root+$p.TrimStart('/');
  if(Test-Path $f -PathType Leaf){
    $b=[System.IO.File]::ReadAllBytes($f);
    $c.Response.ContentType=$m[[System.IO.Path]::GetExtension($f).ToLower()];
    $c.Response.ContentLength64=$b.Length;
    $c.Response.OutputStream.Write($b,0,$b.Length)
  } else {
    $c.Response.StatusCode=404
  };
  $c.Response.Close()
}
"
pause
