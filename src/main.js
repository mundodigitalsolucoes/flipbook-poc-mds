const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const bookEl = document.querySelector('#book');
const statusEl = document.querySelector('#status');
const pageCurrent = document.querySelector('#pageCurrent');
const pageTotal = document.querySelector('#pageTotal');
const viewerWrap = document.querySelector('#viewerWrap');
const zoomLabel = document.querySelector('#zoomLabel');
const pdfInput = document.querySelector('#pdfInput');

let pageFlip;
let zoom = 1;
let baseRatio = 1;

function setStatus(content = '') {
  if (!content) {
    statusEl.hidden = true;
    statusEl.innerHTML = '';
    return;
  }
  statusEl.hidden = false;
  statusEl.innerHTML = `<div class="empty-state"><strong>${content}</strong></div>`;
}

async function renderPdfPages(source) {
  setStatus('Carregando PDF…');
  const pdf = await pdfjsLib.getDocument(source).promise;
  pageTotal.textContent = String(pdf.numPages);
  pageCurrent.textContent = pdf.numPages ? '1' : '0';
  const imageUrls = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    setStatus(`Preparando página ${pageNumber} de ${pdf.numPages}…`);
    const page = await pdf.getPage(pageNumber);
    const unscaled = page.getViewport({ scale: 1 });
    if (pageNumber === 1) baseRatio = unscaled.width / unscaled.height;

    const renderScale = window.devicePixelRatio > 1.5 ? 1.65 : 1.4;
    const viewport = page.getViewport({ scale: renderScale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    imageUrls.push(canvas.toDataURL('image/jpeg', 0.9));
  }

  return imageUrls;
}

function destroyFlipbook() {
  if (pageFlip) {
    try { pageFlip.destroy(); } catch (error) { console.warn(error); }
    pageFlip = undefined;
  }
  bookEl.innerHTML = '';
}

function createFlipbook(imageUrls) {
  destroyFlipbook();
  const baseHeight = 720;
  const baseWidth = Math.round(baseHeight * baseRatio);

  pageFlip = new St.PageFlip(bookEl, {
    width: baseWidth,
    height: baseHeight,
    size: 'stretch',
    minWidth: 280,
    maxWidth: baseWidth,
    minHeight: 390,
    maxHeight: baseHeight,
    maxShadowOpacity: 0.35,
    showCover: true,
    mobileScrollSupport: false,
    usePortrait: true,
    autoSize: true,
    drawShadow: true,
    flippingTime: 650,
    startPage: 0,
  });

  pageFlip.loadFromImages(imageUrls);
  pageFlip.on('flip', (event) => {
    pageCurrent.textContent = String(event.data + 1);
  });
  pageFlip.on('changeOrientation', () => requestAnimationFrame(applyZoom));
  applyZoom();
}

async function openPdf(file) {
  if (!file) return;
  if (file.type !== 'application/pdf') {
    setStatus('Selecione um arquivo PDF válido.');
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const pages = await renderPdfPages({ data: new Uint8Array(buffer) });
    createFlipbook(pages);
    setStatus('');
  } catch (error) {
    console.error(error);
    setStatus('Não foi possível carregar este PDF.');
  }
}

function applyZoom() {
  bookEl.style.transform = `scale(${zoom})`;
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  viewerWrap.classList.toggle('is-zoomed', zoom > 1);
}

function setZoom(nextZoom) {
  zoom = Math.min(1.8, Math.max(0.8, nextZoom));
  applyZoom();
}

pdfInput.addEventListener('change', (event) => openPdf(event.target.files?.[0]));
document.querySelector('#prev').addEventListener('click', () => pageFlip?.flipPrev());
document.querySelector('#next').addEventListener('click', () => pageFlip?.flipNext());
document.querySelector('#zoomOut').addEventListener('click', () => setZoom(zoom - 0.1));
document.querySelector('#zoomIn').addEventListener('click', () => setZoom(zoom + 0.1));
document.querySelector('#fullscreen').addEventListener('click', async () => {
  if (!document.fullscreenElement) await viewerWrap.requestFullscreen();
  else await document.exitFullscreen();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') pageFlip?.flipPrev();
  if (event.key === 'ArrowRight') pageFlip?.flipNext();
  if (event.key === 'Escape' && zoom !== 1) setZoom(1);
});
