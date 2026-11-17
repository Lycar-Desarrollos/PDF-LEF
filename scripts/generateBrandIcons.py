#!/usr/bin/env python3
"""
Generates official Kova PDF v2.1 Blue Wrap-Around Ribbon PDF icons (SVG, PNG, multi-size ICO)
with 100% pure geometric vector paths (zero system font dependencies) and 32-bit RGBA PNGs.
"""

import pathlib
import subprocess
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent

BLUE_PDF_ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="kovaRibbonFront" x1="44" y1="212" x2="468" y2="380" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>
  </defs>

  <!-- Subtle Ambient Drop Shadow -->
  <path d="M92 40H316L420 144V488H92V40Z" fill="#0B0F17" opacity="0.12"/>

  <!-- Bold Obsidian Document Frame & Solid Folded Top-Right Corner -->
  <path d="M92 32H316L420 136V480H92V32Z" fill="#0B0F17"/>

  <!-- Crisp Pure White Document Interior -->
  <path d="M118 58H298V154H394V454H118V58Z" fill="#FFFFFF"/>

  <!-- 3D Wrap-Around Side Ribbon Flaps -->
  <polygon points="44,212 92,166 92,212" fill="#1E3A8A"/>
  <polygon points="468,212 420,166 420,212" fill="#1E3A8A"/>

  <!-- Subtle Ribbon Underside Shadow on Paper -->
  <rect x="92" y="380" width="328" height="14" fill="#0B0F17" opacity="0.16"/>

  <!-- Front Cobalt Blue Ribbon Banner -->
  <rect x="44" y="212" width="424" height="168" rx="4" fill="url(#kovaRibbonFront)"/>

  <!-- Pure Vector Bold Geometric 'PDF' Letterforms (Mathematically Centered: x=132..380) -->
  <path fill="#FFFFFF" fill-rule="evenodd" clip-rule="evenodd" d="
    M132 250H174C193 250 205 261 205 279C205 297 193 308 174 308H154V342H132V250ZM154 268V290H171C179 290 183 286 183 279C183 272 179 268 171 268H154Z
    M220 250H256C284 250 301 268 301 296C301 324 284 342 256 342H220V250ZM242 269V323H255C270 323 279 313 279 296C279 279 270 269 255 269H242Z
    M318 250H380V269H340V288H374V307H340V342H318V250Z
  "/>
</svg>
"""


def render_svg_to_rgba_png(svg_path: pathlib.Path, png_path: pathlib.Path, size: int) -> None:
    subprocess.run(
        [
            "rsvg-convert",
            "-w",
            str(size),
            "-h",
            str(size),
            str(svg_path),
            "-o",
            str(png_path),
        ],
        check=True,
    )
    with Image.open(png_path) as im:
        rgba = im.convert("RGBA")
        rgba.save(png_path, format="PNG")


def build_ico(master_png: pathlib.Path, ico_path: pathlib.Path, sizes: list[tuple[int, int]]) -> None:
    with Image.open(master_png) as im:
        rgba = im.convert("RGBA")
        rgba.save(ico_path, format="ICO", sizes=sizes)


def main() -> None:
    svg_targets = [
        ROOT / "public" / "brand" / "logo-mark.svg",
        ROOT / "public" / "brand" / "pdf-doc-icon.svg",
        ROOT / "public" / "favicon.svg",
        ROOT / "website" / "assets" / "logo-mark.svg",
        ROOT / "website" / "assets" / "pdf-doc-icon.svg",
    ]
    for path in svg_targets:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(BLUE_PDF_ICON_SVG, encoding="utf-8")

    master_svg = ROOT / "public" / "brand" / "logo-mark.svg"

    # Public & Website PNGs
    render_svg_to_rgba_png(master_svg, ROOT / "public" / "brand" / "icon-512.png", 512)
    render_svg_to_rgba_png(master_svg, ROOT / "public" / "brand" / "icon-256.png", 256)
    render_svg_to_rgba_png(master_svg, ROOT / "public" / "brand" / "pdf-doc-512.png", 512)
    render_svg_to_rgba_png(master_svg, ROOT / "public" / "brand" / "pdf-doc-256.png", 256)
    render_svg_to_rgba_png(master_svg, ROOT / "website" / "assets" / "icon-256.png", 256)
    render_svg_to_rgba_png(master_svg, ROOT / "website" / "assets" / "pdf-doc-256.png", 256)

    # Tauri Native Icons (strictly 32-bit RGBA)
    tauri_icons = ROOT / "src-tauri" / "icons"
    render_svg_to_rgba_png(master_svg, tauri_icons / "32x32.png", 32)
    render_svg_to_rgba_png(master_svg, tauri_icons / "128x128.png", 128)
    render_svg_to_rgba_png(master_svg, tauri_icons / "128x128@2x.png", 256)
    render_svg_to_rgba_png(master_svg, tauri_icons / "icon.png", 512)

    master_512 = tauri_icons / "icon.png"
    win_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    fav_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64)]

    build_ico(master_512, tauri_icons / "icon.ico", win_sizes)
    build_ico(master_512, tauri_icons / "pdf-document.ico", win_sizes)
    build_ico(master_512, ROOT / "public" / "favicon.ico", fav_sizes)
    build_ico(master_512, ROOT / "website" / "assets" / "favicon.ico", fav_sizes)
    print("Generated all Kova PDF Blue Ribbon SVG, RGBA PNG, and multi-size ICO icons.")


if __name__ == "__main__":
    main()
