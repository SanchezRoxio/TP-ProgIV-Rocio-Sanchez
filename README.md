# 🎬 Roxi's Movies

Sistema de venta de entradas de cine, hecho para el TP de Programación IV. Es una app de Angular que se conecta directo a Supabase (base de datos + autenticación + tiempo real), sin backend propio.

## ¿Qué hace?

- Los usuarios pueden ver la cartelera, buscar películas, leer y dejar reseñas, y comprar entradas eligiendo butaca (con mapa de sala en tiempo real).
- También se puede comprar candy bar (pochoclos, bebidas) junto con la entrada.
- Se puede comprar sin estar registrado (como invitado), aunque registrarse trae beneficios.
- Hay un panel de administración donde se cargan películas, funciones, salas y productos del candy bar.

## Cómo está armado

### Angular sin backend propio

Todo el proyecto son componentes **standalone** de Angular (no uso `NgModule` en ningún lado). No hay un servidor propio: la app le habla directo a **Supabase**, que me da la base de datos (Postgres), el login/registro de usuarios, y el sistema de tiempo real para las butacas.

### Rutas que cargan bajo demanda (lazy loading)

Cada pantalla (`app.routes.ts`) se carga con `loadComponent`, que hace que el código de esa pantalla se descargue recién cuando el usuario navega ahí, no todo junto al entrar a la app. Por ejemplo, si nunca entrás al panel de admin, ese código ni se descarga.

### Estado con Signals

En vez de usar RxJS/Observables para todo, uso el sistema de **signals** de Angular para manejar el estado de la app (por ejemplo, quién está logueado, qué butacas están ocupadas). Es más simple de leer y Angular sabe automáticamente cuándo tiene que volver a pintar la pantalla.

### Butacas en tiempo real

Cuando estás eligiendo butacas, si otra persona compra una al mismo tiempo, la ves ponerse gris al instante en tu pantalla, sin recargar nada. Esto lo hago con **Supabase Realtime**: me suscribo a los cambios de la tabla de butacas vendidas, filtrado por la función que se está mirando.

### Las salas se arman solas

Todas las salas del cine tienen la misma distribución de butacas (20 filas, con una fila accesible y 3 filas VIP al final). En vez de generar ese mapa a mano cada vez, hay un **trigger en la base de datos**: apenas se crea una sala nueva desde el admin, Postgres genera automáticamente las ~518 butacas correspondientes con el tipo correcto (general, VIP, accesible).

### Asignación automática de salas

Cuando se carga una función nueva desde el admin, el sistema elige solo en qué sala ponerla, revisando que no se pise con otra función ese mismo día (respetando 30 minutos de margen entre una función y la siguiente, como pide el negocio). Si no queda ninguna sala libre a ese horario, avisa el error en vez de dejar que se pisen dos funciones.

### Compra real, no simulada

Cuando alguien confirma una compra, se guarda de verdad en la base: qué función, qué butacas puntuales, qué productos de candy y cuánto se pagó por cada cosa. No es un simulacro con datos guardados en el navegador.

## Decisiones técnicas que tomé

- **Autenticación con Supabase Auth real**, no una tabla propia con contraseñas en texto plano. El login/registro pasa por el sistema de Auth de Supabase, y mi tabla de usuarios solo guarda los datos de perfil (nombre, fecha de nacimiento, rol, etc.), no la contraseña.
- **El rol de administrador se valida siempre contra la base de datos**, nunca contra algo guardado en el navegador — así nadie puede "hacerse pasar" por admin manipulando su sesión local.
- **La compra se puede hacer sin estar logueado**, tal como lo pidió el cliente. Solo el perfil y el panel de admin piden sesión iniciada.
- **Cada butaca vendida queda con una restricción única** en la base (no puede venderse la misma butaca dos veces para la misma función), para que ni con mala suerte de timing se duplique una venta.
- **El precio pagado se guarda en el momento de la compra**, no se recalcula después — así si el día de mañana cambio el precio de una butaca VIP, las entradas viejas siguen mostrando lo que la persona pagó en su momento.
- **Restricción de edad real**: se calcula la edad exacta desde la fecha de nacimiento y se compara contra la clasificación de la película antes de dejar comprar.

## Cómo correr el proyecto

```bash
npm install
npm start
```

Necesita un archivo de entorno con las credenciales de Supabase (`src/app/environments/environment.ts`) con `supabaseUrl` y `supabasePublishableKey`.

## Estado actual

Lo que ya funciona de punta a punta: registro/login, cartelera con búsqueda y reseñas, selección de butacas en tiempo real, compra completa (entradas + candy), restricción de edad, y un panel de admin para cargar películas/funciones/salas/candy (con edición y borrado para candy).

Lo que todavía falta: generación de QR y PDF de la entrada, reportes de facturación reales en el admin, sistema de cupones y puntos configurables, cancelación de compras con crédito, y la instalación como PWA.
