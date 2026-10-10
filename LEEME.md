# Florería Sogayse: página catálogo

Página web estática (HTML, CSS y JavaScript, sin servidor ni base de datos) con un panel de administración propio para el dueño.

## Qué hay en la carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html`, `estilos.css`, `sitio.js` | La página pública: portada, carruseles por sección, ventana de detalle con fotos ampliables, botones de WhatsApp e Instagram, horarios y dirección. |
| `contenido/catalogo.json` | **Todo el contenido**: datos de la florería, secciones, productos, precios, detalles y fotos. El panel edita este archivo. |
| `imagenes/ejemplos/` | Ilustraciones de muestra. Se reemplazan subiendo fotos reales desde el panel. |
| `imagenes/productos/` | Se crea sola: ahí quedan las fotos que sube el dueño desde el panel. |
| `admin/` | El panel de administración (`/admin`). |

## Cómo funciona el panel

- Se entra por `tusitio/admin` (también hay un link chiquito "Administrar" al pie de la página).
- Pestaña **Productos**: agregar, editar, ordenar y borrar productos y secciones. En cada producto se cargan fotos (desde el celular o la compu; se achican solas), nombre, precio, descripción, detalles (uno por renglón) y si es "Más pedido".
- Pestaña **Datos de la florería**: número de WhatsApp, usuario de Instagram, mensajes automáticos, textos de portada, dirección y horarios.
- Pestaña **Publicación**: conectar el aparato para que "Guardar y publicar" actualice la página real.
- Sin conectar, el panel está en **modo prueba**: guarda los cambios sólo en ese navegador y la página los muestra con un aviso. Sirve para practicar.

## Mensajes de contacto

- WhatsApp: los botones abren `wa.me/<número>?text=<mensaje>`. En cada producto el mensaje dice que la persona viene de la página web y nombra el producto (`{producto}` en la plantilla).
- Instagram no permite dejar un mensaje escrito por link. El botón de cada producto copia el mensaje y abre el chat (`ig.me/m/<usuario>`) para que la persona lo pegue. El botón general lleva al perfil.

## Publicarla gratis (GitHub Pages)

1. Crear una cuenta en GitHub (si no hay) y un repositorio nuevo, por ejemplo `floreria-sogayse`.
2. Subir todo el contenido de esta carpeta a la raíz del repositorio (botón "Add file → Upload files").
3. En el repositorio: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root)**. En uno o dos minutos la página queda en `https://<usuario>.github.io/floreria-sogayse/`.
4. (Opcional) Dominio propio, por ejemplo `floreriasogayse.com.ar`: se configura en la misma pantalla de Pages.

También funciona igual en Netlify o Cloudflare Pages conectados al mismo repositorio.

## Conectar el panel (una vez por aparato)

1. En GitHub: **Settings (de la cuenta) → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Repository access: *Only select repositories* → el repositorio de la página.
   - Permissions → Repository permissions → **Contents: Read and write**.
   - Elegir una fecha de vencimiento larga (por ejemplo, un año) y anotar cuándo vence.
2. Abrir `tusitio/admin` en el celular o la compu del dueño → pestaña **Publicación** → completar `usuario/floreria-sogayse`, rama `main` y la clave → **Conectar**.
3. Listo: desde ese aparato, "Guardar y publicar" sube las fotos y el catálogo, y GitHub Pages actualiza la página en 1 o 2 minutos.

La clave queda guardada sólo en ese navegador y sólo puede tocar ese repositorio. Si se pierde o roba el aparato, se revoca la clave en GitHub y se crea otra.

## Pendiente de confirmar

- Fotos reales y precios reales (los actuales son de ejemplo).
