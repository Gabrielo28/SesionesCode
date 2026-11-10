/*
 * Reglas del acuerdo: canales, etapas y cálculo de comisión.
 * Lo usan el servidor (require) y el panel (window.REGLAS), así ambos calculan igual.
 */
(function (raiz) {
  // c = valor del parámetro ?c= en los links de anuncios y redes. g = genera comisión (gestión del coach).
  const CANALES = [
    { id: 'meta_ads', c: 'meta', nombre: 'Publicidad Meta (Instagram/Facebook)', g: true },
    { id: 'redes', c: 'ig', nombre: 'Redes de Impulz (posts, reels, bio)', g: true },
    { id: 'coach', c: 'coach', nombre: 'Redes del coach', g: true },
    { id: 'youtube', c: 'yt', nombre: 'YouTube y Shorts', g: true },
    { id: 'entrenachile', c: 'entrenachile', nombre: 'Perfil en entrenachile.cl', g: true },
    { id: 'reserva_web', c: '', nombre: 'Página de reservas (sin campaña)', g: true },
    { id: 'codigo', c: '', nombre: 'Código promocional de campaña', g: true },
    { id: 'coaching', c: '', nombre: 'Alumno de coaching', g: true },
    { id: 'meson', c: '', nombre: 'Llegó directo al gimnasio', g: false },
    { id: 'referido_socio', c: '', nombre: 'Referido de un socio', g: false },
    { id: 'ex_socio', c: '', nombre: 'Ex socio del gimnasio', g: false },
    { id: 'otro', c: '', nombre: 'Otro / no sabe', g: false }
  ];
  const ETAPAS = ['Contacto', 'Prueba agendada', 'Prueba asistida', 'Inscrito', 'No se inscribió'];

  const canal = id => CANALES.find(x => x.id === id) || CANALES[CANALES.length - 1];
  const canalDesdeParametro = c => (CANALES.find(x => x.c && x.c === String(c || '').toLowerCase()) || canal('reserva_web')).id;
  const esGestion = l => canal(l.canal).g;
  const mesDe = fecha => String(fecha || '').slice(0, 7);

  // Comisión de cada pago de un contacto: el reloj parte en su primer pago.
  function detallePagos(l, cfg) {
    const pagos = [...(l.pagos || [])].sort((a, b) => (a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0));
    const pase = /pase/i.test(l.plan || '');
    return pagos.map((p, i) => {
      const pct = !esGestion(l) ? 0 : pase ? +cfg.pctPase : i === 0 ? +cfg.pctPrimer : i <= +cfg.mesesRecurrente ? +cfg.pctRecurrente : 0;
      const monto = +p.monto || 0;
      return { mes: p.mes, monto, n: i + 1, pct, valor: Math.round(monto * pct / 100) };
    });
  }

  // Al pasar a "Inscrito" se registra la fecha y el primer pago, si no estaban.
  function conInscripcion(l, cfg, hoy) {
    if (l.etapa !== 'Inscrito') return l;
    const r = { ...l };
    if (!r.fechaInscripcion) r.fechaInscripcion = hoy;
    if (!r.pagos || !r.pagos.length) r.pagos = [{ mes: mesDe(r.fechaInscripcion), monto: +r.monto || +cfg.mensualidad }];
    return r;
  }

  const REGLAS = { CANALES, ETAPAS, canal, canalDesdeParametro, esGestion, mesDe, detallePagos, conInscripcion };
  if (typeof module !== 'undefined' && module.exports) module.exports = REGLAS; else raiz.REGLAS = REGLAS;
})(typeof window !== 'undefined' ? window : globalThis);
