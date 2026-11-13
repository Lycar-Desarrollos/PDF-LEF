export type WorkspaceMode = 'home' | 'reader' | 'edit' | 'organize';

export type ActiveTool =
  | 'select'
  | 'pan'
  | 'edit-pdf-text'
  | 'add-text'
  | 'add-image'
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'ink'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'redact'
  | 'stamp'
  | 'signature'
  | 'note';

export type FontFamilyChoice = 'sans' | 'serif' | 'mono' | 'script';

export type PaperFilter = 'original' | 'night' | 'sepia' | 'contrast';

export type ViewLayout = 'continuous' | 'single' | 'dual';

export interface NativePdfTextItem {
  id: string;
  pageId: string;
  /** Normalized 0..1 coordinates of original text in source page */
  origX: number;
  origY: number;
  origWidth: number;
  origHeight: number;
  /** Current normalized 0..1 coordinates (can be dragged/moved anywhere!) */
  x: number;
  y: number;
  width: number;
  height: number;
  originalText: string;
  text: string;
  fontSizePt: number;
  fontFamily: FontFamilyChoice;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  bgPatchColor: string;
  deleted: boolean;
  modified: boolean;
}

export type OverlayElementKind =
  | 'text'
  | 'image'
  | 'signature'
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'redact'
  | 'stamp'
  | 'note'
  | 'ink';

export interface PdfOverlayElement {
  id: string;
  pageId: string;
  kind: OverlayElementKind;
  /** Normalized 0..1 relative to current rotated page dimensions */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  locked?: boolean;

  // Text & Stamp properties
  text?: string;
  subText?: string;
  fontFamily?: FontFamilyChoice;
  fontSizePt?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  strokeWidth?: number;

  // Image / Signature properties
  dataUrl?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  preserveAspect?: boolean;

  // Ink / Arrow normalized points inside the page (0..1)
  points?: Array<{ x: number; y: number }>;

  // Note metadata
  author?: string;
  createdAt?: string;
}

export interface PageDescriptor {
  id: string;
  /** Source buffer ID in tab.sourceBuffers (or 'blank' for inserted blank page) */
  sourceId: string;
  /** 0-based page index inside that source PDF */
  sourcePageIndex: number;
  /** Additional rotation in degrees (0, 90, 180, 270) */
  rotation: number;
  /** Base unrotated width/height in PDF points */
  widthPt: number;
  heightPt: number;
  /** Optional crop percentages (0..0.4) */
  crop?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  color: string;
  opacity: number;
  fontSizePt: number;
  rotation: number;
  tiled: boolean;
}

export interface HeaderFooterConfig {
  enabled: boolean;
  headerLeft: string;
  headerRight: string;
  footerCenterPattern: 'page-of-total' | 'number-only' | 'bates' | 'custom';
  batesPrefix: string;
  batesStart: number;
  customFooter: string;
  fontSizePt: number;
  color: string;
}

export interface DocumentMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
}

export interface DocumentHistorySnapshot {
  pages: PageDescriptor[];
  elements: PdfOverlayElement[];
  nativeTextEdits: Record<string, NativePdfTextItem>;
  watermark: WatermarkConfig;
  headerFooter: HeaderFooterConfig;
}

export interface PdfTabDocument {
  id: string;
  fileName: string;
  filePath?: string;
  fileSize: number;
  isModified: boolean;
  openedAt: number;
  /** Map of sourceId -> raw PDF Uint8Array (supports merging external PDFs seamlessly!) */
  sourceBuffers: Record<string, Uint8Array>;
  pages: PageDescriptor[];
  elements: PdfOverlayElement[];
  /** Extracted & modified native text blocks keyed by NativePdfTextItem.id */
  nativeTextEdits: Record<string, NativePdfTextItem>;
  /** Cache of extracted native text items per pageId */
  extractedPageTexts: Record<string, NativePdfTextItem[]>;
  watermark: WatermarkConfig;
  headerFooter: HeaderFooterConfig;
  metadata: DocumentMetadata;
  currentPageIndex: number;
  zoom: number;
  viewLayout: ViewLayout;
  paperFilter: PaperFilter;
  undoStack: DocumentHistorySnapshot[];
  redoStack: DocumentHistorySnapshot[];
}

export interface SavedSignature {
  id: string;
  name: string;
  dataUrl: string;
  inkColor: string;
  createdAt: string;
}

export interface RecentFileEntry {
  id: string;
  fileName: string;
  filePath?: string;
  fileSize: number;
  pageCount: number;
  lastOpenedAt: number;
  pinned?: boolean;
}

export interface OutlineNode {
  title: string;
  pageIndex: number;
  children: OutlineNode[];
}

export type ThemePreference = 'light' | 'dark' | 'system';
export type AccentTheme = 'ruby' | 'cobalt' | 'graphite' | 'emerald';
export type UiDensity = 'compact' | 'standard' | 'comfortable';

export interface AppSettings {
  // Appearance & Style
  theme: ThemePreference;
  accent: AccentTheme;
  density: UiDensity;
  uiScale: 95 | 100 | 108;
  showStatusBar: boolean;
  smoothAnimations: boolean;

  // Viewer Defaults
  defaultZoom: number;
  defaultViewLayout: ViewLayout;
  defaultPaperFilter: PaperFilter;
  defaultLeftPanel: 'thumbnails' | 'outline' | 'search' | 'layers' | 'closed';
  hiDpiRendering: boolean;

  // Editing & Signatures
  authorName: string;
  defaultFontFamily: FontFamilyChoice;
  defaultFontSizePt: number;
  defaultTextColor: string;
  defaultHighlightColor: string;
  defaultInkColor: string;
  defaultInkWidth: number;
  snapGuides: boolean;
  autoSelectAfterInsert: boolean;
  includeDateOnSignature: boolean;
  includeDateOnStamps: boolean;

  // Export & Privacy
  exportImageDpi: 150 | 300 | 600;
  autoCleanMetadataOnExport: boolean;
  confirmCloseUnsaved: boolean;
  strictOfflineIndicator: boolean;
}

export type ToolModalKind =
  | null
  | 'merge'
  | 'split'
  | 'watermark'
  | 'numbering'
  | 'images-to-pdf'
  | 'pdf-to-images'
  | 'ocr'
  | 'optimize'
  | 'metadata';
