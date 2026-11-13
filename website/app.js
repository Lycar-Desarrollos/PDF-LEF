const HERO_PANELS = {
  general: `
    <div style="background:#ffffff;border-radius:8px;padding:16px;box-shadow:0 4px 14px rgba(0,0,0,0.08)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:10.5px;font-weight:800;color:#c81e32">EDICIÓN DIRECTA EN PÁGINA</span>
        <span style="font-size:10.5px;background:#f1f5f9;padding:2px 8px;border-radius:4px">Texto + Imagen activa</span>
      </div>
      <div style="border:1.5px solid #c81e32;background:rgba(200,30,50,0.04);padding:8px 10px;border-radius:6px;font-weight:700;font-size:13.5px;margin-bottom:10px">
        Presupuesto Actualizado: USD $ 14,850.00 <span style="font-size:10px;color:#c81e32;font-weight:600">← Editable y arrastrable</span>
      </div>
      <div style="display:flex;gap:10px;align-items:center;border:1px dashed #94a3b8;border-radius:6px;padding:10px;background:#f8fafc">
        <img src="assets/icon-256.png" alt="Logo" style="width:36px;height:36px;border-radius:6px" />
        <div style="font-size:11.5px;color:#334155">
          <strong>Imagen / Fotografía subida</strong><br/>
          Redimensionable desde 8 esquinas · Soporte Pegar con Ctrl+V
        </div>
      </div>
    </div>
  `,
  eng: `
    <div style="background:#0c2340;color:#e0f2fe;border-radius:8px;padding:16px;font-family:Consolas,monospace">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:10px;color:#7dd3fc">
        <span>MODO INGENIERÍA · ESCALA 1:100</span>
        <span>FILTRO BLUEPRINT</span>
      </div>
      <div style="border:1.5px solid #38bdf8;height:110px;position:relative;display:flex;align-items:center;justify-content:center;margin-bottom:10px">
        <span style="position:absolute;top:6px;background:#0284c7;color:#fff;padding:1px 7px;border-radius:4px;font-size:10.5px">Cota: 18.40 m</span>
        <span style="border:1px dashed #34d399;background:rgba(16,185,129,0.2);padding:5px 10px;border-radius:4px;font-size:12px;font-weight:700">Área: 176.64 m²</span>
      </div>
      <div style="font-size:10.5px;color:#bae6fd">✓ Cajetín técnico + Globos numerados ① ② listos para exportar</div>
    </div>
  `,
  acc: `
    <div style="background:#ffffff;border-radius:8px;padding:14px;box-shadow:0 4px 14px rgba(0,0,0,0.08);font-size:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-weight:700;color:#0d7a5f">
        <span>AUDITORÍA CONTABLE + CINTA IVA</span>
        <span>Exportar .CSV Excel →</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 8px;background:#f8fafc;border-radius:5px;margin-bottom:5px">
        <span>FAC-901 · Suministro Industrial</span>
        <strong>$18,500.00 ✓</strong>
      </div>
      <div style="padding:8px 10px;background:#f0fdf4;border:1px solid #0d7a5f;border-radius:6px;font-family:Consolas,monospace;font-size:11.5px">
        Subtotal: $24,950.00 | IVA (16%): $3,992.00<br/>
        <strong style="color:#0d7a5f">TOTAL AUDITADO: $28,942.00 [CONTABILIZADO]</strong>
      </div>
    </div>
  `,
  adm: `
    <div style="background:#ffffff;border-radius:8px;padding:15px;box-shadow:0 4px 14px rgba(0,0,0,0.08)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px">
          <img src="assets/icon-256.png" alt="Logo" style="width:26px;height:26px;border-radius:5px" />
          <strong style="font-size:12px">Bóveda de Logos: Lycar Desarrollos</strong>
        </div>
        <span style="font-size:10px;border:1.5px solid #c81e32;color:#c81e32;padding:2px 6px;border-radius:4px;font-weight:800">RECIBIDO</span>
      </div>
      <div style="border:1px dashed #cbd5e1;border-radius:6px;padding:12px;text-align:center">
        <div style="font-family:Georgia,serif;font-style:italic;font-size:23px;color:#1e3a8a">Ing. Luis E. Flores</div>
        <div style="font-size:10.5px;color:#64748b">Firma sin fondo blanco + Folio Bates LEF-00001</div>
      </div>
    </div>
  `,
};

function setHeroDept(key) {
  const stage = document.getElementById('hero-interactive-stage');
  if (stage) {
    stage.innerHTML = HERO_PANELS[key] || HERO_PANELS.general;
  }
}

document.querySelectorAll('.dept-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dept-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    setHeroDept(btn.getAttribute('data-dept'));
  });
});

setHeroDept('general');

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
        meta.textContent = `Versión ${release.tag_name} · Instalador verificado (${sizeMb} MB) · Windows 10 y Windows 11 (64-bit) · 100% Offline`;
      }
    }
  })
  .catch(() => {});
