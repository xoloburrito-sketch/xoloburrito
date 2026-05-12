## Problema

En `/cierre`, el input de fecha y la cabecera "fecha en directo" muestran el día anterior (11 en lugar de 12).

**Causa raíz**: TanStack Start hace SSR. El servidor (Cloudflare Worker) corre en UTC. Cuando son las 00:30 en España (CEST), en UTC siguen siendo las 22:30 del día anterior, así que `useState(hoyISO())` se inicializa con el día UTC. El `useEffect` que refresca la fecha solo dispara cada 60 s o al hacer focus, no en el mount, por lo que la fecha incorrecta puede quedar visible mucho tiempo.

El mismo patrón también afecta a `getPedidosHoy` en `src/lib/store.ts` si se llama en SSR.

## Cambios

**Archivo único**: `src/routes/_app.cierre.tsx`

1. Inicializar `fecha` con cadena vacía y rellenarla en `useEffect` con `fechaHoyLocal()` (siempre se ejecuta solo en cliente, en zona horaria local).
2. En el `useEffect` del reloj, llamar `tick()` una vez al montar antes de programar el `setInterval`, para que la fecha local se aplique inmediatamente.
3. Si `fecha` está vacía al renderizar, evitar lanzar `cargar(fecha)` con string vacía (saltar el efecto hasta que tenga valor).

No se toca el diseño ni el resto de la lógica (turnos, arqueo, listado, impresión). No se introducen archivos nuevos.

## Verificación

- Recargar `/cierre` cualquier hora del día → la fecha mostrada y el `<input type="date">` deben coincidir con el día local del navegador.
- Abrir la página justo después de medianoche en España con el servidor en UTC → debe mostrar el día nuevo, no el anterior.
- Reloj y fecha siguen actualizándose cada 60 s y al volver el foco.
