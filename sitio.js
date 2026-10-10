/* Florería Sogaysé: arma el catálogo a partir de contenido/catalogo.json */
(function () {
  'use strict';

  const CLAVE_PRUEBA = 'sogayse-prueba';
  const app = document.getElementById('app');
  const dlgDetalle = document.getElementById('detalle');
  const dlgVisor = document.getElementById('visor');
  const aviso = document.getElementById('aviso');

  let datos = null;
  const productos = new Map();

  // ---------- Íconos ----------
  const ICONO = {
    wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.7 11.7 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none"/></svg>',
    izq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    der: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    cerrar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    fotos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>',
    ampliar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    lugar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'
  };

  // ---------- Utilidades ----------
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const soloNumeros = (t) => String(t || '').replace(/\D/g, '');
  const usuarioIG = (t) => String(t || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '');

  function linkWhatsApp(mensaje) {
    const num = soloNumeros(datos.tienda.whatsapp);
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(mensaje);
  }
  function mensajeProducto(p) {
    const plantilla = datos.tienda.mensaje_producto || 'Hola, vengo desde la página web y quería consultar por: {producto}';
    return plantilla.replace(/\{producto\}/g, p.titulo);
  }
  function linkInstagramPerfil() {
    const u = usuarioIG(datos.tienda.instagram);
    return u ? 'https://www.instagram.com/' + u + '/' : '#';
  }
  function linkInstagramChat() {
    const u = usuarioIG(datos.tienda.instagram);
    return u ? 'https://ig.me/m/' + u : '#';
  }

  function mostrarAviso(texto) {
    aviso.textContent = texto;
    aviso.classList.add('visible');
    clearTimeout(mostrarAviso.t);
    mostrarAviso.t = setTimeout(() => aviso.classList.remove('visible'), 4200);
  }

  function copiar(texto) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(texto).then(() => true, () => false);
      }
    } catch (e) { /* sin portapapeles */ }
    return Promise.resolve(false);
  }

  // Botón de Instagram: copia el mensaje y abre el chat de Instagram.
  function alTocarInstagram(ev, mensaje) {
    if (!usuarioIG(datos.tienda.instagram)) {
      ev.preventDefault();
      mostrarAviso('Todavía no se cargó el usuario de Instagram de la florería.');
      return;
    }
    copiar(mensaje).then((ok) => {
      mostrarAviso(ok ? 'Copiamos el mensaje. Pegalo en el chat de Instagram.' : 'Escribinos por Instagram: ' + mensaje);
    });
  }

  function precioHTML(p) {
    return p.precio && String(p.precio).trim()
      ? '<span class="precio">' + esc(p.precio) + '</span>'
      : '<span class="precio consultar">Precio a consultar</span>';
  }

  // ---------- Carga de datos ----------
  async function cargar() {
    let prueba = null;
    try { prueba = JSON.parse(localStorage.getItem(CLAVE_PRUEBA) || 'null'); } catch (e) { prueba = null; }
    if (prueba && prueba.tienda) return { d: prueba, prueba: true };
    const r = await fetch('contenido/catalogo.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('No se pudo leer el catálogo');
    return { d: await r.json(), prueba: false };
  }

  // ---------- Armado de la página ----------
  function render(esPrueba) {
    const t = datos.tienda;
    const cats = (datos.categorias || []).filter((c) => (c.productos || []).length);
    productos.clear();
    cats.forEach((c) => c.productos.forEach((p, i) => productos.set(c.id + '/' + (p.id || i), { p, c })));

    const todos = [...productos.values()].map((x) => x.p).filter((p) => (p.fotos || []).length);
    const destacados = todos.filter((p) => p.destacado).concat(todos.filter((p) => !p.destacado)).slice(0, 3);
    const claveDe = (p) => [...productos.entries()].find(([, v]) => v.p === p)[0];

    const primerHorario = (t.horarios || [])[0];

    app.innerHTML = `
      ${esPrueba ? `<div class="aviso-prueba"><span>Estás viendo los cambios de prueba del panel. Todavía no están publicados.</span><button type="button" id="quitar-prueba">Ver la versión publicada</button></div>` : ''}
      <header class="encabezado">
        <div class="contenedor">
          <a class="marca" href="#inicio" aria-label="${esc(t.nombre)}, inicio"><small>Florería</small><span>${esc((t.nombre || '').replace(/^flor(e|é)r(i|í)a\s+/i, ''))}</span></a>
          <nav class="menu" aria-label="Secciones">
            ${cats.map((c) => `<a href="#${esc(c.id)}">${esc(c.titulo)}</a>`).join('')}
            <a href="#contacto">Contacto</a>
          </nav>
        </div>
      </header>

      <main id="inicio">
        <section class="portada">
          <div class="contenedor">
            <div class="portada-texto">
              <p class="etiqueta">${esc(t.direccion ? 'Florería en ' + t.direccion.split(',').slice(1).join(',').trim() : 'Florería')}</p>
              <h1>${esc(t.eslogan || t.nombre)}</h1>
              <p class="bajada">${esc(t.presentacion || '')}</p>
              <div class="acciones">
                <a class="btn btn-wa" href="${linkWhatsApp(t.mensaje_general || '')}" target="_blank" rel="noopener">${ICONO.wa}Escribir por WhatsApp</a>
                <a class="btn btn-ig" href="${linkInstagramPerfil()}" target="_blank" rel="noopener" data-ig-perfil>${ICONO.ig}Ver Instagram</a>
              </div>
              ${primerHorario ? `<p class="horario-hoy"><span class="punto"></span>${esc(primerHorario.dias)}: ${esc(primerHorario.horas)}</p>` : ''}
            </div>
            <div class="portada-fotos">
              ${destacados.map((p, i) => `<button type="button" class="f${i + 1}" data-abrir="${esc(claveDe(p))}" aria-label="Ver ${esc(p.titulo)}"><img src="${esc(p.fotos[0])}" alt="${esc(p.titulo)}" loading="eager"></button>`).join('')}
            </div>
          </div>
        </section>

        ${cats.map((c) => `
        <section class="categoria" id="${esc(c.id)}" aria-labelledby="t-${esc(c.id)}">
          <div class="contenedor">
            <div class="categoria-cabeza">
              <div>
                <h2 id="t-${esc(c.id)}">${esc(c.titulo)}</h2>
                ${c.descripcion ? `<p>${esc(c.descripcion)}</p>` : ''}
              </div>
              <div class="flechas">
                <button type="button" class="flecha" data-mover="-1" aria-label="Anteriores">${ICONO.izq}</button>
                <button type="button" class="flecha" data-mover="1" aria-label="Siguientes">${ICONO.der}</button>
              </div>
            </div>
            <div class="carrusel" tabindex="0" aria-label="${esc(c.titulo)}">
              ${c.productos.map((p, i) => tarjetaHTML(c.id + '/' + (p.id || i), p)).join('')}
            </div>
          </div>
        </section>`).join('')}
      </main>

      <section class="contacto" id="contacto" aria-labelledby="t-contacto">
        <div class="contenedor">
          <div>
            <p class="etiqueta">Contacto</p>
            <h2 id="t-contacto">¿Querés encargar algo especial?</h2>
            <p>Contanos para qué ocasión es y te armamos una propuesta. Respondemos por WhatsApp e Instagram.</p>
            <div class="acciones">
              <a class="btn btn-wa" href="${linkWhatsApp(t.mensaje_general || '')}" target="_blank" rel="noopener">${ICONO.wa}Escribir por WhatsApp</a>
              <a class="btn btn-ig" href="${linkInstagramPerfil()}" target="_blank" rel="noopener" data-ig-perfil>${ICONO.ig}${usuarioIG(t.instagram) ? '@' + esc(usuarioIG(t.instagram)) : 'Instagram'}</a>
            </div>
          </div>
          <div>
            ${(t.horarios || []).length ? `
            <table class="tabla-horarios">
              <caption class="etiqueta" style="text-align:left">Horarios</caption>
              <tbody>${t.horarios.map((h) => `<tr><th scope="row">${esc(h.dias)}</th><td>${esc(h.horas)}</td></tr>`).join('')}</tbody>
            </table>` : ''}
            ${t.direccion ? `<p class="direccion">${ICONO.lugar}<span>${esc(t.direccion)}<br><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.direccion)}" target="_blank" rel="noopener">Cómo llegar</a></span></p>` : ''}
          </div>
        </div>
      </section>

      <footer class="pie">
        <div class="contenedor">
          <span>© ${new Date().getFullYear()} ${esc(t.nombre)}</span>
        </div>
      </footer>

      <a class="wa-flotante" href="${linkWhatsApp(t.mensaje_general || '')}" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp">${ICONO.wa}</a>
    `;

    const quitar = document.getElementById('quitar-prueba');
    if (quitar) quitar.addEventListener('click', () => {
      try { localStorage.removeItem(CLAVE_PRUEBA); } catch (e) { /* nada */ }
      iniciar();
    });

    app.querySelectorAll('[data-ig-perfil]').forEach((a) => a.addEventListener('click', (ev) => {
      if (!usuarioIG(datos.tienda.instagram)) { ev.preventDefault(); mostrarAviso('Todavía no se cargó el usuario de Instagram de la florería.'); }
    }));
    app.querySelectorAll('[data-abrir]').forEach((b) => b.addEventListener('click', () => abrirDetalle(b.dataset.abrir)));
    app.querySelectorAll('[data-ig-producto]').forEach((a) => a.addEventListener('click', (ev) => {
      const x = productos.get(a.dataset.igProducto);
      alTocarInstagram(ev, mensajeProducto(x.p));
    }));
    app.querySelectorAll('.categoria').forEach(prepararCarrusel);
  }

  function tarjetaHTML(clave, p) {
    const fotos = p.fotos || [];
    return `
      <article class="tarjeta">
        <button type="button" class="tarjeta-foto" data-abrir="${esc(clave)}" aria-label="Ver fotos y detalles de ${esc(p.titulo)}">
          ${fotos[0] ? `<img src="${esc(fotos[0])}" alt="${esc(p.titulo)}" loading="lazy">` : ''}
          ${fotos.length > 1 ? `<span class="insignia">${ICONO.fotos}${fotos.length} fotos</span>` : ''}
          ${p.destacado ? '<span class="cinta">Más pedido</span>' : ''}
        </button>
        <div class="tarjeta-texto">
          <h3>${esc(p.titulo)}</h3>
          ${precioHTML(p)}
          ${p.descripcion ? `<p>${esc(p.descripcion)}</p>` : ''}
        </div>
        <div class="tarjeta-acciones">
          <button type="button" class="btn btn-ig btn-chico" data-abrir="${esc(clave)}">Ver detalles</button>
          <a class="btn btn-wa btn-chico" href="${linkWhatsApp(mensajeProducto(p))}" target="_blank" rel="noopener" aria-label="Consultar ${esc(p.titulo)} por WhatsApp">${ICONO.wa}</a>
        </div>
      </article>`;
  }

  function prepararCarrusel(sec) {
    const pista = sec.querySelector('.carrusel');
    const [ant, sig] = sec.querySelectorAll('[data-mover]');
    const actualizar = () => {
      ant.disabled = pista.scrollLeft <= 4;
      sig.disabled = pista.scrollLeft + pista.clientWidth >= pista.scrollWidth - 4;
    };
    sec.querySelectorAll('[data-mover]').forEach((b) => b.addEventListener('click', () => {
      pista.scrollBy({ left: Number(b.dataset.mover) * pista.clientWidth * 0.85 });
    }));
    pista.addEventListener('scroll', actualizar, { passive: true });
    window.addEventListener('resize', actualizar);
    actualizar();
  }

  // ---------- Ventana de detalle ----------
  let actual = null;
  let indice = 0;

  function abrirDetalle(clave) {
    const x = productos.get(clave);
    if (!x) return;
    actual = x;
    indice = 0;
    const { p, c } = x;
    const fotos = p.fotos || [];
    dlgDetalle.innerHTML = `
      <button type="button" class="cerrar" data-cerrar aria-label="Cerrar">${ICONO.cerrar}</button>
      <div class="detalle-grid">
        <div class="galeria">
          <div class="galeria-principal">
            ${fotos.length ? `<img id="foto-grande" src="${esc(fotos[0])}" alt="${esc(p.titulo)}">` : ''}
            ${fotos.length ? `<button type="button" class="ampliar" data-ampliar>${ICONO.ampliar}Ampliar</button>` : ''}
            ${fotos.length > 1 ? `<button type="button" class="flecha ant" data-paso="-1" aria-label="Foto anterior">${ICONO.izq}</button>
            <button type="button" class="flecha sig" data-paso="1" aria-label="Foto siguiente">${ICONO.der}</button>` : ''}
          </div>
          ${fotos.length > 1 ? `<div class="miniaturas">${fotos.map((f, i) => `<button type="button" data-foto="${i}" aria-label="Foto ${i + 1}" aria-current="${i === 0}"><img src="${esc(f)}" alt=""></button>`).join('')}</div>` : ''}
        </div>
        <div class="info">
          <p class="etiqueta">${esc(c.titulo)}</p>
          <h2 id="detalle-titulo">${esc(p.titulo)}</h2>
          ${precioHTML(p)}
          ${p.descripcion ? `<p>${esc(p.descripcion)}</p>` : ''}
          ${(p.detalles || []).filter(Boolean).length ? `<ul class="lista-detalles">${p.detalles.filter(Boolean).map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
          <div class="acciones">
            <a class="btn btn-wa" href="${linkWhatsApp(mensajeProducto(p))}" target="_blank" rel="noopener">${ICONO.wa}Consultar por WhatsApp</a>
            <a class="btn btn-ig" href="${linkInstagramChat()}" target="_blank" rel="noopener" data-ig-detalle>${ICONO.ig}Consultar por Instagram</a>
            <p class="nota">Te abrimos el chat con un mensaje listo que dice que venís desde la página y por qué producto consultás.</p>
          </div>
        </div>
      </div>`;

    dlgDetalle.querySelector('[data-cerrar]').addEventListener('click', () => dlgDetalle.close());
    dlgDetalle.querySelectorAll('[data-paso]').forEach((b) => b.addEventListener('click', () => irA(indice + Number(b.dataset.paso))));
    dlgDetalle.querySelectorAll('[data-foto]').forEach((b) => b.addEventListener('click', () => irA(Number(b.dataset.foto))));
    const amp = dlgDetalle.querySelector('[data-ampliar]');
    if (amp) amp.addEventListener('click', abrirVisor);
    const grande = dlgDetalle.querySelector('#foto-grande');
    if (grande) { grande.addEventListener('click', abrirVisor); agregarDeslizar(dlgDetalle.querySelector('.galeria-principal')); }
    dlgDetalle.querySelector('[data-ig-detalle]').addEventListener('click', (ev) => alTocarInstagram(ev, mensajeProducto(p)));

    dlgDetalle.showModal();
  }

  function irA(i) {
    const fotos = actual.p.fotos || [];
    if (!fotos.length) return;
    indice = (i + fotos.length) % fotos.length;
    const g = dlgDetalle.querySelector('#foto-grande');
    if (g) g.src = fotos[indice];
    dlgDetalle.querySelectorAll('[data-foto]').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.foto) === indice)));
    if (dlgVisor.open) pintarVisor();
  }

  function agregarDeslizar(el) {
    let x0 = null;
    el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) irA(indice + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  // Cerrar tocando afuera de la ventana
  dlgDetalle.addEventListener('click', (e) => { if (e.target === dlgDetalle) dlgDetalle.close(); });

  // ---------- Visor a pantalla completa ----------
  function abrirVisor() {
    pintarVisor();
    dlgVisor.showModal();
  }
  function pintarVisor() {
    const fotos = actual.p.fotos || [];
    dlgVisor.innerHTML = `
      <button type="button" class="cerrar" data-cerrar aria-label="Cerrar foto ampliada">${ICONO.cerrar}</button>
      <div class="visor-lienzo"><img src="${esc(fotos[indice])}" alt="${esc(actual.p.titulo)}"></div>
      ${fotos.length > 1 ? `<button type="button" class="flecha ant" data-paso="-1" aria-label="Foto anterior">${ICONO.izq}</button>
      <button type="button" class="flecha sig" data-paso="1" aria-label="Foto siguiente">${ICONO.der}</button>
      <span class="visor-contador">${indice + 1} de ${fotos.length}</span>` : ''}`;
    dlgVisor.querySelector('[data-cerrar]').addEventListener('click', () => dlgVisor.close());
    dlgVisor.querySelectorAll('[data-paso]').forEach((b) => b.addEventListener('click', () => irA(indice + Number(b.dataset.paso))));
    const lienzo = dlgVisor.querySelector('.visor-lienzo');
    lienzo.querySelector('img').addEventListener('click', () => lienzo.classList.toggle('zoom'));
    agregarDeslizar(lienzo);
  }

  document.addEventListener('keydown', (e) => {
    if (!dlgDetalle.open || !actual) return;
    if (e.key === 'ArrowRight') irA(indice + 1);
    if (e.key === 'ArrowLeft') irA(indice - 1);
  });

  // ---------- Inicio ----------
  async function iniciar() {
    try {
      const { d, prueba } = await cargar();
      datos = d;
      document.title = d.tienda.nombre || document.title;
      render(prueba);
    } catch (e) {
      app.innerHTML = '<p class="cargando">No pudimos cargar el catálogo. Probá recargar la página.</p>';
    }
  }
  iniciar();
})();
