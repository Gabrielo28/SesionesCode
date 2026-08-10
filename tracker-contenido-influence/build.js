const ExcelJS = require('exceljs');

const FONT = { name: 'Arial', size: 10 };
const FONT_BOLD = { name: 'Arial', size: 10, bold: true };
const FONT_TITLE = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1F3864' } };
const YELLOW = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
const HEADER_FONT = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
const N_ROWS = 20; // filas de clientes precargadas en Plan / Dashboards
const PLAN_FIRST_ROW = 5;
const PLAN_LAST_ROW = PLAN_FIRST_ROW + N_ROWS - 1;

const wb = new ExcelJS.Workbook();
wb.calcProperties.fullCalcOnLoad = true;
wb.creator = 'Influence Chile';

function styleHeaderRow(ws, rowNum, lastCol) {
  const row = ws.getRow(rowNum);
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber > lastCol) return;
  });
  for (let c = 1; c <= lastCol; c++) {
    const cell = row.getCell(c);
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
  }
  row.height = 30;
}

function setColWidths(ws, widths) {
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

/* ---------------- Instrucciones ---------------- */
const wsInfo = wb.addWorksheet('Instrucciones');
setColWidths(wsInfo, [95]);
wsInfo.getCell('A1').value = 'Tracker de cumplimiento de contenido — Influence Chile';
wsInfo.getCell('A1').font = FONT_TITLE;
const infoLines = [
  '',
  'Qué es esto: una planilla para saber, por cliente, cuánto contenido llevas publicado esta',
  'semana y este mes frente a lo pactado en el plan (posts, reels, historias). No publica nada',
  'por ti — tú sigues publicando manualmente en Instagram y solo registras lo que ya subiste.',
  '',
  'Cómo usarla:',
  '1) Pestaña "Plan": escribe cada cliente y su cantidad pactada de posts/reels/historias',
  '   por semana y/o por mes (deja en blanco lo que no aplique a ese cliente).',
  '2) Pestaña "Registro": cada vez que publiques algo, agrega una fila con la fecha, el',
  '   cliente, el tipo de contenido y una descripción o link. Usa los menús desplegables.',
  '3) Pestañas "Dashboard Semanal" y "Dashboard Mensual": se calculan solas a partir de',
  '   "Plan" y "Registro". Verde = cumplido, rojo = atrasado.',
  '4) En "Dashboard Mensual", la columna "Meta Ads gestionado este mes" es manual: márcala',
  '   Sí/No/Pendiente tú mismo cada mes para el cliente que tenga gestión de Ads incluida.',
  '',
  'Código de colores:',
  '- Celdas amarillas = las únicas que debes editar a mano.',
  '- Todo lo demás son fórmulas: no las borres ni las sobreescribas.',
  '',
  'Para agregar un cliente nuevo: escríbelo en la primera fila vacía de "Plan" (columna A).',
  'Los dashboards ya tienen las fórmulas listas en esa misma fila — no hay que copiar nada.',
  '',
  'Si necesitas más de 20 clientes, pide que te extienda la planilla.',
];
infoLines.forEach((line, i) => {
  const cell = wsInfo.getCell(`A${i + 2}`);
  cell.value = line;
  cell.font = line.startsWith('Cómo') || line.startsWith('Código') || line.startsWith('Qué es esto:') ? FONT_BOLD : FONT;
  cell.alignment = { wrapText: true, vertical: 'top' };
});

/* ---------------- Plan ---------------- */
const wsPlan = wb.addWorksheet('Plan');
setColWidths(wsPlan, [22, 13, 13, 14, 13, 13, 14, 14, 30]);
wsPlan.getCell('A1').value = 'Plan pactado por cliente';
wsPlan.getCell('A1').font = FONT_TITLE;
wsPlan.getCell('A3').value = 'Deja en blanco lo que no aplique. Puedes pactar por semana, por mes, o ambos.';
wsPlan.getCell('A3').font = FONT;

const planHeaders = ['Cliente', 'Posts /\nsemana', 'Reels /\nsemana', 'Historias /\nsemana', 'Posts /\nmes', 'Reels /\nmes', 'Historias /\nmes', 'Gestión\nMeta Ads', 'Notas'];
planHeaders.forEach((h, i) => { wsPlan.getRow(4).getCell(i + 1).value = h; });
styleHeaderRow(wsPlan, 4, planHeaders.length);

const exampleClients = [
  ['YEET', null, null, null, 8, 8, 12, 'Sí', 'Plan Crecimiento'],
  ['Kurakavi FC', null, null, null, 8, 8, 12, 'Sí', 'Plan Crecimiento'],
  ['Remate Rivera', null, null, null, 8, 8, 12, 'Sí', 'Plan Crecimiento'],
  ['Luis Núñez', null, null, null, 4, 4, 8, 'Sí', 'Plan Presencia'],
  ['World King', null, null, null, 4, 4, 8, 'Sí', 'Plan Presencia'],
];
for (let i = 0; i < N_ROWS; i++) {
  const r = PLAN_FIRST_ROW + i;
  const ex = exampleClients[i];
  for (let c = 1; c <= 9; c++) {
    const cell = wsPlan.getRow(r).getCell(c);
    cell.font = FONT;
    cell.fill = YELLOW;
    cell.alignment = { vertical: 'middle', horizontal: c === 1 || c === 9 ? 'left' : 'center' };
    if (c >= 2 && c <= 7) cell.numFmt = '0';
  }
  if (ex) ex.forEach((v, idx) => { wsPlan.getRow(r).getCell(idx + 1).value = v; });
  wsPlan.getRow(r).getCell(8).dataValidation = {
    type: 'list', allowBlank: true, showErrorMessage: true, formulae: ['"Sí,No"'],
  };
}
wsPlan.views = [{ state: 'frozen', ySplit: 4 }];

/* ---------------- Registro ---------------- */
const wsReg = wb.addWorksheet('Registro');
setColWidths(wsReg, [14, 22, 14, 40]);
wsReg.getCell('A1').value = 'Registro de publicaciones';
wsReg.getCell('A1').font = FONT_TITLE;
wsReg.getCell('A3').value = 'Agrega una fila cada vez que publiques algo. Usa los menús desplegables en Cliente y Tipo.';
wsReg.getCell('A3').font = FONT;

const regHeaders = ['Fecha', 'Cliente', 'Tipo', 'Descripción / Link'];
regHeaders.forEach((h, i) => { wsReg.getRow(4).getCell(i + 1).value = h; });
styleHeaderRow(wsReg, 4, regHeaders.length);

const REG_LAST_ROW = 1000;
for (let r = 5; r <= REG_LAST_ROW; r++) {
  const row = wsReg.getRow(r);
  const dateCell = row.getCell(1);
  dateCell.numFmt = 'dd/mm/yyyy';
  dateCell.font = FONT;
  row.getCell(2).font = FONT;
  row.getCell(3).font = FONT;
  row.getCell(4).font = FONT;
  row.getCell(2).dataValidation = {
    type: 'list', allowBlank: true, showErrorMessage: true,
    formulae: [`Plan!$A$${PLAN_FIRST_ROW}:$A$${PLAN_LAST_ROW}`],
  };
  row.getCell(3).dataValidation = {
    type: 'list', allowBlank: true, showErrorMessage: true,
    formulae: ['"Post,Reel,Historia"'],
  };
}
wsReg.views = [{ state: 'frozen', ySplit: 4 }];

/* ---------------- Dashboards ---------------- */
function buildDashboard(name, {
  rangeStartFormula, rangeEndFormula, rangeLabelFormula,
  planPostsCol, planReelsCol, planHistCol, adsColumn,
}) {
  const ws = wb.addWorksheet(name);
  setColWidths(ws, [22, 12, 12, 10, 12, 12, 10, 13, 13, 10, 18]);
  ws.getCell('A1').value = name;
  ws.getCell('A1').font = FONT_TITLE;

  ws.getCell('A2').value = 'Periodo:';
  ws.getCell('A2').font = FONT_BOLD;
  ws.getCell('B2').value = { formula: rangeLabelFormula };
  ws.getCell('B2').font = FONT_BOLD;
  ws.mergeCells('B2:D2');

  // helper cells (uso interno de las fórmulas) con los límites del período, lejos de las columnas de datos
  ws.getCell('M2').value = 'Inicio período (uso interno):';
  ws.getCell('M2').font = FONT;
  ws.getCell('N2').value = { formula: rangeStartFormula };
  ws.getCell('N2').numFmt = 'dd/mm/yyyy';
  ws.getCell('N2').font = FONT;
  ws.getCell('O2').value = 'Fin:';
  ws.getCell('O2').font = FONT;
  ws.getCell('P2').value = { formula: rangeEndFormula };
  ws.getCell('P2').numFmt = 'dd/mm/yyyy';
  ws.getCell('P2').font = FONT;

  const headers = ['Cliente', 'Posts\npactados', 'Posts\npublicados', '%\nPosts', 'Reels\npactados', 'Reels\npublicados', '%\nReels', 'Historias\npactadas', 'Historias\npublicadas', '%\nHistorias'];
  if (adsColumn) headers.push('Meta Ads\ngestionado\neste mes');
  headers.forEach((h, i) => { ws.getRow(4).getCell(i + 1).value = h; });
  styleHeaderRow(ws, 4, headers.length);

  for (let i = 0; i < N_ROWS; i++) {
    const r = PLAN_FIRST_ROW + i;
    const row = ws.getRow(r);

    row.getCell(1).value = { formula: `Plan!A${r}` };
    row.getCell(2).value = { formula: `Plan!${planPostsCol}${r}` };
    row.getCell(3).value = {
      formula: `COUNTIFS(Registro!$B$5:$B$${REG_LAST_ROW},$A${r},Registro!$C$5:$C$${REG_LAST_ROW},"Post",Registro!$A$5:$A$${REG_LAST_ROW},">="&$N$2,Registro!$A$5:$A$${REG_LAST_ROW},"<="&$P$2)`,
    };
    row.getCell(4).value = { formula: `IF(OR($B${r}="",$B${r}=0),"-",C${r}/$B${r})` };

    row.getCell(5).value = { formula: `Plan!${planReelsCol}${r}` };
    row.getCell(6).value = {
      formula: `COUNTIFS(Registro!$B$5:$B$${REG_LAST_ROW},$A${r},Registro!$C$5:$C$${REG_LAST_ROW},"Reel",Registro!$A$5:$A$${REG_LAST_ROW},">="&$N$2,Registro!$A$5:$A$${REG_LAST_ROW},"<="&$P$2)`,
    };
    row.getCell(7).value = { formula: `IF(OR($E${r}="",$E${r}=0),"-",F${r}/$E${r})` };

    row.getCell(8).value = { formula: `Plan!${planHistCol}${r}` };
    row.getCell(9).value = {
      formula: `COUNTIFS(Registro!$B$5:$B$${REG_LAST_ROW},$A${r},Registro!$C$5:$C$${REG_LAST_ROW},"Historia",Registro!$A$5:$A$${REG_LAST_ROW},">="&$N$2,Registro!$A$5:$A$${REG_LAST_ROW},"<="&$P$2)`,
    };
    row.getCell(10).value = { formula: `IF(OR($H${r}="",$H${r}=0),"-",I${r}/$H${r})` };

    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      cell.font = FONT;
      cell.alignment = { horizontal: c === 1 ? 'left' : 'center', vertical: 'middle' };
      if ([4, 7, 10].includes(c)) cell.numFmt = '0%';
    }

    if (adsColumn) {
      const adsCell = row.getCell(11);
      adsCell.font = FONT;
      adsCell.fill = YELLOW;
      adsCell.alignment = { horizontal: 'center', vertical: 'middle' };
      adsCell.dataValidation = {
        type: 'list', allowBlank: true, showErrorMessage: true, formulae: ['"Sí,No,Pendiente"'],
      };
    }
  }

  [4, 7, 10].forEach((col) => {
    const colLetter = ws.getColumn(col).letter;
    const ref = `${colLetter}${PLAN_FIRST_ROW}:${colLetter}${PLAN_LAST_ROW}`;
    ws.addConditionalFormatting({
      ref,
      rules: [
        { type: 'cellIs', operator: 'lessThan', formulae: [1], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF8D7DA' } }, font: { color: { argb: 'FF842029' } } } },
        { type: 'cellIs', operator: 'greaterThanOrEqual', formulae: [1], priority: 2, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFD4EDDA' } }, font: { color: { argb: 'FF0F5132' } } } },
      ],
    });
  });

  if (adsColumn) {
    const ref = `K${PLAN_FIRST_ROW}:K${PLAN_LAST_ROW}`;
    ws.addConditionalFormatting({
      ref,
      rules: [
        { type: 'cellIs', operator: 'equal', formulae: ['"Sí"'], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFD4EDDA' } }, font: { color: { argb: 'FF0F5132' } } } },
        { type: 'cellIs', operator: 'equal', formulae: ['"No"'], priority: 2, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF8D7DA' } }, font: { color: { argb: 'FF842029' } } } },
        { type: 'cellIs', operator: 'equal', formulae: ['"Pendiente"'], priority: 3, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFF2CC' } }, font: { color: { argb: 'FF7A5C00' } } } },
      ],
    });
  }

  ws.views = [{ state: 'frozen', ySplit: 4 }];
  return ws;
}

buildDashboard('Dashboard Semanal', {
  rangeStartFormula: 'TODAY()-WEEKDAY(TODAY(),3)',
  rangeEndFormula: 'TODAY()-WEEKDAY(TODAY(),3)+6',
  rangeLabelFormula: '"Semana del "&TEXT(TODAY()-WEEKDAY(TODAY(),3),"dd/mm")&" al "&TEXT(TODAY()-WEEKDAY(TODAY(),3)+6,"dd/mm/yyyy")',
  planPostsCol: 'B', planReelsCol: 'C', planHistCol: 'D',
});

buildDashboard('Dashboard Mensual', {
  rangeStartFormula: 'EOMONTH(TODAY(),-1)+1',
  rangeEndFormula: 'EOMONTH(TODAY(),0)',
  rangeLabelFormula: '"Mes de "&TEXT(TODAY(),"mmmm yyyy")',
  planPostsCol: 'E', planReelsCol: 'F', planHistCol: 'G',
  adsColumn: true,
});

wb.xlsx.writeFile('tracker-contenido-influence.xlsx').then(() => {
  console.log('OK: tracker-contenido-influence.xlsx generado');
}).catch((err) => {
  console.error('ERROR', err);
  process.exit(1);
});
