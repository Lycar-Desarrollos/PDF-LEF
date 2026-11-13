const PREVIEWS = {
  text: {
    paperHtml: `
      <div style="font-size:11px;font-weight:700;color:#c81e32;margin-bottom:6px">PROPUESTA EJECUTIVA · FOLIO LEF-0842</div>
      <div style="font-size:18px;font-weight:800;margin-bottom:14px">Acuerdo de Servicios Corporativos</div>
      <p style="font-size:13px;color:#4b515d;margin:0 0 14px">
        Haz clic sobre cualquier línea del documento para editar su contenido o arrastrarla libremente:
      </p>
      <div style="margin-bottom:12px">
        <span class="editable-demo-line">Importe Total Acordado: USD $ 2,450.00</span>
      </div>
      <div style="font-size:11.5px;color:#747b88">
        ↑ Bloque original del PDF detectado automáticamente: editable en sitio y movible sin perder el fondo.
      </div>
    `,
    title: 'Edición y movimiento directo sobre textos reales del PDF',
    desc: 'A diferencia de los visores básicos que solo enciman parches toscos, PDF-LEF detecta los bloques tipográficos de tu PDF, muestrea el color exacto del papel y te permite reescribir o reubicar cualquier texto.',
  },
  sign: {
    paperHtml: `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
        <div>
          <div style="font-weight:800;font-size:15px">Conformidad del Cliente</div>
          <div style="font-size:12px;color:#686d76">Documento listo para firma autorizada</div>
        </div>
        <div style="border:2px solid #0d7a5f;color:#0d7a5f;padding:3px 10px;border-radius:5px;font-weight:800;font-size:11px">
          APROBADO · 13/11/2026
        </div>
      </div>
      <div style="border:1px dashed #cbd5e1;border-radius:6px;padding:14px;text-align:center">
        <div style="font-family:Georgia,serif;font-style:italic;font-size:28px;color:#143b8c">Carlos Méndez</div>
        <div style="font-size:10.5px;color:#64748b">Firma transparente sin fondo blanco · Guardada en Bóveda Local</div>
      </div>
    `,
    title: 'Imágenes libres, sellos ejecutivos y firmas sin fondo',
    desc: 'Inserta logotipos o fotografías redimensionables desde 8 puntos de control y fotografía tu firma en papel para eliminar el fondo blanco al instante.',
  },
  pages: {
    paperHtml: `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center">
        <div style="border:2px solid #c81e32;border-radius:6px;padding:14px 8px;background:rgba(200,30,50,0.04)">
          <div style="font-weight:800;font-size:13px">Pág. 1</div>
          <div style="font-size:11px;color:#686d76">Portada</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:14px 8px">
          <div style="font-weight:800;font-size:13px">Pág. 2</div>
          <div style="font-size:11px;color:#686d76">Cláusulas</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:14px 8px">
          <div style="font-weight:800;font-size:13px">Pág. 3</div>
          <div style="font-size:11px;color:#686d76">Anexo</div>
        </div>
      </div>
    `,
    title: 'Mesa de Luz para unir, dividir y reordenar al vuelo',
    desc: 'Visualiza todas las páginas en cuadrícula, arrástralas para cambiar su orden, gíralas en lote, anexa otros PDFs externos o extrae una selección en un archivo nuevo.',
  },
  config: {
    paperHtml: `
      <div style="display:flex;flex-direction:column;gap:10px;font-size:12.5px">
        <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#f6f7f9;border-radius:6px">
          <strong>Tema Visual</strong><span>Claro Editorial / Oscuro Grafito</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#f6f7f9;border-radius:6px">
          <strong>Densidad de Interfaz</strong><span>Compacta · Estándar · Táctil</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#f6f7f9;border-radius:6px">
          <strong>Privacidad al Exportar</strong><span>Limpieza automática de metadatos</span>
        </div>
      </div>
    `,
    title: 'Centro de Configuración superior y paleta rápida Ctrl+K',
    desc: 'Personaliza colores de acento, escala tipográfica, nitidez HiDPI 4K, valores predeterminados de firma y exporta o importa tu perfil en formato JSON.',
  },
};

function renderStage(key) {
  const data = PREVIEWS[key] || PREVIEWS.text;
  const stage = document.getElementById('showcase-stage');
  if (!stage) return;
  stage.innerHTML = `
    <div class="mock-paper">${data.paperHtml}</div>
    <div>
      <div style="font-family:var(--font-mono);font-size:11.5px;color:var(--ruby);font-weight:700;margin-bottom:8px">
        VISTA INTERACTIVA DE MÓDULO
      </div>
      <h3 style="font-family:var(--font-display);font-size:22px;margin:0 0 10px;letter-spacing:-0.02em">
        ${data.title}
      </h3>
      <p style="margin:0;color:var(--text-body);font-size:14.5px;line-height:1.6">
        ${data.desc}
      </p>
    </div>
  `;
}

document.querySelectorAll('.mock-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mock-tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderStage(btn.getAttribute('data-tab'));
  });
});

renderStage('text');

// Theme switcher
const themeBtn = document.getElementById('web-theme-toggle');
if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
  });
}

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
        const sizeMb = exeAsset.size ? (exeAsset.size / (1024 * 1024)).toFixed(1) : '8.4';
        meta.textContent = `Versión ${release.tag_name} · Instalador verificado (${sizeMb} MB) · Windows 10 y Windows 11 (64-bit)`;
      }
    }
  })
  .catch(() => {});
