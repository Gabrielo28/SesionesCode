// Análisis de publicidad común a Meta Ads y Google Ads: variación contra el
// período anterior y un diagnóstico en palabras simples, con reglas
// explicables (no IA) para que el dueño sepa qué hacer con su presupuesto.

const CLAVES = ['gasto', 'resultados', 'costoPorResultado', 'ctr', 'cpm', 'clics', 'roas'];

// Variación relativa de cada indicador (0.25 = +25 %). null si no hay base.
function comparar(actual, anterior) {
  const out = {};
  for (const k of CLAVES) {
    const a = actual[k];
    const b = anterior[k];
    out[k] = a == null || b == null || b === 0 ? null : (a - b) / b;
  }
  out.hayBase = (anterior.gasto || 0) > 0;
  return out;
}

const PCT = (v) => `${Math.round(Math.abs(v) * 100)} %`;

// Estados de Meta en que una campaña o un anuncio ya no corre: no se
// recomienda apagar lo que ya está apagado (Google no entrega estado).
const APAGADO = new Set(['PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'ARCHIVED', 'DELETED', 'DISAPPROVED']);
const apagado = (estado) => APAGADO.has(estado);

// Ubicación de Meta → formato de Rubrofy para "Crear esta pieza en Rubrofy".
function formatoParaUbicacion(posicion) {
  if (/reels/.test(posicion || '')) return 'reel';
  if (/stor/.test(posicion || '')) return 'historia';
  return 'post';
}

// dinero: función que formatea montos en la moneda de la cuenta.
// Cada hallazgo puede traer un "destino": dónde se hace el cambio en la
// plataforma de anuncios (tipo campanas | anuncios | conjuntos, los ids y
// "que": cómo se le dice al dueño lo que se abre). El enlace lo arma cada
// plataforma (ver enlaceAdministrador en meta.js).
// Cada hallazgo con destino trae además (ver aprendizaje-ads.js):
//   regla y clave: qué recomendación es y sobre qué (la clave no cambia entre
//     un día y otro, así Rubrofy reconoce la misma recomendación);
//   alternativa: qué proponer si el dueño ya lo hizo y no funcionó;
//   cambio: la acción en pocas palabras (así aparece en "Tus cambios").
function diagnostico({ resumen, anterior, desgloses, dinero }) {
  const t = resumen.total;
  const hallazgos = [];
  const agregar = (nivel, titulo, detalle, accion, destino, extra) => hallazgos.push(Object.assign(
    { nivel, titulo, detalle, accion: accion || null, destino: destino || null }, extra || {}));
  const nombres = (l) => (l.length === 1 ? `"${l[0]}"` : `${l.slice(0, -1).map((x) => `"${x}"`).join(', ')} y "${l[l.length - 1]}"`);
  if (!t.gasto) return hallazgos;

  // Solo las campañas que siguen corriendo: si el dueño ya pausó una, no se
  // le pide que la pause o le mueva presupuesto.
  const campanas = resumen.campanas.filter((c) => c.gasto > 0 && !apagado(c.estado));
  const conResultados = campanas.filter((c) => c.resultados > 0 && c.costoPorResultado != null);

  // 1. Campañas que gastan sin resultados.
  for (const c of campanas) {
    if (!c.resultados && c.gasto >= t.gasto * 0.1) {
      agregar('alerta', `"${c.nombre}" gastó ${dinero(c.gasto)} sin resultados`,
        `Es el ${PCT(c.gasto / t.gasto)} de tu inversión del período.`,
        'Revisa que su objetivo sea el que buscas (mensajes, ventas o formularios) o pausa la campaña y pasa ese presupuesto a la que mejor rinde.',
        { tipo: 'campanas', ids: [c.id], que: `la campaña "${c.nombre}"` },
        { regla: 'campana-sin-resultados', clave: `campana-sin-resultados:${c.id}`, cambio: `Pausar o revisar la campaña "${c.nombre}"`,
          alternativa: `Pausarla no bajó tu costo general. Revisa el objetivo de "${c.nombre}": si buscas mensajes, elige el objetivo de mensajes con WhatsApp como destino; si vendes en tu web, el de ventas con el píxel instalado.` });
    }
  }

  // 2. Mejor y peor costo por resultado.
  if (conResultados.length >= 2 && t.costoPorResultado) {
    const orden = conResultados.slice().sort((a, b) => a.costoPorResultado - b.costoPorResultado);
    const mejor = orden[0];
    const peor = orden[orden.length - 1];
    if (peor.costoPorResultado >= mejor.costoPorResultado * 1.5) {
      agregar('idea', `Cada resultado de "${peor.nombre}" cuesta ${(peor.costoPorResultado / mejor.costoPorResultado).toLocaleString('es-CL', { maximumFractionDigits: 1 })} veces más que en "${mejor.nombre}"`,
        `${dinero(peor.costoPorResultado)} contra ${dinero(mejor.costoPorResultado)} por resultado.`,
        `Mueve parte del presupuesto de "${peor.nombre}" a "${mejor.nombre}" de a poco (20 % cada 3 o 4 días) y mira si el costo se mantiene.`,
        { tipo: 'campanas', ids: [peor.id, mejor.id], que: `las campañas ${nombres([peor.nombre, mejor.nombre])}` },
        { regla: 'costo-campanas', clave: `costo-campanas:${peor.id}:${mejor.id}`, cambio: `Mover presupuesto de "${peor.nombre}" a "${mejor.nombre}"`,
          alternativa: `Mover presupuesto no bajó el costo. Esta vez copia en "${peor.nombre}" el anuncio que mejor funciona en "${mejor.nombre}" (misma imagen y texto) y apaga el que rinde menos.` });
    }
  }

  // 3. Anuncios que no llaman la atención (CTR bajo con volumen suficiente).
  for (const c of campanas) {
    if (c.impresiones >= 2000 && c.ctr != null && c.ctr < 0.008) {
      agregar('alerta', `Pocos hacen clic en "${c.nombre}" (CTR ${(c.ctr * 100).toLocaleString('es-CL', { maximumFractionDigits: 2 })} %)`,
        'Menos de 1 de cada 125 personas que lo ven hace clic: el anuncio no está llamando la atención.',
        'Prueba otra imagen o video con el producto y el precio en los primeros segundos, y un texto más directo.',
        { tipo: 'anuncios', campanas: [c.id], que: `los anuncios de "${c.nombre}"` },
        { regla: 'ctr-bajo', clave: `ctr-bajo:${c.id}`, cambio: `Cambiar los anuncios de "${c.nombre}"`,
          alternativa: 'Cambiar la imagen no subió los clics. Esta vez prueba un video corto (6 a 15 segundos) o revisa el público: puede que el anuncio le llegue a gente a la que no le interesa.' });
    }
  }

  // 4. Ventas que no pagan la inversión.
  if (t.roas != null && t.roas < 1) {
    agregar('alerta', 'Las ventas atribuidas no cubren lo invertido',
      `Por cada ${dinero(1000)} invertidos vuelven ${dinero(t.roas * 1000)} en ventas registradas.`,
      'Si también vendes por WhatsApp o en el local, esas ventas no aparecen acá: compara con tu caja antes de cortar la campaña.',
      { tipo: 'campanas', que: 'tus campañas' },
      { regla: 'roas-bajo', clave: 'roas-bajo', cambio: 'Revisar si las ventas cubren la inversión',
        alternativa: 'Si sumando las ventas por WhatsApp y en el local tampoco cubres lo invertido, baja el presupuesto a la mitad y deja solo la campaña con mejor costo por resultado.' });
  }

  // 5. Contra el período anterior.
  if (anterior && anterior.gasto > 0) {
    const cpr = t.costoPorResultado;
    const cprAntes = anterior.costoPorResultado;
    if (cpr != null && cprAntes != null) {
      const v = (cpr - cprAntes) / cprAntes;
      if (v >= 0.25) {
        agregar('alerta', `El costo por resultado subió ${PCT(v)} contra el período anterior`,
          `De ${dinero(cprAntes)} a ${dinero(cpr)}.`,
          'Suele pasar cuando el mismo público ya vio muchas veces el anuncio: cambia la imagen o el texto, o amplía el público.',
          { tipo: 'anuncios', que: 'tus anuncios' },
          { regla: 'costo-subio', clave: 'costo-subio', cambio: 'Renovar los anuncios o ampliar el público',
            alternativa: 'Cambiar el anuncio no bajó el costo. Esta vez amplía el público (más edades o más comunas) o deja que Meta elija las ubicaciones.' });
      } else if (v <= -0.2) {
        agregar('bien', `El costo por resultado bajó ${PCT(v)} contra el período anterior`, `De ${dinero(cprAntes)} a ${dinero(cpr)}.`,
          'Lo que cambiaste está funcionando: si el negocio da abasto, es buen momento para subir el presupuesto de a poco.',
          { tipo: 'campanas', que: 'tus campañas' },
          { regla: 'costo-bajo', clave: 'costo-bajo', cambio: 'Subir el presupuesto de a poco',
            alternativa: 'La última vez que subiste la inversión el costo por resultado subió. Esta vez sube de a 10 % cada 4 o 5 días y vuelve a mirar antes de seguir.' });
      }
    } else if (!t.resultados && anterior.resultados > 0) {
      agregar('alerta', 'Este período no hubo resultados y el anterior sí', 'Algo cambió en las campañas o en el seguimiento de conversiones.',
        'Revisa si se pausó una campaña, se cambió el objetivo o dejó de funcionar el píxel.',
        { tipo: 'campanas', que: 'tus campañas' },
        { regla: 'sin-resultados-periodo', clave: 'sin-resultados-periodo', cambio: 'Revisar campañas y seguimiento de conversiones',
          alternativa: 'Si las campañas están activas y con el mismo objetivo, revisa el seguimiento: en el Administrador de eventos de Meta mira si el píxel o la API de conversiones siguen recibiendo eventos.' });
    }
  }

  // 6. Desgloses (solo Meta).
  if (desgloses) {
    const minimo = (f) => f.resultados >= 3 && f.costoPorResultado != null;
    const publico = desgloses.edadSexo.filter(minimo).sort((a, b) => a.costoPorResultado - b.costoPorResultado);
    if (publico.length >= 2 && t.costoPorResultado) {
      const p = publico[0];
      if (p.costoPorResultado <= t.costoPorResultado * 0.8) {
        agregar('idea', `Tu público más barato: ${p.sexoNombre.toLowerCase()} de ${p.edad} años`,
          `Cada resultado cuesta ${dinero(p.costoPorResultado)}, ${PCT(1 - p.costoPorResultado / t.costoPorResultado)} menos que el promedio.`,
          'Crea un conjunto de anuncios enfocado en ese grupo o usa sus intereses para una campaña nueva.',
          { tipo: 'conjuntos', que: 'tus conjuntos de anuncios (ahí se elige el público)' },
          { regla: 'publico', clave: `publico:${p.edad}|${p.sexo}`, cambio: `Enfocar un conjunto de anuncios en ${p.sexoNombre.toLowerCase()} de ${p.edad} años`,
            alternativa: 'Enfocarte en ese grupo no bajó el costo. Esta vez prueba un público similar a tus clientes (en Meta: "Público similar") o intereses parecidos en vez de solo la edad.' });
      }
    }
    const lugares = desgloses.ubicaciones.filter(minimo).sort((a, b) => a.costoPorResultado - b.costoPorResultado);
    if (lugares.length >= 2) {
      const m = lugares[0];
      const peor = lugares[lugares.length - 1];
      if (peor.costoPorResultado >= m.costoPorResultado * 1.5) {
        agregar('idea', `${m.nombre} te da resultados más baratos que ${peor.nombre}`,
          `${dinero(m.costoPorResultado)} contra ${dinero(peor.costoPorResultado)} por resultado.`,
          `Haz piezas pensadas para ${m.nombre.split(' · ')[1] || m.nombre} (formato vertical si son Historias o Reels).`,
          { tipo: 'conjuntos', que: 'tus conjuntos de anuncios (ahí se eligen las ubicaciones)' },
          { regla: 'ubicacion', clave: `ubicacion:${m.plataforma}|${m.posicion}`, cambio: `Enfocar los anuncios en ${m.nombre}`,
            alternativa: `Enfocarte en ${m.nombre} no bajó el costo. Esta vez deja que Meta elija las ubicaciones (Advantage+) y renueva la imagen o el video.`,
            pieza: { formato: formatoParaUbicacion(m.posicion), lugar: m.nombre } });
      }
    }
    const conGasto = desgloses.anuncios.filter((a) => a.gasto > 0 && !apagado(a.estado));
    const muertos = conGasto.filter((a) => !a.resultados && a.gasto >= t.gasto * 0.1);
    if (muertos.length) {
      agregar('alerta', muertos.length === 1 ? `El anuncio "${muertos[0].nombre}" no trae resultados` : `${muertos.length} anuncios gastan sin traer resultados`,
        muertos.length === 1 ? `Gastó ${dinero(muertos[0].gasto)} en el período.` : `Suman ${dinero(muertos.reduce((s, a) => s + a.gasto, 0))} en el período.`,
        muertos.length === 1 ? 'Apágalo y deja correr los anuncios que sí convierten.' : 'Apágalos y deja correr los que sí convierten.',
        { tipo: 'anuncios', ids: muertos.map((a) => a.id), que: muertos.length === 1 ? `el anuncio "${muertos[0].nombre}"` : `los anuncios ${nombres(muertos.map((a) => a.nombre))}` },
        { regla: 'anuncios-sin-resultados', clave: `anuncios-sin-resultados:${muertos.map((a) => a.id).sort().join(',')}`,
          cambio: muertos.length === 1 ? `Apagar el anuncio "${muertos[0].nombre}"` : `Apagar ${muertos.length} anuncios sin resultados`,
          alternativa: 'Apagar no bajó tu costo general. Revisa que los anuncios que quedaron tengan presupuesto suficiente y renueva la imagen del que mejor funciona.' });
    }
  }

  if (!hallazgos.length) {
    agregar('bien', 'No vemos problemas en tus campañas', 'Los costos están parejos entre campañas y los anuncios llaman la atención.',
      'Mantén el presupuesto y renueva las imágenes cada 2 o 3 semanas para que no se gasten.');
  }
  const peso = { alerta: 0, idea: 1, bien: 2 };
  return hallazgos.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
}

function formatoDinero(moneda) {
  const m = moneda || 'CLP';
  return (v) => {
    try {
      return Number(v).toLocaleString('es-CL', { style: 'currency', currency: m, maximumFractionDigits: m === 'CLP' ? 0 : 2 });
    } catch (err) {
      return '$' + Math.round(v).toLocaleString('es-CL');
    }
  };
}

// Todo lo que el panel necesita para una fuente: período actual, anterior,
// variación y diagnóstico.
// primeraFecha: el primer día con datos de la fuente. Si el período anterior
// no está completo (la cuenta se conectó hace poco), no se compara: un
// "+2900 %" contra un solo día sería engañoso.
// enlaceDe(destino): la dirección para hacer el cambio en la plataforma
// (si no se entrega, los hallazgos van sin botón).
function analizar({ resumenDe, desglosesDe, desde, hasta, dias, moneda, sumarDias, primeraFecha, enlaceDe }) {
  const resumen = resumenDe(desde, hasta);
  const inicioAnterior = sumarDias(desde, -dias);
  const completo = primeraFecha && primeraFecha <= inicioAnterior;
  const anterior = completo ? resumenDe(inicioAnterior, sumarDias(desde, -1)).total : { gasto: 0 };
  const desgloses = desglosesDe ? desglosesDe(desde, hasta) : null;
  return {
    resumen,
    anterior: completo ? anterior : null,
    variacion: comparar(resumen.total, anterior),
    desgloses,
    diagnostico: diagnostico({ resumen, anterior: completo ? anterior : null, desgloses, dinero: formatoDinero(moneda) })
      .map((h) => (h.destino && enlaceDe ? Object.assign(h, { enlace: enlaceDe(h.destino) }) : h)),
  };
}

module.exports = { comparar, diagnostico, analizar, formatoDinero, apagado, formatoParaUbicacion };
