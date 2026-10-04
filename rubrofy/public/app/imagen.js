// Prepara una foto antes de subirla: el navegador la abre y la vuelve a
// guardar como JPEG de máximo 2048 px por lado. Así las fotos del iPhone
// (HEIC), las que vienen giradas (EXIF) y las muy pesadas del celular quedan
// en un formato que se ve en cualquier navegador, Instagram las acepta y
// suben rápido con datos móviles. Un PNG o WebP chico se sube tal cual
// (puede tener transparencia).
(function () {
  'use strict';
  const MAX_LADO = 2048;
  const MAX_SIN_TOCAR = 3 * 1024 * 1024;
  const EXT_IMAGEN = /\.(jpe?g|png|webp|heic|heif|gif|bmp|avif|tiff?)$/i;

  // Algunos celulares Android entregan la foto sin tipo: se mira el nombre.
  function esImagen(file) {
    return !!file && (/^image\//.test(file.type || '') || (!file.type && EXT_IMAGEN.test(file.name || '')));
  }

  async function abrir(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* se prueba con <img> */ }
    }
    return new Promise((ok, mal) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('no se pudo abrir')); };
      img.src = url;
    });
  }

  function error(texto) {
    const err = new Error(texto);
    err.mensaje = texto;
    return err;
  }

  // Devuelve un File listo para subir (o el mismo si no hace falta tocarlo).
  async function preparar(file, { maxLado = MAX_LADO, calidad = 0.88 } = {}) {
    if (!esImagen(file)) throw error('Ese archivo no es una foto. Elige una imagen JPG, PNG o de tu galería.');
    let fuente;
    try {
      fuente = await abrir(file);
    } catch (e) {
      throw error(/hei[cf]/i.test(`${file.type} ${file.name}`)
        ? 'Esta foto está en formato HEIC y este navegador no puede abrirla. Súbela desde el iPhone (Safari la convierte sola) o en el iPhone ve a Ajustes → Cámara → Formatos → "Más compatible".'
        : 'No pudimos abrir esa imagen. Prueba con una foto JPG o PNG.');
    }
    const ancho = fuente.width || fuente.naturalWidth;
    const alto = fuente.height || fuente.naturalHeight;
    const escala = Math.min(1, maxLado / Math.max(ancho, alto));
    const tal = /^image\/(png|webp)$/.test(file.type) && escala === 1 && file.size <= MAX_SIN_TOCAR;
    if (tal) { if (fuente.close) fuente.close(); return file; }
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(ancho * escala));
    lienzo.height = Math.max(1, Math.round(alto * escala));
    const g = lienzo.getContext('2d');
    g.fillStyle = '#ffffff'; // lo transparente queda blanco en el JPEG
    g.fillRect(0, 0, lienzo.width, lienzo.height);
    g.imageSmoothingQuality = 'high';
    g.drawImage(fuente, 0, 0, lienzo.width, lienzo.height);
    if (fuente.close) fuente.close();
    const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', calidad));
    if (!blob) throw error('No pudimos preparar la foto. Intenta de nuevo.');
    const nombre = (String(file.name || 'foto').replace(/\.[^.]*$/, '') || 'foto') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg' });
  }

  function aBase64(file) {
    return new Promise((ok, mal) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1] || '');
      r.onerror = mal;
      r.readAsDataURL(file);
    });
  }

  window.RubrofyImagen = { esImagen, preparar, aBase64 };
})();
