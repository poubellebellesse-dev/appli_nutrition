@echo off
rem chemin.bat — le chemin des lots, dans le navigateur.
rem
rem   Lance-le avec le point :  .\chemin.bat
rem   NoDefaultCurrentDirectoryInExePath vaut 1 sur cette machine : un .bat
rem   appele par son seul nom est introuvable.
rem
rem   Il ouvre une page locale sur 127.0.0.1 et l'affiche dans le navigateur.
rem   Cette fenetre doit rester ouverte : c'est elle qui sert la page.
rem   Ctrl+C pour arreter.
rem
rem   Options :  .\chemin.bat --port 8080        un autre port
rem              .\chemin.bat --sans-navigateur  ne pas ouvrir le navigateur

chcp 65001 >nul
title CHEMIN DES LOTS

node "%~dp0.claude\chemin.mjs" %*
