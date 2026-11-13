!macro NSIS_HOOK_POSTINSTALL
  ; Register custom ProgID PDFLEF.Document with the exclusive PDF-LEF sheet icon
  WriteRegStr HKCU "Software\Classes\PDFLEF.Document" "" "Documento PDF (PDF-LEF)"
  WriteRegStr HKCU "Software\Classes\PDFLEF.Document" "FriendlyTypeName" "Documento PDF (PDF-LEF)"
  WriteRegStr HKCU "Software\Classes\PDFLEF.Document\DefaultIcon" "" "$INSTDIR\icons\pdf-document.ico,0"
  WriteRegStr HKCU "Software\Classes\PDFLEF.Document\shell\open" "" "Abrir con PDF-LEF"
  WriteRegStr HKCU "Software\Classes\PDFLEF.Document\shell\open" "Icon" "$INSTDIR\PDF-LEF.exe,0"
  WriteRegStr HKCU "Software\Classes\PDFLEF.Document\shell\open\command" "" '"$INSTDIR\PDF-LEF.exe" "%1"'

  ; Register PDFLEF.Document as an official .pdf handler in Windows 10/11
  WriteRegStr HKCU "Software\Classes\.pdf\OpenWithProgids" "PDFLEF.Document" ""

  ; Register Capabilities for Windows Default Apps Settings (Aplicaciones predeterminadas)
  WriteRegStr HKCU "Software\PDF-LEF\Capabilities" "ApplicationName" "PDF-LEF"
  WriteRegStr HKCU "Software\PDF-LEF\Capabilities" "ApplicationDescription" "Suite PDF Nativa 100% Local con edicion directa, firmas y diseno de documento exclusivo."
  WriteRegStr HKCU "Software\PDF-LEF\Capabilities\FileAssociations" ".pdf" "PDFLEF.Document"
  WriteRegStr HKCU "Software\RegisteredApplications" "PDF-LEF" "Software\PDF-LEF\Capabilities"

  ; Refresh Windows Explorer icon cache immediately so .pdf files show the PDF-LEF document icon
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\PDFLEF.Document"
  DeleteRegValue HKCU "Software\Classes\.pdf\OpenWithProgids" "PDFLEF.Document"
  DeleteRegKey HKCU "Software\PDF-LEF"
  DeleteRegValue HKCU "Software\RegisteredApplications" "PDF-LEF"
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend
