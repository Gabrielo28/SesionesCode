# Marketing Machine · Influence Chile

Un proyecto en Claude Code que **produce, sube, califica y escala** los anuncios de
Influence Chile en Meta todos los días. Tú entiendes el porqué y decides la plata;
Claude se encarga de lo técnico.

Basado en el método de *Meta Ads con Claude* (Benjamín Cordero): 80/20 económico, 3
campañas, videos modulares (Lego System), imágenes con Higgsfield, "todo es un anuncio",
un juez con regla de apagado y un piloto automático.

## Las piezas

| # | Archivo | Qué es |
|---|---|---|
| 0 | [00-economia.md](00-economia.md) | Cuánto puedes pagar por un cliente y por una conversación |
| 1 | [01-campanas.md](01-campanas.md) | Laboratorio, remarketing y escala |
| 2 | [02-lego-system.md](02-lego-system.md) + [lego/lego.js](lego/lego.js) | Una grabación → decenas de anuncios |
| 3 | [03-higgsfield.md](03-higgsfield.md) | Gráficos, stories y variaciones que se suben solas |
| 4 | [04-todo-es-un-anuncio.md](04-todo-es-un-anuncio.md) | Qué más entra al laboratorio + el copy y los títulos |
| 5 | [05-juez.md](05-juez.md) | CPA, CPM y la regla de apagado |
| 6 | [06-piloto-automatico.md](06-piloto-automatico.md) | La máquina corriendo sola, con o sin revisión humana |
| ⚙ | [maquina.json](maquina.json) | IDs, economía y reglas del juez: lo único que se edita para ajustar |
| 🧠 | [../.claude/skills/marketing-machine/SKILL.md](../.claude/skills/marketing-machine/SKILL.md) | El skill que opera todo |

## Estado (19-oct-2026)

- [x] Reporte inicial de la cuenta (local, en `reportes/`)
- [x] 3 campañas creadas **en pausa** en la cuenta `874019311966265` (presupuesto $5.000/día):
      Laboratorio (conjunto "Tanda S43", $4.000/día), Remarketing (público de la página
      365 días, $1.000/día) y Escala (vacía hasta el primer ganador)
- [ ] Primera tanda de anuncios en el Laboratorio (Lego + Higgsfield + el ganador histórico)
- [ ] Publicar las campañas (lo hace una persona)
- [ ] Piloto automático programado
- [ ] Conectar Instagram a la cuenta publicitaria e instalar el píxel en la web

## Uso diario

Abre Claude Code en este repo y habla normal:

- *"¿cómo está la cuenta?"* → reporte
- *"corre el juez"* → sentencias de cada anuncio
- *"genera la tanda S44 con Higgsfield"* / *"arma los cortes de esta grabación"*
- *"sube la tanda al laboratorio"* → anuncios en pausa para revisar
- *"gradúa el ganador a escala"*
