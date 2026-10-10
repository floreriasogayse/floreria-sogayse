/* Panel de Florería Sogayse.
   Dos modos:
   - Prueba: los cambios se guardan sólo en este navegador (para practicar o mostrar).
   - Conectado: los cambios se guardan en el repositorio de GitHub de la página
     y el sitio se actualiza solo en uno o dos minutos. */
(function () {
  'use strict';

  const CLAVE_PRUEBA = 'sogayse-prueba';
  const CLAVE_CONEXION = 'sogayse-conexion';
  const RUTA_CATALOGO = 'contenido/catalogo.json';
  const CARPETA_FOTOS = 'imagenes/productos';

  const $contenido = document.getElementById('contenido');
  const $editor = document.getElementById('editor');
  const $confirmar = document.getElementById('confirmar');
  const $aviso = document.getElementById('aviso');
  const $btnGuardar = document.getElementById('btn-guardar');
  const $estado = document.getElementById('estado-guardado');
  const $barra = document.getElementById('guardar-barra');
  const $chip = document.getElementById('chip-modo');

  let datos = null;
  let pestana = 'productos';
  let sucio = false;
  let conexion = leerConexion();
  let shaCatalogo = null;
  let guardando = false;

  const ICONO = {
    mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    arriba: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
    abajo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    izq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    der: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    tacho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    lapiz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg>',
    camara: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
  };

  // ---------- Utilidades ----------
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clonar = (o) => JSON.parse(JSON.stringify(o));
  const srcFoto = (f) => (/^(data:|blob:|https?:)/.test(f) ? f : '../' + f);
  function slug(t) {
    return String(t || 'producto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'producto';
  }
  function idUnico(base, usados) {
    let id = slug(base), n = 2;
    while (usados.has(id)) id = slug(base) + '-' + n++;
    return id;
  }
  function todosLosIds() {
    const s = new Set();
    datos.categorias.forEach((c) => { s.add(c.id); c.productos.forEach((p) => s.add(p.id)); });
    return s;
  }

  function aviso(texto, error) {
    $aviso.textContent = texto;
    $aviso.classList.toggle('error', !!error);
    $aviso.classList.add('visible');
    clearTimeout(aviso.t);
    aviso.t = setTimeout(() => $aviso.classList.remove('visible'), error ? 7000 : 4000);
  }

  function leerConexion() {
    try { const c = JSON.parse(localStorage.getItem(CLAVE_CONEXION) || 'null'); return c && c.repo && c.token ? c : null; } catch (e) { return null; }
  }

  function marcarSucio() {
    sucio = true;
    actualizarBarra();
  }
  function actualizarBarra() {
    $btnGuardar.disabled = !sucio || guardando;
    $barra.classList.toggle('pendiente', sucio);
    if (guardando) return;
    $estado.textContent = sucio ? 'Hay cambios sin guardar' : 'Todo guardado';
    $btnGuardar.textContent = conexion ? 'Guardar y publicar' : 'Guardar (prueba)';
  }
  window.addEventListener('beforeunload', (e) => { if (sucio) { e.preventDefault(); e.returnValue = ''; } });

  // Ventana de confirmación propia (los navegadores dentro de vistas previas bloquean confirm()).
  function confirmar(titulo, texto, si = 'Sí, borrar') {
    return new Promise((resolve) => {
      $confirmar.innerHTML = `<div class="confirmar-in"><h2>${esc(titulo)}</h2><p>${esc(texto)}</p>
        <div class="confirmar-botones"><button type="button" class="btn btn-borde" data-r="0">Cancelar</button>
        <button type="button" class="btn btn-principal" data-r="1">${esc(si)}</button></div></div>`;
      const fin = (r) => { $confirmar.close(); resolve(r); };
      $confirmar.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => fin(b.dataset.r === '1')));
      $confirmar.addEventListener('cancel', () => resolve(false), { once: true });
      $confirmar.showModal();
    });
  }

  // ---------- GitHub ----------
  function b64aTexto(b64) {
    const bin = atob(b64.replace(/\n/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }
  function textoAB64(txt) {
    const bytes = new TextEncoder().encode(txt);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  async function gh(ruta, opciones = {}) {
    const r = await fetch('https://api.github.com/repos/' + conexion.repo + ruta, {
      ...opciones,
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + conexion.token, ...(opciones.headers || {}) }
    });
    if (!r.ok) {
      const err = new Error('GitHub respondió ' + r.status);
      err.status = r.status;
      throw err;
    }
    return r.status === 204 ? null : r.json();
  }
  const rama = () => conexion.rama || 'main';
  async function leerDeGitHub() {
    const j = await gh('/contents/' + RUTA_CATALOGO + '?ref=' + encodeURIComponent(rama()));
    shaCatalogo = j.sha;
    return JSON.parse(b64aTexto(j.content));
  }
  async function subirArchivo(ruta, b64, mensaje, sha) {
    const cuerpo = { message: mensaje, content: b64, branch: rama() };
    if (sha) cuerpo.sha = sha;
    return gh('/contents/' + ruta, { method: 'PUT', body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' } });
  }

  function mensajeError(e) {
    if (e.status === 401) return 'La clave de acceso no es válida o venció. Revisá la pestaña Publicación.';
    if (e.status === 403) return 'La clave de acceso no tiene permiso para guardar. Revisá la pestaña Publicación.';
    if (e.status === 404) return 'No se encontró el repositorio o el archivo del catálogo. Revisá la pestaña Publicación.';
    if (e.status === 409) return 'Alguien guardó cambios al mismo tiempo. Recargá el panel e intentá de nuevo.';
    return 'No se pudo guardar. Revisá la conexión a internet e intentá de nuevo.';
  }

  // ---------- Carga ----------
  async function cargar() {
    if (conexion) {
      try {
        datos = await leerDeGitHub();
        return;
      } catch (e) {
        aviso(mensajeError(e) + ' Mientras tanto se muestra la versión publicada.', true);
      }
    } else {
      try {
        const p = JSON.parse(localStorage.getItem(CLAVE_PRUEBA) || 'null');
        if (p && p.tienda) { datos = p; return; }
      } catch (e) { /* sin datos de prueba */ }
    }
    const r = await fetch('../' + RUTA_CATALOGO, { cache: 'no-cache' });
    datos = await r.json();
  }

  function normalizar() {
    datos.tienda = datos.tienda || {};
    datos.tienda.horarios = datos.tienda.horarios || [];
    datos.categorias = datos.categorias || [];
    datos.categorias.forEach((c) => {
      c.productos = c.productos || [];
      c.productos.forEach((p) => { p.fotos = p.fotos || []; p.detalles = p.detalles || []; });
    });
  }

  // ---------- Guardar ----------
  async function guardar() {
    if (guardando) return;
    guardando = true;
    $btnGuardar.disabled = true;
    try {
      if (!conexion) {
        try {
          localStorage.setItem(CLAVE_PRUEBA, JSON.stringify(datos));
        } catch (e) {
          aviso('No entra todo en el modo prueba (demasiadas fotos). Borrá alguna foto o conectá la página para publicar.', true);
          return;
        }
        sucio = false;
        aviso('Guardado en modo prueba. Tocá "Ver la página" para ver cómo queda.');
        return;
      }

      // 1) Subir las fotos nuevas
      const pendientes = [];
      datos.categorias.forEach((c) => c.productos.forEach((p) => p.fotos.forEach((f, i) => { if (f.startsWith('data:')) pendientes.push({ p, i }); })));
      for (let n = 0; n < pendientes.length; n++) {
        const { p, i } = pendientes[n];
        $estado.textContent = `Subiendo foto ${n + 1} de ${pendientes.length}…`;
        const ruta = `${CARPETA_FOTOS}/${p.id}-${Date.now().toString(36)}${n}.jpg`;
        await subirArchivo(ruta, p.fotos[i].split(',')[1], 'Foto nueva: ' + p.titulo);
        p.fotos[i] = ruta;
      }

      // 2) Guardar el catálogo
      $estado.textContent = 'Guardando catálogo…';
      const r = await subirArchivo(RUTA_CATALOGO, textoAB64(JSON.stringify(datos, null, 2) + '\n'), 'Actualización del catálogo desde el panel', shaCatalogo);
      shaCatalogo = r.content.sha;
      sucio = false;
      render();
      aviso('¡Listo! Los cambios van a aparecer en la página en 1 o 2 minutos.');
    } catch (e) {
      aviso(mensajeError(e), true);
    } finally {
      guardando = false;
      actualizarBarra();
    }
  }
  $btnGuardar.addEventListener('click', guardar);

  // ---------- Fotos: achicar antes de guardar ----------
  function prepararFoto(archivo) {
    const lado = conexion ? 1600 : 1000;
    const calidad = conexion ? 0.82 : 0.72;
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * k);
        cv.height = Math.round(img.naturalHeight * k);
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolve(cv.toDataURL('image/jpeg', calidad));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('foto')); };
      img.src = url;
    });
  }

  // ---------- Pantallas ----------
  function render() {
    $chip.textContent = conexion ? 'Conectado' : 'Modo prueba';
    $chip.classList.toggle('conectado', !!conexion);
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === pestana)));
    if (pestana === 'productos') renderProductos();
    else if (pestana === 'datos') renderDatos();
    else renderConexion();
    actualizarBarra();
  }
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { pestana = b.dataset.tab; render(); window.scrollTo(0, 0); }));

  function renderProductos() {
    const cats = datos.categorias;
    $contenido.innerHTML = `
      ${!conexion ? `<p class="ayuda alerta"><strong>Modo prueba.</strong> Podés cambiar todo lo que quieras: los cambios se guardan sólo en este aparato y no se publican. Para publicar de verdad, mirá la pestaña Publicación.</p>` : ''}
      <p class="ayuda">Tocá <strong>Editar</strong> para cambiar el nombre, el precio, los detalles o las fotos de un producto. Cuando termines, tocá <strong>${conexion ? 'Guardar y publicar' : 'Guardar'}</strong> abajo.</p>
      ${cats.map((c, ci) => `
        <section class="seccion">
          <div class="seccion-cabeza">
            <h2>${esc(c.titulo)}</h2>
            <span class="cuenta">${c.productos.length} ${c.productos.length === 1 ? 'producto' : 'productos'}</span>
            <div class="seccion-botones">
              <button type="button" class="btn btn-borde" data-acc="editar-seccion" data-c="${ci}">${ICONO.lapiz}Cambiar nombre</button>
              <button type="button" class="btn btn-borde btn-icono" data-acc="subir-seccion" data-c="${ci}" aria-label="Subir sección" ${ci === 0 ? 'disabled' : ''}>${ICONO.arriba}</button>
              <button type="button" class="btn btn-borde btn-icono" data-acc="bajar-seccion" data-c="${ci}" aria-label="Bajar sección" ${ci === cats.length - 1 ? 'disabled' : ''}>${ICONO.abajo}</button>
              <button type="button" class="btn btn-peligro btn-icono" data-acc="borrar-seccion" data-c="${ci}" aria-label="Borrar sección">${ICONO.tacho}</button>
            </div>
          </div>
          ${c.productos.map((p, pi) => `
            <div class="producto">
              <div class="producto-foto">${p.fotos[0] ? `<img src="${esc(srcFoto(p.fotos[0]))}" alt="">` : 'Sin foto'}</div>
              <div class="producto-texto">
                <strong>${esc(p.titulo)}</strong>
                <span class="precio">${esc(p.precio || 'Precio a consultar')}</span>
                <span> · ${p.fotos.length} ${p.fotos.length === 1 ? 'foto' : 'fotos'}</span>
              </div>
              <div class="producto-botones">
                <button type="button" class="btn btn-verde" data-acc="editar" data-c="${ci}" data-p="${pi}">${ICONO.lapiz}Editar</button>
                <button type="button" class="btn btn-borde btn-icono" data-acc="subir" data-c="${ci}" data-p="${pi}" aria-label="Mover antes" ${pi === 0 ? 'disabled' : ''}>${ICONO.arriba}</button>
                <button type="button" class="btn btn-borde btn-icono" data-acc="bajar" data-c="${ci}" data-p="${pi}" aria-label="Mover después" ${pi === c.productos.length - 1 ? 'disabled' : ''}>${ICONO.abajo}</button>
                <button type="button" class="btn btn-peligro btn-icono" data-acc="borrar" data-c="${ci}" data-p="${pi}" aria-label="Borrar ${esc(p.titulo)}">${ICONO.tacho}</button>
              </div>
            </div>`).join('')}
          <div class="seccion-pie"><button type="button" class="agregar" data-acc="nuevo" data-c="${ci}">${ICONO.mas}Agregar producto a ${esc(c.titulo)}</button></div>
        </section>`).join('')}
      <button type="button" class="agregar" data-acc="nueva-seccion">${ICONO.mas}Agregar una sección nueva (por ejemplo: "Eventos" o "Día de la Madre")</button>`;
  }

  $contenido.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acc]');
    if (!b) return;
    const ci = Number(b.dataset.c), pi = Number(b.dataset.p);
    const cats = datos.categorias;
    const mover = (lista, i, d) => { const [x] = lista.splice(i, 1); lista.splice(i + d, 0, x); marcarSucio(); render(); };
    switch (b.dataset.acc) {
      case 'editar': abrirEditor(ci, pi); break;
      case 'nuevo': abrirEditor(ci, -1); break;
      case 'subir': mover(cats[ci].productos, pi, -1); break;
      case 'bajar': mover(cats[ci].productos, pi, 1); break;
      case 'subir-seccion': mover(cats, ci, -1); break;
      case 'bajar-seccion': mover(cats, ci, 1); break;
      case 'borrar':
        if (await confirmar('¿Borrar "' + cats[ci].productos[pi].titulo + '"?', 'El producto deja de aparecer en la página cuando guardes.')) {
          cats[ci].productos.splice(pi, 1); marcarSucio(); render();
        }
        break;
      case 'borrar-seccion': {
        const c = cats[ci];
        const txt = c.productos.length ? `También se borran sus ${c.productos.length} productos.` : 'La sección está vacía.';
        if (await confirmar('¿Borrar la sección "' + c.titulo + '"?', txt)) { cats.splice(ci, 1); marcarSucio(); render(); }
        break;
      }
      case 'editar-seccion': abrirEditorSeccion(ci); break;
      case 'nueva-seccion': abrirEditorSeccion(-1); break;
      case 'quitar-horario': datos.tienda.horarios.splice(Number(b.dataset.h), 1); marcarSucio(); render(); break;
      case 'agregar-horario': datos.tienda.horarios.push({ dias: '', horas: '' }); marcarSucio(); render(); break;
      case 'desconectar':
        if (await confirmar('¿Desconectar este aparato?', 'Vas a volver al modo prueba. La página publicada no cambia.', 'Desconectar')) {
          try { localStorage.removeItem(CLAVE_CONEXION); } catch (er) { /* nada */ }
          conexion = null; shaCatalogo = null; sucio = false;
          await cargar(); normalizar(); render();
        }
        break;
      case 'borrar-prueba':
        if (await confirmar('¿Descartar los cambios de prueba?', 'Se vuelve a la versión publicada del catálogo.', 'Descartar')) {
          try { localStorage.removeItem(CLAVE_PRUEBA); } catch (er) { /* nada */ }
          sucio = false; await cargar(); normalizar(); render(); aviso('Listo, se descartaron los cambios de prueba.');
        }
        break;
    }
  });

  // ---------- Editor de sección ----------
  function abrirEditorSeccion(ci) {
    const nueva = ci < 0;
    const c = nueva ? { titulo: '', descripcion: '' } : datos.categorias[ci];
    $editor.innerHTML = `
      <form class="editor-in" method="dialog">
        <div class="editor-cabeza"><h2 id="editor-titulo">${nueva ? 'Sección nueva' : 'Editar sección'}</h2></div>
        <div class="editor-cuerpo">
          <div class="campo"><label for="s-titulo">Nombre de la sección</label><input type="text" id="s-titulo" value="${esc(c.titulo)}" placeholder="Por ejemplo: Ramos" required></div>
          <div class="campo"><label for="s-desc">Frase debajo del nombre (opcional)</label><input type="text" id="s-desc" value="${esc(c.descripcion || '')}" placeholder="Por ejemplo: Para regalar en cualquier ocasión"></div>
        </div>
        <div class="editor-pie"><button type="button" class="btn btn-borde" data-cancelar>Cancelar</button><button type="submit" class="btn btn-principal">Listo</button></div>
      </form>`;
    $editor.querySelector('[data-cancelar]').addEventListener('click', () => $editor.close());
    $editor.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const titulo = $editor.querySelector('#s-titulo').value.trim();
      if (!titulo) { aviso('Poné un nombre para la sección.', true); return; }
      const desc = $editor.querySelector('#s-desc').value.trim();
      if (nueva) datos.categorias.push({ id: idUnico(titulo, todosLosIds()), titulo, descripcion: desc, productos: [] });
      else { c.titulo = titulo; c.descripcion = desc; }
      $editor.close(); marcarSucio(); render();
    });
    $editor.showModal();
  }

  // ---------- Editor de producto ----------
  function abrirEditor(ci, pi) {
    const nuevo = pi < 0;
    const original = nuevo ? null : datos.categorias[ci].productos[pi];
    const p = nuevo ? { id: '', titulo: '', precio: '', descripcion: '', detalles: [], fotos: [], destacado: false } : clonar(original);
    let seccion = ci;

    function pintarFotos() {
      const cont = $editor.querySelector('#fotos');
      cont.innerHTML = p.fotos.map((f, i) => `
        <div class="foto">
          <img src="${esc(srcFoto(f))}" alt="Foto ${i + 1}">
          ${i === 0 ? '<span class="principal">Principal</span>' : ''}
          <div class="foto-botones">
            <button type="button" data-f="izq" data-i="${i}" aria-label="Mover a la izquierda" ${i === 0 ? 'disabled' : ''}>${ICONO.izq}</button>
            <button type="button" data-f="borrar" data-i="${i}" aria-label="Quitar foto">${ICONO.tacho}</button>
            <button type="button" data-f="der" data-i="${i}" aria-label="Mover a la derecha" ${i === p.fotos.length - 1 ? 'disabled' : ''}>${ICONO.der}</button>
          </div>
        </div>`).join('') + `
        <label class="subir" id="zona-subir">${ICONO.camara}<span>Agregar fotos</span><input type="file" id="f-archivo" accept="image/*" multiple></label>`;
      cont.querySelector('#f-archivo').addEventListener('change', (e) => agregarFotos(e.target.files));
      const zona = cont.querySelector('#zona-subir');
      zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('arrastrando'); });
      zona.addEventListener('dragleave', () => zona.classList.remove('arrastrando'));
      zona.addEventListener('drop', (e) => { e.preventDefault(); zona.classList.remove('arrastrando'); agregarFotos(e.dataTransfer.files); });
    }

    async function agregarFotos(archivos) {
      const lista = [...archivos].filter((a) => a.type.startsWith('image/'));
      if (!lista.length) return;
      aviso(lista.length === 1 ? 'Preparando la foto…' : `Preparando ${lista.length} fotos…`);
      for (const a of lista) {
        try { p.fotos.push(await prepararFoto(a)); } catch (e) { aviso('No se pudo abrir una de las fotos. Probá con otra.', true); }
      }
      pintarFotos();
    }

    $editor.innerHTML = `
      <form class="editor-in" method="dialog">
        <div class="editor-cabeza"><h2 id="editor-titulo">${nuevo ? 'Producto nuevo' : 'Editar producto'}</h2></div>
        <div class="editor-cuerpo">
          <div class="campo">
            <span class="rotulo">Fotos</span>
            <span class="pista">La primera es la que se ve en la tarjeta. Usá las flechas para cambiar el orden.</span>
            <div class="fotos" id="fotos"></div>
          </div>
          <div class="campo"><label for="p-titulo">Nombre del producto</label><input type="text" id="p-titulo" value="${esc(p.titulo)}" placeholder="Por ejemplo: Ramo de rosas rojas" required></div>
          <div class="dos-columnas">
            <div class="campo"><label for="p-precio">Precio</label><input type="text" id="p-precio" value="${esc(p.precio)}" placeholder="Por ejemplo: $ 25.000"><span class="pista">Si lo dejás vacío, la página muestra "Precio a consultar".</span></div>
            <div class="campo"><label for="p-seccion">Sección</label><select id="p-seccion">${datos.categorias.map((c, i) => `<option value="${i}" ${i === ci ? 'selected' : ''}>${esc(c.titulo)}</option>`).join('')}</select></div>
          </div>
          <div class="campo"><label for="p-desc">Descripción corta</label><textarea id="p-desc" rows="3" placeholder="Una o dos frases sobre el producto">${esc(p.descripcion)}</textarea></div>
          <div class="campo"><label for="p-detalles">Detalles</label><span class="pista">Uno por renglón. Se muestran como lista.</span><textarea id="p-detalles" rows="4" placeholder="12 rosas&#10;Papel a elección&#10;Tarjeta con dedicatoria">${esc(p.detalles.join('\n'))}</textarea></div>
          <label class="check"><input type="checkbox" id="p-destacado" ${p.destacado ? 'checked' : ''}>Marcar como "Más pedido" y mostrar arriba en la portada</label>
        </div>
        <div class="editor-pie"><button type="button" class="btn btn-borde" data-cancelar>Cancelar</button><button type="submit" class="btn btn-principal">Listo</button></div>
      </form>`;
    pintarFotos();

    $editor.querySelector('#fotos').addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      const i = Number(b.dataset.i);
      if (b.dataset.f === 'borrar') p.fotos.splice(i, 1);
      else { const d = b.dataset.f === 'izq' ? -1 : 1; const [f] = p.fotos.splice(i, 1); p.fotos.splice(i + d, 0, f); }
      pintarFotos();
    });
    $editor.querySelector('[data-cancelar]').addEventListener('click', () => $editor.close());
    $editor.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      p.titulo = $editor.querySelector('#p-titulo').value.trim();
      if (!p.titulo) { aviso('Poné un nombre para el producto.', true); return; }
      p.precio = $editor.querySelector('#p-precio').value.trim();
      p.descripcion = $editor.querySelector('#p-desc').value.trim();
      p.detalles = $editor.querySelector('#p-detalles').value.split('\n').map((x) => x.trim()).filter(Boolean);
      p.destacado = $editor.querySelector('#p-destacado').checked;
      seccion = Number($editor.querySelector('#p-seccion').value);
      if (nuevo) {
        p.id = idUnico(p.titulo, todosLosIds());
        datos.categorias[seccion].productos.push(p);
      } else if (seccion !== ci) {
        datos.categorias[ci].productos.splice(pi, 1);
        datos.categorias[seccion].productos.push(p);
      } else {
        datos.categorias[ci].productos[pi] = p;
      }
      $editor.close(); marcarSucio(); render();
      aviso(nuevo ? 'Producto agregado. Acordate de guardar.' : 'Cambios listos. Acordate de guardar.');
    });
    $editor.showModal();
  }

  // ---------- Datos de la florería ----------
  function renderDatos() {
    const t = datos.tienda;
    const ejemploProd = (datos.categorias[0] && datos.categorias[0].productos[0] && datos.categorias[0].productos[0].titulo) || 'Ramo de rosas';
    $contenido.innerHTML = `
      <section class="tarjeta-form">
        <h2>Contacto</h2>
        <div class="campo">
          <label for="d-whatsapp">Número de WhatsApp</label>
          <input type="tel" id="d-whatsapp" data-campo="whatsapp" value="${esc(t.whatsapp)}" placeholder="Por ejemplo: 5493434123456" inputmode="numeric">
          <span class="pista">Escribilo todo junto, sin espacios ni signos: <strong>54</strong> (Argentina) + <strong>9</strong> + código de área sin el 0 + número sin el 15. Ejemplo para Crespo: 54 9 343 4123456 → <code>5493434123456</code>.</span>
          ${!t.whatsapp ? '<span class="pista" style="color:var(--peonia-osc)">Falta cargar el número. Mientras tanto, el botón abre WhatsApp y deja elegir a quién mandar el mensaje.</span>' : ''}
        </div>
        <div class="campo">
          <label for="d-instagram">Usuario de Instagram</label>
          <input type="text" id="d-instagram" data-campo="instagram" value="${esc(t.instagram)}" placeholder="Por ejemplo: floreriasogayse" autocapitalize="off" spellcheck="false">
          <span class="pista">Sólo el nombre de usuario, sin la @.</span>
        </div>
        <div class="campo">
          <label for="d-msg-prod">Mensaje que se envía al consultar un producto</label>
          <textarea id="d-msg-prod" data-campo="mensaje_producto" rows="3">${esc(t.mensaje_producto)}</textarea>
          <span class="pista">Donde dice <code>{producto}</code> se pone solo el nombre del producto. Así se ve:</span>
          <div class="ejemplo-mensaje" id="ej-prod"></div>
        </div>
        <div class="campo">
          <label for="d-msg-gral">Mensaje del botón general de WhatsApp</label>
          <textarea id="d-msg-gral" data-campo="mensaje_general" rows="3">${esc(t.mensaje_general)}</textarea>
        </div>
      </section>

      <section class="tarjeta-form">
        <h2>Portada</h2>
        <div class="campo"><label for="d-nombre">Nombre de la florería</label><input type="text" id="d-nombre" data-campo="nombre" value="${esc(t.nombre)}"></div>
        <div class="campo"><label for="d-eslogan">Título grande de la portada</label><input type="text" id="d-eslogan" data-campo="eslogan" value="${esc(t.eslogan)}"></div>
        <div class="campo"><label for="d-presentacion">Texto de presentación</label><textarea id="d-presentacion" data-campo="presentacion" rows="3">${esc(t.presentacion)}</textarea></div>
      </section>

      <section class="tarjeta-form">
        <h2>Dirección y horarios</h2>
        <div class="campo"><label for="d-direccion">Dirección</label><input type="text" id="d-direccion" data-campo="direccion" value="${esc(t.direccion)}"></div>
        <div class="campo">
          <span class="rotulo">Horarios</span>
          ${t.horarios.map((h, i) => `
            <div class="fila-horario">
              <input type="text" id="h-dias-${i}" data-horario="${i}" data-parte="dias" value="${esc(h.dias)}" placeholder="Días (ej: Sábados)" aria-label="Días">
              <input type="text" id="h-horas-${i}" data-horario="${i}" data-parte="horas" value="${esc(h.horas)}" placeholder="Horario (ej: 8:00 a 12:30)" aria-label="Horario">
              <button type="button" class="btn btn-peligro btn-icono" data-acc="quitar-horario" data-h="${i}" aria-label="Quitar renglón">${ICONO.tacho}</button>
            </div>`).join('')}
          <button type="button" class="agregar" data-acc="agregar-horario">${ICONO.mas}Agregar renglón de horario</button>
        </div>
      </section>`;

    const pintarEjemplo = () => {
      $contenido.querySelector('#ej-prod').textContent = (t.mensaje_producto || '').replace(/\{producto\}/g, ejemploProd);
    };
    pintarEjemplo();
    $contenido.querySelectorAll('[data-campo]').forEach((el) => el.addEventListener('input', () => {
      let v = el.value;
      if (el.dataset.campo === 'whatsapp') v = v.replace(/\D/g, '');
      if (el.dataset.campo === 'instagram') v = v.trim().replace(/^@/, '');
      t[el.dataset.campo] = v;
      marcarSucio();
      if (el.dataset.campo === 'mensaje_producto') pintarEjemplo();
    }));
    $contenido.querySelectorAll('[data-horario]').forEach((el) => el.addEventListener('input', () => {
      t.horarios[Number(el.dataset.horario)][el.dataset.parte] = el.value;
      marcarSucio();
    }));
  }

  // ---------- Publicación (conexión con GitHub) ----------
  function renderConexion() {
    $contenido.innerHTML = conexion ? `
      <section class="tarjeta-form">
        <h2>Este aparato está conectado</h2>
        <p class="ayuda">Cuando tocás <strong>Guardar y publicar</strong>, los cambios se suben a la página y se ven en 1 o 2 minutos.<br>Repositorio: <code>${esc(conexion.repo)}</code> · rama <code>${esc(rama())}</code></p>
        <div><button type="button" class="btn btn-peligro" data-acc="desconectar">Desconectar este aparato</button></div>
      </section>` : `
      <section class="tarjeta-form">
        <h2>Publicar los cambios de verdad</h2>
        <p class="ayuda">Esto se hace <strong>una sola vez</strong> en cada computadora o celular desde el que se quiera administrar la página. Lo suele hacer quien armó la página. Después, el dueño sólo edita y toca <strong>Guardar y publicar</strong>.</p>
        <ol class="pasos">
          <li>La página tiene que estar subida a un repositorio de GitHub (los pasos están en el archivo <code>LEEME.md</code>).</li>
          <li>En GitHub, crear una clave de acceso "fine-grained" sólo para ese repositorio, con permiso <strong>Contents: Read and write</strong>.</li>
          <li>Completar los datos de abajo y tocar <strong>Conectar</strong>.</li>
        </ol>
        <div class="dos-columnas">
          <div class="campo"><label for="c-repo">Repositorio</label><input type="text" id="c-repo" placeholder="usuario/floreria-sogayse" autocapitalize="off" spellcheck="false"></div>
          <div class="campo"><label for="c-rama">Rama</label><input type="text" id="c-rama" value="main" autocapitalize="off" spellcheck="false"></div>
        </div>
        <div class="campo"><label for="c-token">Clave de acceso</label><input type="password" id="c-token" placeholder="github_pat_…" autocomplete="off"><span class="pista">Queda guardada sólo en este aparato.</span></div>
        <div><button type="button" class="btn btn-verde" id="c-conectar">Conectar</button></div>
      </section>
      <section class="tarjeta-form">
        <h2>Modo prueba</h2>
        <p class="ayuda">Mientras no esté conectado, el panel funciona igual pero guarda todo sólo en este navegador. Sirve para practicar y para ver cómo quedaría la página.</p>
        <div><button type="button" class="btn btn-peligro" data-acc="borrar-prueba">Descartar los cambios de prueba</button></div>
      </section>`;

    const btn = document.getElementById('c-conectar');
    if (btn) btn.addEventListener('click', async () => {
      const repo = document.getElementById('c-repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
      const ramaTxt = document.getElementById('c-rama').value.trim() || 'main';
      const token = document.getElementById('c-token').value.trim();
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) { aviso('Completá el repositorio (usuario/nombre) y la clave de acceso.', true); return; }
      btn.disabled = true; btn.textContent = 'Probando…';
      const anterior = conexion;
      conexion = { repo, rama: ramaTxt, token };
      try {
        const nuevos = await leerDeGitHub();
        try { localStorage.setItem(CLAVE_CONEXION, JSON.stringify(conexion)); localStorage.removeItem(CLAVE_PRUEBA); } catch (e) { /* nada */ }
        datos = nuevos; normalizar(); sucio = false; pestana = 'productos';
        render();
        aviso('¡Conectado! Desde ahora "Guardar y publicar" actualiza la página.');
      } catch (e) {
        conexion = anterior;
        aviso(mensajeError(e), true);
        btn.disabled = false; btn.textContent = 'Conectar';
      }
    });
  }

  // ---------- Inicio ----------
  (async function iniciar() {
    try {
      await cargar();
      normalizar();
      render();
    } catch (e) {
      $contenido.innerHTML = '<p class="vacio">No se pudo cargar el catálogo. Revisá la conexión y recargá la página.</p>';
    }
  })();
})();
