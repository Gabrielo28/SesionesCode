// Servidor del Agente Multi-Nicho. Node puro, sin dependencias externas
// (mismo criterio que colchones-yole): un archivo sirve la web y la API.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const store = require('./store');
const { listNichos, getNicho } = require('./nichos');
const { generarBanco, generarVarianteConClaude } = require('./generator');

const PORT = process.env.PORT || 5180;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const FOTO_EXTENSIONES = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function slugify(str) {
  const base = String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return base || 'negocio';
}

function idUnico(base) {
  let id = base;
  let n = 2;
  while (store.getNegocio(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function notFound(res) {
  sendJSON(res, 404, { error: 'No encontrado' });
}

function readBody(req, maxBytes) {
  const limit = maxBytes || 1e6;
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > limit) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR)) return notFound(res);

  fs.readFile(filePath, (err, content) => {
    if (err) return notFound(res);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

function encontrarItem(items, itemId) {
  return items.find((it) => it.id === itemId);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    // --- API ---
    if (parts[0] === 'api') {
      // GET /api/nichos
      if (parts[1] === 'nichos' && parts.length === 2 && req.method === 'GET') {
        return sendJSON(res, 200, listNichos());
      }

      // GET /api/negocios
      if (parts[1] === 'negocios' && parts.length === 2 && req.method === 'GET') {
        return sendJSON(res, 200, store.listNegocios());
      }

      // POST /api/negocios  { nombre, nicho, datos }
      if (parts[1] === 'negocios' && parts.length === 2 && req.method === 'POST') {
        const body = await readBody(req);
        const nombre = (body.nombre || '').trim();
        const nichoId = body.nicho;
        if (!nombre) return sendJSON(res, 400, { error: 'Falta el nombre del negocio' });
        if (!getNicho(nichoId)) return sendJSON(res, 400, { error: 'Nicho inválido' });

        const id = idUnico(slugify(nombre));
        const negocio = {
          id,
          nombre,
          nicho: nichoId,
          marca: { color: '#e6a23a' },
          datos: {
            precioDesde: body.datos && body.datos.precioDesde ? String(body.datos.precioDesde).trim() : '',
            unidad: body.datos && body.datos.unidad ? String(body.datos.unidad).trim() : '',
            promo: body.datos && body.datos.promo ? String(body.datos.promo).trim() : '',
            productoDestacado: body.datos && body.datos.productoDestacado ? String(body.datos.productoDestacado).trim() : '',
          },
        };
        store.saveNegocio(negocio);
        store.saveContenido(id, generarBanco(negocio, 6, 0));
        return sendJSON(res, 201, negocio);
      }

      if (parts[1] === 'negocios' && parts.length >= 3) {
        const negocioId = parts[2];
        const negocio = store.getNegocio(negocioId);
        if (!negocio) return sendJSON(res, 404, { error: 'Negocio no encontrado' });

        // GET /api/negocios/:id
        if (parts.length === 3 && req.method === 'GET') {
          return sendJSON(res, 200, negocio);
        }

        // GET /api/negocios/:id/contenido
        if (parts[3] === 'contenido' && parts.length === 4 && req.method === 'GET') {
          return sendJSON(res, 200, store.getContenido(negocioId));
        }

        // GET /api/negocios/:id/nicho  (plantilla completa: enfoques + categorías de foto)
        if (parts[3] === 'nicho' && parts.length === 4 && req.method === 'GET') {
          const nicho = getNicho(negocio.nicho);
          return sendJSON(res, 200, nicho);
        }

        // GET /api/negocios/:id/fotos
        if (parts[3] === 'fotos' && parts.length === 4 && req.method === 'GET') {
          return sendJSON(res, 200, store.listFotos(negocioId));
        }

        // POST /api/negocios/:id/fotos  { categoria, filename, dataBase64 }
        if (parts[3] === 'fotos' && parts.length === 4 && req.method === 'POST') {
          const nicho = getNicho(negocio.nicho);
          const body = await readBody(req, 15e6);
          const categoria = body.categoria;
          if (!nicho.categoriasFoto.includes(categoria)) {
            return sendJSON(res, 400, { error: 'Categoría de foto inválida' });
          }
          const extOriginal = path.extname(body.filename || '').toLowerCase();
          const ext = FOTO_EXTENSIONES.has(extOriginal) ? extOriginal : '.jpg';
          const nombreArchivo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
          const base64 = String(body.dataBase64 || '').replace(/^data:[^,]+,/, '');
          if (!base64) return sendJSON(res, 400, { error: 'Falta la imagen' });

          store.addFoto(negocioId, categoria, nombreArchivo, Buffer.from(base64, 'base64'));
          return sendJSON(res, 201, store.listFotos(negocioId));
        }

        // DELETE /api/negocios/:id/fotos/:categoria/:archivo
        if (parts[3] === 'fotos' && parts.length === 6 && req.method === 'DELETE') {
          const [, , , , categoria, archivo] = parts;
          store.deleteFoto(negocioId, categoria, archivo);
          return sendJSON(res, 200, store.listFotos(negocioId));
        }

        // POST /api/negocios/:id/generar  { cantidad }
        if (parts[3] === 'generar' && parts.length === 4 && req.method === 'POST') {
          const body = await readBody(req);
          const cantidad = Number(body.cantidad) || 6;
          const actuales = store.getContenido(negocioId);
          const nuevos = generarBanco(negocio, cantidad, actuales.length);
          const items = actuales.concat(nuevos);
          store.saveContenido(negocioId, items);
          return sendJSON(res, 200, items);
        }

        // Acciones sobre un item: /api/negocios/:id/contenido/:itemId/:accion
        if (parts[3] === 'contenido' && parts.length === 6) {
          const itemId = parts[4];
          const accion = parts[5];
          const items = store.getContenido(negocioId);
          const item = encontrarItem(items, itemId);
          if (!item) return sendJSON(res, 404, { error: 'Contenido no encontrado' });

          if (accion === 'aprobar' && req.method === 'POST') {
            item.status = 'aprobado';
          } else if (accion === 'rechazar' && req.method === 'POST') {
            item.status = 'rechazado';
          } else if (accion === 'deshacer' && req.method === 'POST') {
            item.status = 'pendiente';
          } else if (accion === 'editar' && req.method === 'PUT') {
            const body = await readBody(req);
            if (typeof body.caption === 'string') {
              item.variants[item.variantIndex] = body.caption;
            }
          } else if (accion === 'regenerar' && req.method === 'POST') {
            if (item.variantIndex + 1 < item.variants.length) {
              item.variantIndex += 1;
            } else {
              const nueva = await generarVarianteConClaude(negocio, item.enfoqueId, item.variants);
              if (nueva) {
                item.variants.push(nueva);
                item.variantIndex = item.variants.length - 1;
              } else {
                item.variantIndex = 0; // sin API key: vuelve a rotar desde la primera
              }
            }
          } else {
            return sendJSON(res, 400, { error: 'Acción o método inválido' });
          }

          store.saveContenido(negocioId, items);
          return sendJSON(res, 200, item);
        }
      }

      return notFound(res);
    }

    // --- fotos subidas: /fotos/:negocioId/:categoria/:archivo ---
    if (parts[0] === 'fotos' && parts.length === 4 && req.method === 'GET') {
      const [, negocioId, categoria, archivo] = parts;
      const filePath = store.fotoAbsolutePath(
        path.basename(negocioId),
        path.basename(categoria),
        path.basename(archivo)
      );
      if (!filePath.startsWith(store.FOTOS_DIR)) return notFound(res);
      return fs.readFile(filePath, (err, content) => {
        if (err) return notFound(res);
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(content);
      });
    }

    // --- estáticos ---
    if (req.method === 'GET') return serveStatic(req, res, url.pathname);
    return notFound(res);
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: 'Error interno', detalle: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Agente Multi-Nicho corriendo en http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY no configurada: "Otra versión" solo rota entre variantes precalculadas.');
  }
});
