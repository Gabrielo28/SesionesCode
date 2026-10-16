/*
 * Despliega el Escáner de Negocio en Railway, de punta a punta.
 *
 *   RAILWAY_API_TOKEN=xxxx node desplegar-railway.js
 *
 * Usa un token de cuenta o de workspace (Railway → Account Settings → Tokens).
 * Es idempotente: si el proyecto o el servicio ya existen, los reutiliza.
 *
 * Qué hace:
 *   1. Crea (o encuentra) el proyecto "escaner-de-negocio".
 *   2. Crea el servicio "escaner", le fija Root Directory = /detector-dolores y el
 *      comando de arranque, y recién ahí lo conecta al repo Gabrielo28/SesionesCode,
 *      rama main (así el primer build ya usa la carpeta correcta).
 *   3. Crea el disco persistente (volumen en /data) donde el Centro de escaneo guarda tus
 *      negocios y el seguimiento, y las variables DATA_DIR=/data y CENTRO_CLAVE (la
 *      contraseña del Centro). Si no defines CENTRO_CLAVE al correr el script, se genera una
 *      al azar la primera vez: la ves en Railway → servicio escaner → Variables.
 *   4. Genera el dominio público.
 *   5. Lanza el deploy, espera a que termine y prueba que / y /proceso respondan.
 *
 * Desde ese momento cada push a main redespliega solo.
 */
const API = 'https://backboard.railway.com/graphql/v2';
const TOKEN = process.env.RAILWAY_API_TOKEN || process.env.RAILWAY_TOKEN;
const PROYECTO = process.env.RAILWAY_PROJECT_NAME || 'escaner-de-negocio';
const SERVICIO = 'escaner';
const REPO = 'Gabrielo28/SesionesCode';
const RAMA = 'main';
const RAIZ = '/detector-dolores';

if (!TOKEN) { console.error('Falta RAILWAY_API_TOKEN (token de cuenta o workspace de Railway).'); process.exit(1); }

async function gql(query, variables) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, body: JSON.stringify({ query, variables }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.errors) throw new Error((j.errors || []).map(e => e.message).join('; ') || ('HTTP ' + r.status));
  return j.data;
}
const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const { me } = await gql('{ me { name email workspaces { id name } } }');
  console.log('Cuenta:', me.name || me.email);
  const workspaceId = process.env.RAILWAY_WORKSPACE_ID || (me.workspaces[0] && me.workspaces[0].id);

  // 1. Proyecto
  const { projects } = await gql('query($w: String) { projects(workspaceId: $w) { edges { node { id name environments { edges { node { id name } } } services { edges { node { id name } } } } } } }', { w: workspaceId });
  let proyecto = projects.edges.map(e => e.node).find(p => p.name === PROYECTO);
  if (!proyecto) {
    const { projectCreate } = await gql('mutation($i: ProjectCreateInput!) { projectCreate(input: $i) { id name environments { edges { node { id name } } } services { edges { node { id name } } } } }',
      { i: { name: PROYECTO, description: 'Escáner de Negocio y Radiografía de proceso · Influence Chile', workspaceId } });
    proyecto = projectCreate; console.log('Proyecto creado:', proyecto.name);
  } else console.log('Proyecto existente:', proyecto.name);
  const env = proyecto.environments.edges.map(e => e.node).find(e => e.name === 'production') || proyecto.environments.edges[0].node;

  // 2. Servicio
  let servicio = proyecto.services.edges.map(e => e.node).find(s => s.name === SERVICIO);
  if (!servicio) {
    const { serviceCreate } = await gql('mutation($i: ServiceCreateInput!) { serviceCreate(input: $i) { id name } }', { i: { projectId: proyecto.id, name: SERVICIO } });
    servicio = serviceCreate; console.log('Servicio creado:', servicio.name);
  } else console.log('Servicio existente:', servicio.name);
  await gql('mutation($s: String!, $e: String!, $i: ServiceInstanceUpdateInput!) { serviceInstanceUpdate(serviceId: $s, environmentId: $e, input: $i) }',
    { s: servicio.id, e: env.id, i: { rootDirectory: RAIZ, startCommand: 'node server.js', restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 5 } });
  console.log('Root Directory:', RAIZ);
  await gql('mutation($id: String!, $i: ServiceConnectInput!) { serviceConnect(id: $id, input: $i) { id } }', { id: servicio.id, i: { repo: REPO, branch: RAMA } });
  console.log('Conectado a', REPO, '·', RAMA);

  // 3. Disco persistente y variables del Centro de escaneo
  const { project } = await gql('query($p: String!) { project(id: $p) { volumes { edges { node { id name volumeInstances { edges { node { mountPath serviceId } } } } } } } }', { p: proyecto.id });
  const conDisco = project.volumes.edges.some(v => v.node.volumeInstances.edges.some(i => i.node.serviceId === servicio.id));
  if (!conDisco) {
    await gql('mutation($i: VolumeCreateInput!) { volumeCreate(input: $i) { id } }', { i: { projectId: proyecto.id, serviceId: servicio.id, environmentId: env.id, mountPath: '/data' } });
    console.log('Disco persistente creado en /data');
  } else console.log('Disco persistente existente');
  const { variables } = await gql('query($p: String!, $e: String!, $s: String) { variables(projectId: $p, environmentId: $e, serviceId: $s) }', { p: proyecto.id, e: env.id, s: servicio.id });
  const fijar = (name, value) => gql('mutation($i: VariableUpsertInput!) { variableUpsert(input: $i) }', { i: { projectId: proyecto.id, environmentId: env.id, serviceId: servicio.id, name, value } });
  if (variables.DATA_DIR !== '/data') await fijar('DATA_DIR', '/data');
  if (process.env.CENTRO_CLAVE) { await fijar('CENTRO_CLAVE', process.env.CENTRO_CLAVE); console.log('CENTRO_CLAVE: la que definiste'); }
  else if (!variables.CENTRO_CLAVE) { await fijar('CENTRO_CLAVE', require('crypto').randomBytes(12).toString('base64url')); console.log('CENTRO_CLAVE generada: búscala en Railway → escaner → Variables'); }
  else console.log('CENTRO_CLAVE ya estaba definida');

  // 4. Dominio
  const { domains } = await gql('query($p: String!, $e: String!, $s: String!) { domains(projectId: $p, environmentId: $e, serviceId: $s) { serviceDomains { domain } } }', { p: proyecto.id, e: env.id, s: servicio.id });
  let dominio = domains.serviceDomains[0] && domains.serviceDomains[0].domain;
  if (!dominio) {
    const { serviceDomainCreate } = await gql('mutation($i: ServiceDomainCreateInput!) { serviceDomainCreate(input: $i) { domain } }', { i: { serviceId: servicio.id, environmentId: env.id } });
    dominio = serviceDomainCreate.domain;
  }
  console.log('Dominio: https://' + dominio);

  // 5. Deploy y verificación
  await gql('mutation($s: String!, $e: String!) { serviceInstanceDeployV2(serviceId: $s, environmentId: $e) }', { s: servicio.id, e: env.id });
  console.log('Deploy lanzado. Esperando…');
  let estado = '';
  for (let i = 0; i < 60; i++) {
    await espera(10000);
    const { deployments } = await gql('query($i: DeploymentListInput!) { deployments(first: 1, input: $i) { edges { node { id status } } } }', { i: { projectId: proyecto.id, serviceId: servicio.id, environmentId: env.id } });
    const d = deployments.edges[0] && deployments.edges[0].node;
    if (d && d.status !== estado) { estado = d.status; console.log('  estado:', estado); }
    if (['SUCCESS', 'FAILED', 'CRASHED', 'REMOVED', 'SKIPPED'].includes(estado)) break;
  }
  if (estado !== 'SUCCESS') { console.error('El deploy terminó en', estado || 'tiempo agotado', '. Revisa los logs en Railway.'); process.exit(2); }
  for (const ruta of ['/', '/proceso', '/escaner/codigos.js', '/centro/entrar']) {
    const r = await fetch('https://' + dominio + ruta).catch(e => ({ status: 'error ' + e.message }));
    console.log('  ', r.status, 'https://' + dominio + ruta);
  }
  console.log('\nListo: https://' + dominio + '\nCentro de escaneo: https://' + dominio + '/centro');
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
