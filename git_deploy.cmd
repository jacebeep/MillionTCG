@echo off
set PATH=%PATH%;C:\Users\jacep\AppData\Local\GitHubDesktop\app-3.5.11\resources\app\git\cmd
git checkout -B gh-pages
git add -A
git commit -m "Deploy MillionTCG Live Website"
git push -u origin gh-pages --force
git checkout main
