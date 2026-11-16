export type WorkspaceMode = 'home' | 'reader' | 'edit' | 'organize';

export type StudioDepartment = 'general' | 'engineering' | 'accounting' | 'admin';

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
  | 'note'
  | 'measure-line'
  | 'measure-area'
  | 'callout'
  | 'tick-ok'
  | 'tick-err'
  | 'tick-warn';

export type FontFamilyChoice = 'sans' | 'serif' | 'mono' | 'script';

export type PaperFilter = 'original' | 'night' | 'sepia' | 'contrast' | 'blueprint';

export type ViewLayout = 'continuous' | 'single' | 'dual';

export interface ScaleCalibration {
  /** Scale preset e.g. '1:1', '1:20', '1:50', '1:75', '1:100', '1:200', '1:500' */
  preset: string;
  /** Ratio multiplier (e.g. 100 means 1 cm on paper = 100 cm in real life) */
  ratio: number;
  unit: 'mm' | 'cm' | 'm' | 'in' | 'ft';
}

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
  | 'ink'
  | 'dimension'
  | 'area'
  | 'callout'
  | 'tickmark';

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

  // Image / Signature / Logo properties
  dataUrl?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  preserveAspect?: boolean;

  // Ink / Dimension / Arrow normalized points inside the page (0..1)
  points?: Array<{ x: number; y: number }>;

  // Engineering / Accounting extras
  calloutNumber?: number;
  tickVariant?: 'ok' | 'err' | 'warn';

  // Note metadata
  author?: string;
  createdAt?: string;
}

export interface PageDescriptor {
  id: string;
  sourceId: string;
  sourcePageIndex: number;
  rotation: number;
  widthPt: number;
  heightPt: number;
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
  sourceBuffers: Record<string, Uint8Array>;
  pages: PageDescriptor[];
  elements: PdfOverlayElement[];
  nativeTextEdits: Record<string, NativePdfTextItem>;
  extractedPageTexts: Record<string, NativePdfTextItem[]>;
  watermark: WatermarkConfig;
  headerFooter: HeaderFooterConfig;
  metadata: DocumentMetadata;
  scaleCalibration: ScaleCalibration;
  nextCalloutNumber: number;
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

export interface SavedLogo {
  id: string;
  name: string;
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
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
  theme: ThemePreference;
  accent: AccentTheme;
  density: UiDensity;
  uiScale: 95 | 100 | 108;
  showStatusBar: boolean;
  smoothAnimations: boolean;

  defaultZoom: number;
  defaultViewLayout: ViewLayout;
  defaultPaperFilter: PaperFilter;
  defaultLeftPanel: 'thumbnails' | 'outline' | 'search' | 'layers' | 'closed';
  hiDpiRendering: boolean;

  authorName: string;
  companyName: string;
  defaultTaxRatePct: number;
  currencySymbol: string;
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

  exportImageDpi: 150 | 300 | 600;
  autoCleanMetadataOnExport: boolean;
  confirmCloseUnsaved: boolean;
  strictOfflineIndicator: boolean;
}

export type ToolModalKind =
  | null
  | 'merge'
  | 'split'
  | 'remove-pages'
  | 'crop'
  | 'watermark'
  | 'numbering'
  | 'images-to-pdf'
  | 'pdf-to-images'
  | 'pdf-to-word'
  | 'ocr'
  | 'optimize'
  | 'metadata'
  | 'logos'
  | 'calculator'
  | 'export-csv';
