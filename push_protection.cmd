@echo off
set PATH=%PATH%;C:\Users\jacep\AppData\Local\GitHubDesktop\app-3.5.11\resources\app\git\cmd
git add -A
git commit -m "Added anti-copy and source code protection engine"
git push origin main
git push origin gh-pages --force
