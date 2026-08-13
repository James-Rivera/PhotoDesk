Unicode true
RequestExecutionLevel user
SetCompressor /SOLID lzma

!ifndef SOURCE_DIR
  !error "SOURCE_DIR is required"
!endif
!ifndef OUTPUT_FILE
  !error "OUTPUT_FILE is required"
!endif

Name "CJNET Print Helper"
OutFile "${OUTPUT_FILE}"
Icon "${ICON_FILE}"
UninstallIcon "${ICON_FILE}"
InstallDir "$LOCALAPPDATA\CJNET\PrintHelper"
ShowInstDetails show
ShowUninstDetails show

Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  SetShellVarContext current
  nsExec::ExecToLog 'taskkill /IM "CJNET.PrintHelper.exe" /F'
  Sleep 1000
  SetOutPath "$INSTDIR"
  File "${SOURCE_DIR}\CJNET.PrintHelper.exe"
  File "${SOURCE_DIR}\WebView2Loader.dll"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$SMPROGRAMS\CJNET Print Helper.lnk" "$INSTDIR\CJNET.PrintHelper.exe"
  CreateShortcut "$SMSTARTUP\CJNET Print Helper.lnk" "$INSTDIR\CJNET.PrintHelper.exe"
  Exec "$INSTDIR\CJNET.PrintHelper.exe"
  IfSilent installed
  MessageBox MB_OK|MB_ICONINFORMATION "CJNET Print Helper is installed and running.$\r$\n$\r$\nIn PhotoDesk, click Print, then Check."
  installed:
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::ExecToLog 'taskkill /IM "CJNET.PrintHelper.exe" /F'
  Sleep 2000
  Delete "$SMPROGRAMS\CJNET Print Helper.lnk"
  Delete "$SMSTARTUP\CJNET Print Helper.lnk"
  Delete "$INSTDIR\CJNET.PrintHelper.exe"
  Delete "$INSTDIR\WebView2Loader.dll"
  Delete "$INSTDIR\paired-origins.json"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  RMDir "$LOCALAPPDATA\CJNET"
SectionEnd
