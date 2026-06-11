# Destin Flow MVP Local

Destin Flow es un MVP local para controlar gastos familiares, de amigos o negocio por grupos separados.

## Como abrir

Abre `index.html` directamente en el navegador.

## Funciones incluidas

- Registro inicial local con nombre/alias y modo de uso.
- Multiples grupos separados.
- Roles: admin, miembro y solo lectura.
- Invitaciones simuladas con link local.
- Transferencia de administrador.
- Expulsar miembros.
- Archivar, restaurar y eliminar grupos.
- Gastos familiares y de negocio.
- Metodos de pago compartidos.
- Presupuestos mensuales.
- Categorias personalizadas.
- Reportes, filtros, CSV y copia JSON.
- Historial de actividad por grupo.

## Importante

Los datos se guardan en `localStorage`, solo en este navegador/equipo. En modo local se separan por nombre/alias; en modo cloud se separan por cuenta Google/correo. Usa **Configuracion > Descargar copia JSON** para respaldar.

## Activar nube con Supabase

La integracion cloud esta preparada, pero queda apagada hasta que coloques tus llaves.

1. Crea un proyecto en Supabase.
2. Abre el SQL editor de Supabase y ejecuta el archivo `supabase-schema.sql`.
3. Abre `cloud-config.js`.
4. Cambia `enabled: false` por `enabled: true`.
5. Reemplaza `supabaseUrl` con la URL del proyecto.
6. Reemplaza `supabaseAnonKey` con la anon public key.
7. Abre `index.html` y entra en **Configuracion > Cuenta en la nube**.

En esta fase ya se puede crear cuenta, iniciar sesion con correo/contrasena, preparar acceso con Google y guardar/restaurar una copia completa de los datos locales en Supabase.

## Sincronizacion cloud

La primera sincronizacion cloud funciona como copia completa por usuario:

- **Subir datos locales** guarda en Supabase todo lo que existe en este navegador.
- **Restaurar desde nube** reemplaza los datos locales por la ultima copia guardada en Supabase.
- **Publicar grupo activo** guarda el grupo actual como grupo compartido cloud.
- **Copiar link para unirse** genera un link unico del grupo. Quien lo abre debe entrar con Google y queda agregado como miembro.
- **Subir cambios del grupo** actualiza en Supabase la version del grupo activo.
- **Traer cambios del grupo** reemplaza el grupo activo local por la version mas reciente de Supabase.
- **Invitar cloud** da acceso al correo invitado para traer ese grupo.
- **Cargar grupos compartidos** lista los grupos cloud disponibles para la cuenta iniciada.
- Cuando un grupo ya esta publicado, los cambios locales se suben automaticamente y otros navegadores conectados reciben la version nueva con Supabase Realtime.
- Los gastos se sincronizan tambien como registros separados en `cloud_expenses`, para que dos personas puedan agregar gastos al mismo tiempo sin reemplazar el gasto de la otra.
- **Subir cambios del grupo** y **Traer cambios del grupo** quedan como controles manuales de respaldo.

Si ya ejecutaste el SQL antes de esta fase, ejecuta `supabase-cloud-groups-migration.sql` en Supabase para crear las tablas `cloud_snapshots`, `cloud_groups`, `cloud_group_access` y sus permisos. Para un proyecto nuevo puedes ejecutar `supabase-schema.sql`.

## Login con Google

Para usar **Continuar con Google** debes activar el proveedor Google en Supabase:

1. En Supabase abre **Authentication > Providers > Google**.
2. Activa Google y pega el Client ID y Client Secret de Google Cloud.
3. En Google Cloud agrega la redirect URL que Supabase muestra en el panel del proveedor.
4. En Supabase agrega tu URL de app en **Authentication > URL Configuration > Redirect URLs**.
5. En `cloud-config.js`, coloca tu URL publicada en `appUrl`, por ejemplo `https://tu_usuario.github.io/destin-flow/`.

Nota: Google OAuth necesita regresar a una direccion `http://`, `https://` o una URL publicada. Si abres la app como `file://`, el boton mostrara un aviso. Para probar Google localmente puedes servir la carpeta en `http://localhost`.

## Checklist de prueba

1. Crear perfil local.
2. Crear un grupo nuevo.
3. Agregar metodo de pago.
4. Registrar gasto familiar.
5. Registrar gasto de negocio.
6. Invitar un miembro y aceptar invitacion.
7. Transferir administrador.
8. Probar rol solo lectura.
9. Exportar CSV.
10. Descargar y restaurar copia JSON.
11. Activar Supabase en `cloud-config.js`.
12. Crear cuenta cloud o iniciar sesion desde Configuracion.
13. Configurar Google Provider y probar Continuar con Google desde una URL `http://localhost`.
14. Usar **Subir datos locales**.
15. Probar **Restaurar desde nube** en el mismo navegador o en otro equipo con la misma cuenta.
16. Usar **Publicar grupo activo**.
17. Invitar otro correo con **Invitar cloud**.
18. Entrar con ese correo, usar **Cargar grupos compartidos** y traer el grupo.
19. Registrar un gasto nuevo y usar **Subir cambios del grupo**.
20. En la otra cuenta, usar **Traer cambios del grupo**.
21. Usar **Copiar link para unirse** y abrirlo en otro navegador o perfil.
22. Entrar con Google para unirse automaticamente al grupo.

## Historial de versiones

### v0.1.9-beta - Add cloud sync diagnostics

- Agrega diagnostico visible de cuenta local, cuenta nube, grupo activo y ultimo error.
- Agrega el boton **Reparar sincronizacion** para publicar, subir y cargar el grupo activo desde cloud.
- Facilita revisar por que un celular o computadora queda sin recibir datos.

### v0.1.8-beta - Add version history to README

- Agrega historial de versiones al README.
- Define que cada cambio incluya version y nombre de commit.
- Deja documentadas las mejoras recientes de sincronizacion cloud.

### v0.1.7-beta - Auto publish cloud groups

- Publica automaticamente el grupo activo cuando una cuenta cloud entra por primera vez.
- Reduce la necesidad de presionar manualmente **Publicar grupo activo**.
- Prepara el grupo para sincronizacion entre dispositivos al refrescar la pagina.

### v0.1.6-beta - Show cloud sync errors

- Muestra **Error de nube** cuando Supabase rechaza una sincronizacion.
- Guarda el ultimo error cloud en el estado local para facilitar diagnostico.
- Limpia el error cuando la sincronizacion se completa correctamente.

### v0.1.5-beta - Fix automatic sync for group settings

- Permite sincronizar cambios de miembros y configuracion aunque la nube tenga cambios recientes.
- Conserva gastos al mezclar cambios locales con version cloud.
- Evita que cambios de configuracion queden indefinidamente como **Pendiente de nube**.

### v0.1.4-beta - Improve cloud sync fallback polling

- Agrega revision automatica de nube cada 8 segundos.
- Revisa la nube al volver a enfocar la pestana.
- Mejora la recepcion de cambios entre celular y computadora cuando Realtime tarda o no dispara.

## Futuro backend

Para version real multiusuario se necesita backend con usuarios, login, base de datos, correos de invitacion, permisos reales y sincronizacion en nube.
