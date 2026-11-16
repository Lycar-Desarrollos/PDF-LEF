!macro NSIS_HOOK_POSTINSTALL
  ; Register custom ProgID KovaPDF.Document with the exclusive Kova PDF sheet icon
  WriteRegStr HKCU "Software\Classes\KovaPDF.Document" "" "Documento PDF (Kova PDF)"
  WriteRegStr HKCU "Software\Classes\KovaPDF.Document" "FriendlyTypeName" "Documento PDF (Kova PDF)"
  IfFileExists "$INSTDIR\icons\pdf-document.ico" 0 +3
    WriteRegStr HKCU "Software\Classes\KovaPDF.Document\DefaultIcon" "" "$INSTDIR\icons\pdf-document.ico,0"
    Goto +2
    WriteRegStr HKCU "Software\Classes\KovaPDF.Document\DefaultIcon" "" "$INSTDIR\${MAINBINARYNAME}.exe,0"
  WriteRegStr HKCU "Software\Classes\KovaPDF.Document\shell\open" "" "Abrir con Kova PDF"
  WriteRegStr HKCU "Software\Classes\KovaPDF.Document\shell\open" "Icon" "$INSTDIR\${MAINBINARYNAME}.exe,0"
  WriteRegStr HKCU "Software\Classes\KovaPDF.Document\shell\open\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'

  ; Register KovaPDF.Document as an official .pdf handler in Windows 10/11
  WriteRegStr HKCU "Software\Classes\.pdf\OpenWithProgids" "KovaPDF.Document" ""

  ; Register Capabilities for Windows Default Apps Settings (Aplicaciones predeterminadas)
  WriteRegStr HKCU "Software\KovaPDF\Capabilities" "ApplicationName" "Kova PDF"
  WriteRegStr HKCU "Software\KovaPDF\Capabilities" "ApplicationDescription" "Estudio PDF Nativo 100% Local con edicion directa, conversion y firma digital."
  WriteRegStr HKCU "Software\KovaPDF\Capabilities\FileAssociations" ".pdf" "KovaPDF.Document"
  WriteRegStr HKCU "Software\RegisteredApplications" "Kova PDF" "Software\KovaPDF\Capabilities"

  ; Refresh Windows Explorer icon cache immediately so .pdf files show the Kova PDF document icon
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\KovaPDF.Document"
  DeleteRegValue HKCU "Software\Classes\.pdf\OpenWithProgids" "KovaPDF.Document"
  DeleteRegKey HKCU "Software\KovaPDF"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Kova PDF"
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend
