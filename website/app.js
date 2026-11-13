const HERO_PANELS = {
  text: `
    <div style="background:#ffffff;border-radius:8px;padding:15px;box-shadow:0 4px 16px rgba(15,23,42,0.08);position:relative">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:10.5px;font-weight:800;color:#2563eb;letter-spacing:0.04em">EDICIÓN EN SITIO + GUÍAS MAGNÉTICAS</span>
        <span style="font-size:10.5px;background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:4px;font-weight:600">Alineado al margen ✓</span>
      </div>
      <div style="position:relative;border-left:1.5px dashed #38bdf8;padding-left:10px">
        <div style="font-size:11px;color:#64748b;margin-bottom:6px">Cliente: Grupo Industrial del Norte S.A.</div>
        <div style="border:1.5px solid #2563eb;background:rgba(37,99,235,0.05);padding:7px 10px;border-radius:6px;font-weight:700;font-size:13px;color:#0f172a;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
          <span>Importe Total: USD $ 18,450.00</span>
          <span style="font-size:10px;color:#2563eb;font-weight:600">Editable · Sin desbordar</span>
        </div>
        <div style="font-size:11px;color:#64748b">Vigencia confirmada al 30 de noviembre de 2026</div>
      </div>
    </div>
  `,
  images: `
    <div style="background:#ffffff;border-radius:8px;padding:15px;box-shadow:0 4px 16px rgba(15,23,42,0.08)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:10.5px;font-weight:800;color:#2563eb">IMAGEN LIMPIA SIN BORDES NI NOMBRES</span>
        <span style="font-size:10.5px;background:#f0fdf4;color:#15803d;padding:2px 8px;border-radius:4px;font-weight:600">Fondo blanco eliminado</span>
      </div>
      <div style="display:flex;gap:12px;align-items:center;border:1.5px dashed #60a5fa;border-radius:8px;padding:12px;background:#f8fafc">
        <img src="assets/logo-mark.svg" alt="Logo" style="width:44px;height:44px;border-radius:10px;flex-shrink:0" />
        <div style="font-size:12px;color:#334155;line-height:1.45">
          <strong style="color:#0f172a">Logotipo / Fotografía insertada</strong><br/>
          Escalable desde 8 puntos · Pegado directo con <b>Ctrl+V</b>
        </div>
      </div>
    </div>
  `,
  sign: `
    <div style="background:#ffffff;border-radius:8px;padding:15px;box-shadow:0 4px 16px rgba(15,23,42,0.08)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:10.5px;font-weight:800;color:#2563eb">FIRMA TRANSPARENTE Y SELLOS</span>
        <span style="font-size:10px;border:1.5px solid #15803d;color:#15803d;padding:1px 7px;border-radius:4px;font-weight:800">APROBADO</span>
      </div>
      <div style="border-bottom:1px solid #cbd5e1;padding:10px 6px 6px;text-align:center;margin-bottom:6px">
        <div style="font-family:Georgia,serif;font-style:italic;font-size:24px;color:#1e3a8a">Luis E. Flores</div>
      </div>
      <div style="font-size:11px;color:#64748b;text-align:center">Autorización Ejecutiva · Guardada localmente en tu bóveda</div>
    </div>
  `,
  winicon: `
    <div style="background:#ffffff;border-radius:8px;padding:15px;box-shadow:0 4px 16px rgba(15,23,42,0.08);display:flex;align-items:center;gap:14px">
      <img src="assets/pdf-doc-icon.svg" alt="Icono oficial PDF-LEF" style="width:62px;height:62px;flex-shrink:0" />
      <div style="font-size:12px;color:#334155;line-height:1.5">
        <strong style="color:#0f172a;font-size:13px">Diseño oficial en tus archivos .PDF</strong><br/>
        Todos los documentos PDF en tu Escritorio y Explorador de Windows adoptan el icono minimalista de PDF-LEF y abren al instante.
      </div>
    </div>
  `,
};

function setHeroMode(key) {
  const stage = document.getElementById('hero-interactive-stage');
  if (stage) {
    stage.innerHTML = HERO_PANELS[key] || HERO_PANELS.text;
  }
}

document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    setHeroMode(btn.getAttribute('data-mode'));
  });
});

setHeroMode('text');

// Auto-resolve direct .exe installer asset URL from latest GitHub Release when available
fetch('https://api.github.com/repos/Lycar-Desarrollos/PDF-LEF/releases/latest')
  .then((res) => (res.ok ? res.json() : null))
  .then((release) => {
    if (!release || !Array.isArray(release.assets)) return;
    const exeAsset = release.assets.find((a) => a.name && a.name.toLowerCase().endsWith('.exe'));
    if (exeAsset && exeAsset.browser_download_url) {
      ['nav-download-btn', 'hero-download-exe', 'footer-download-exe'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('href', exeAsset.browser_download_url);
      });
      const meta = document.getElementById('release-version-meta');
      if (meta && release.tag_name) {
        const sizeMb = exeAsset.size ? (exeAsset.size / (1024 * 1024)).toFixed(1) : '8.8';
        meta.textContent = `Versión ${release.tag_name} · Instalador verificado (${sizeMb} MB) · Windows 10 y Windows 11 (64-bit) · 100% Local`;
      }
    }
  })
  .catch(() => {});
