# 🎬 Roxi's Movies

Sistema de venta de entradas de cine, hecho para el TP de Programación IV. Es una app de Angular que se conecta directo a Supabase (base de datos + autenticación + tiempo real), sin backend propio.

## ¿Qué hace?

- Los usuarios pueden ver la cartelera, buscar películas por nombre, filtrar por uno o varios géneros a la vez, leer y dejar reseñas con estrellas (con promedio calculado), y comprar entradas eligiendo butaca (con mapa de sala en tiempo real).
- Las butacas tienen 3 tipos: generales, accesibles (fila especial para personas con discapacidad) y VIP (últimas 3 filas, precio más alto), cada una marcada con un color distinto y con una leyenda que explica qué significa cada color. Si elegís una butaca VIP, te avisa antes de pagar.
- En la home se destacan primero las 3 películas más vendidas, hay una sección de "Próximamente" (con alertas para cuando se habilite la venta) y un sistema de preventa con precio especial los 7 días previos al estreno.
- Los usuarios registrados tienen una sección "Mis películas" con el historial de todo lo que vieron, con póster, fecha y su propia calificación.
- También se puede comprar candy bar (pochoclos, bebidas) junto con la entrada, y hay combos especiales (entrada + candy a precio fijo) que reemplazan el costo de una butaca.
- Hay un sistema de cupones de descuento configurable desde el admin: porcentaje editable, fecha de vencimiento opcional, y se pueden restringir a usuarios mayores de 50 años o a la primera compra de cada usuario.
- Se puede comprar sin estar registrado (como invitado), aunque registrarse trae beneficios (como poder usar cupones restringidos).
- Hay un panel de administración completo con CRUD (crear, editar, borrar) de películas, funciones, salas, candy, combos y cupones, más un log de auditoría que registra quién hizo qué acción y cuándo.

## Cómo está armado

### Angular sin backend propio

Todo el proyecto son componentes **standalone** de Angular (no uso `NgModule` en ningún lado). No hay un servidor propio: la app le habla directo a **Supabase**, que me da la base de datos (Postgres), el login/registro de usuarios, y el sistema de tiempo real para las butacas.

### Rutas que cargan bajo demanda (lazy loading)

Cada pantalla (`app.routes.ts`) se carga con `loadComponent`, que hace que el código de esa pantalla se descargue recién cuando el usuario navega ahí, no todo junto al entrar a la app. Por ejemplo, si nunca entrás al panel de admin, ese código ni se descarga.

### Estado con Signals

En vez de usar RxJS/Observables para todo, uso el sistema de **signals** de Angular para manejar el estado de la app (por ejemplo, quién está logueado, qué butacas están ocupadas, qué géneros elegiste en el filtro). Es más simple de leer y Angular sabe automáticamente cuándo tiene que volver a pintar la pantalla.

### Butacas en tiempo real

Cuando estás eligiendo butacas, si otra persona compra una al mismo tiempo, la ves ponerse gris al instante en tu pantalla, sin recargar nada. Esto lo hago con **Supabase Realtime**: me suscribo a los cambios de la tabla de butacas vendidas, filtrado por la función que se está mirando.

### Las salas se arman solas

Todas las salas del cine tienen la misma distribución de butacas (20 filas, con una fila accesible y 3 filas VIP al final). En vez de generar ese mapa a mano cada vez, hay un **trigger en la base de datos**: apenas se crea una sala nueva desde el admin, Postgres genera automáticamente las butacas correspondientes con el tipo correcto (general, VIP, accesible).

### Asignación automática de salas

Cuando se carga una función nueva desde el admin, el sistema elige solo en qué sala ponerla, revisando que no se pise con otra función ese mismo día (respetando 30 minutos de margen entre una función y la siguiente, como pide el negocio). Si no queda ninguna sala libre a ese horario, avisa el error en vez de dejar que se pisen dos funciones. Esta misma validación se vuelve a correr si después editás el horario de una función ya creada, para no romper la regla.

### Compra real, no simulada

Cuando alguien confirma una compra, se guarda de verdad en la base: qué función, qué butacas puntuales, qué productos de candy, qué combos y cuánto se pagó por cada cosa. No es un simulacro con datos guardados en el navegador.

### Combos con entrada incluida

El mail del cliente pedía "combos especiales: entrada + pochoclos + bebida a un precio fijo". Cada combo cubre el precio de una butaca (además del candy que incluya): si elegís 2 combos, las primeras 2 butacas de tu selección se cobran a $0 en la base, porque su costo ya está adentro del precio fijo del combo, que se guarda aparte en `entrada_combos`.

### Cupones con reglas de negocio reales

Los cupones no son solo un código y un porcentaje: cada uno se valida contra 3 reglas antes de aplicarse (todas chequeadas en el servidor, nunca confiando en nada del navegador):
1. Que esté activo y no haya vencido.
2. Si está marcado "solo mayores de 50", que el usuario logueado tenga esa edad (calculada desde su fecha de nacimiento real, no un dato que mande el front).
3. Si está marcado "solo primera compra", que ese usuario no tenga ninguna entrada previa registrada en la base.

Un invitado sin cuenta nunca puede usar los cupones de los tipos 2 y 3, porque no hay forma de verificar esos datos sin sesión.

### Log de auditoría

El admin tiene una pestaña de "Reportes & Logs" que muestra un registro de acciones importantes: quién creó una función, quién modificó un precio (de película, candy o cupón), quién creó o desactivó un cupón, etc. Cada log guarda el usuario, la acción, un detalle y la fecha/hora automática. Si guardar un log falla por algún motivo, no rompe la acción principal (por ejemplo, crear la función ya se hizo antes de intentar loguearla) — solo se avisa por consola.

## Decisiones técnicas que tomé

- **Autenticación con Supabase Auth real**, no una tabla propia con contraseñas en texto plano. El login/registro pasa por el sistema de Auth de Supabase, y mi tabla de usuarios solo guarda los datos de perfil (nombre, fecha de nacimiento, rol, etc.), no la contraseña.
- **El rol de administrador se valida siempre contra la base de datos**, nunca contra algo guardado en el navegador — así nadie puede "hacerse pasar" por admin manipulando su sesión local.
- **La compra se puede hacer sin estar logueado**, tal como lo pidió el cliente. Solo el perfil, el panel de admin y algunos cupones restringidos piden sesión iniciada.
- **Cada butaca vendida queda con una restricción única** en la base (no puede venderse la misma butaca dos veces para la misma función), para que ni con mala suerte de timing se duplique una venta.
- **El precio pagado se guarda en el momento de la compra**, no se recalcula después — así si el día de mañana cambio el precio de una butaca VIP, las entradas viejas siguen mostrando lo que la persona pagó en su momento.
- **Restricción de edad real**: se calcula la edad exacta desde la fecha de nacimiento y se compara contra la clasificación de la película antes de dejar comprar.
- **Los cupones desactivados nunca se borran**, se marcan como inactivos. Así las compras viejas que ya usaron ese cupón mantienen su historial intacto.
- **Editar una función no reasigna su sala**: se mantiene la sala que ya tenía, pero se vuelve a validar el margen de 30 minutos contra las demás funciones de esa sala y ese día, para no romper la regla de negocio si cambiás el horario.

## Cómo correr el proyecto

```bash
npm install
npm start
```

Necesita un archivo de entorno con las credenciales de Supabase (`src/app/environments/environment.ts`) con `supabaseUrl` y `supabasePublishableKey`.

## Estado actual

Lo que ya funciona de punta a punta: registro/login, cartelera con búsqueda y filtro de género múltiple, reseñas con promedio, "Próximamente" con alertas de estreno, preventa con precio especial, selección de butacas en tiempo real (generales/accesibles/VIP), compra completa (entradas + candy + combos), cupones configurables con restricciones de edad y primera compra, restricción de edad para películas, "Mis películas", y un panel de admin con CRUD completo de películas, funciones, salas, candy, combos y cupones, más log de auditoría.

Lo que todavía falta: generación de QR y PDF de la entrada, validación de entradas por parte de empleados (escaneo o código manual), cancelación de compras con crédito real, sistema de puntos de fidelización, reportes de facturación reales en el admin (hoy son botones de ejemplo), y la instalación como PWA.
