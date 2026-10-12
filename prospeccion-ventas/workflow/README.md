# Workflow de prospección — versión gráfica

Cuatro láminas A4 horizontales que resumen `../00-workflow-prospeccion.md`:

1. El flujo completo por carriles (entrantes, automático, asistente, Gabriel)
2. La semana día por día, con responsable y tiempo
3. Estados del pipeline
4. Reglas, el prospecto paso a paso y las frases que disparan cada tarea

Archivos: `workflow-prospeccion.pdf` (para imprimir o compartir), `workflow-p1..4.png` (para pegar en
una nota o en WhatsApp), `workflow-prospeccion.html` (fuente).

Para regenerar después de cambiar el texto en `build_workflow.py`:

```bash
python3 prospeccion-ventas/workflow/build_workflow.py
NODE_PATH=/opt/node22/lib/node_modules node prospeccion-ventas/workflow/render.js
```

(`render.js` usa el Chromium de Playwright; en Windows cambia `executablePath` a la ruta de Chrome.)
