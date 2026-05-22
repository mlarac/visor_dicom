# Guía de Despliegue - Visor DICOM (Windows Server)

Este documento describe los pasos necesarios para desplegar la aplicación **Visor DICOM** en un entorno de producción sobre un servidor Windows Server, asumiendo que la base de datos (SQL Server) ya se encuentra instalada y configurada.

## Requisitos Previos

1. **Node.js**: Descargar e instalar la versión de Node.js **>= 20.6.0** (Requerida para el soporte nativo de variables de entorno). [Descargar Node.js](https://nodejs.org/).
2. **Acceso a la Base de Datos**: Credenciales de acceso a la instancia de SQL Server, nombre de la base de datos y puerto (por defecto 1433).
3. **Archivos del Proyecto**: El código fuente de la aplicación transferido al servidor (por ejemplo, en `C:\apps\visor-dicom`).

---

## 1. Instalación de Dependencias

1. Abre una terminal (PowerShell o Símbolo del sistema) como Administrador.
2. Navega hasta el directorio donde copiaste el proyecto:
   ```cmd
   cd C:\apps\visor-dicom
   ```
3. Instala los paquetes de Node.js ejecutando:
   ```cmd
   npm install --production
   ```

---

## 2. Configuración de Variables de Entorno

El proyecto utiliza un archivo `.env` para manejar la configuración de forma segura.

1. En la raíz del proyecto, crea o edita el archivo llamado `.env`.
2. Asegúrate de configurar los siguientes parámetros con los datos de producción:

```env
# Puerto en el que correrá la aplicación
PORT=80

# Configuración de SQL Server
DB_HOST=localhost       # O la IP del servidor de Base de Datos
DB_PORT=1433
DB_NAME=MiGlobal        # Nombre de tu base de datos
DB_USER=visor           # Usuario de SQL Server
DB_PASSWORD=TuPasswordSeguro

# Seguridad de Sesiones
SESSION_SECRET=GeneraUnaCadenaLargaYSecretaAqui
```

> **Nota:** Cambia el `PORT` a `80` si deseas acceder a la aplicación sin especificar el puerto en el navegador, asegurándote de que el puerto no esté en uso por IIS u otra aplicación.

---

## 3. Preparación del Almacenamiento DICOM (Archivos en otra partición o red)

Dado que la aplicación procesa archivos DICOM pesados, es común que estos residan en una partición dedicada (ej. `D:\` o `E:\`) o en una unidad de red compartida. Debes tener en cuenta lo siguiente:

1. **Rutas Absolutas en la Base de Datos**: 
   Si los archivos están en otra partición local (ej. `E:\DicomStorage\`), asegúrate de que el campo `directoryPath` en la tabla `Studies` de tu base de datos contenga la ruta absoluta completa hacia esa carpeta. Node.js puede leer sin problemas cualquier disco duro local conectado (`C:\`, `D:\`, `E:\`, etc.).

2. **Permisos del Servicio de Windows**:
   Si ejecutas la aplicación con PM2 (como servicio de fondo) utilizando el usuario por defecto del sistema (`Local System`), este tendrá acceso a todos los discos físicos locales. Sin embargo, si deseas restringir los accesos por seguridad:
   - Ve a **Servicios** (Services.msc) en Windows.
   - Busca el servicio creado (por ejemplo, `PM2`) y haz clic derecho > **Propiedades**.
   - En la pestaña **Iniciar sesión**, puedes configurar un usuario específico de Windows que tenga permisos explícitos de "Lectura" en esa otra partición.

3. **Carpetas Compartidas en Red (NAS o Servidor de Archivos)**:
   Si los archivos DICOM no están en un disco físico del servidor, sino en una carpeta compartida en la red:
   - **No uses unidades de red mapeadas** (ej. `Z:\Archivos`). Los servicios de Windows en segundo plano (como el de PM2) no pueden ver estas unidades.
   - **Utiliza Rutas UNC** absolutas en la base de datos (ej. `\\192.168.1.50\ArchivosDicom\Estudio1`).
   - El servicio de PM2 de Windows obligatoriamente debe estar configurado (desde Services.msc) para iniciar sesión con un usuario de Dominio que tenga acceso a esa ruta de red, ya que la cuenta `Local System` no tiene acceso a recursos de red.

---

## 4. Ejecución de la Aplicación como Servicio (Recomendado)

Para asegurar que la aplicación se mantenga en ejecución en segundo plano, se inicie automáticamente si el servidor se reinicia, y se recupere ante caídas, se recomienda usar **PM2**.

1. Instala PM2 globalmente en el servidor:
   ```cmd
   npm install -g pm2
   ```

2. Inicia la aplicación con PM2 utilizando el script `start` que configuramos previamente:
   ```cmd
   pm2 start npm --name "VisorDICOM" -- start
   ```

3. Instala el módulo de PM2 para configurar el inicio automático con Windows:
   ```cmd
   npm install pm2-windows-startup -g
   pm2-startup install
   ```

4. Guarda la lista actual de procesos para que PM2 los levante tras un reinicio:
   ```cmd
   pm2 save
   ```

### Comandos útiles de PM2:
- Ver el estado de la app: `pm2 status`
- Ver los logs (útil para errores): `pm2 logs VisorDICOM`
- Reiniciar la app: `pm2 restart VisorDICOM`
- Detener la app: `pm2 stop VisorDICOM`

---

## 5. Configuración del Firewall de Windows

Si tus usuarios necesitan acceder desde otros equipos de la red:

1. Abre "Windows Defender Firewall con seguridad avanzada".
2. Ve a **Reglas de entrada** > **Nueva regla...**
3. Selecciona **Puerto** y haz clic en Siguiente.
4. TCP, Puertos locales específicos: Ingresa el puerto configurado en el `.env` (ej. `80` o `3000`).
5. Permite la conexión, aplica a los perfiles correspondientes (Dominio/Privado/Público).
6. Nombra la regla, por ejemplo: `Visor DICOM (Node.js)`.

---

## 6. Verificación Final

1. Abre un navegador web en cualquier equipo conectado a la red del servidor.
2. Ingresa a la IP del servidor en la barra de direcciones:
   - Ejemplo: `http://192.168.1.100` (si usaste el puerto 80).
   - Ejemplo: `http://192.168.1.100:3000` (si usaste el puerto 3000).
3. Deberías ver la pantalla de inicio de sesión de la aplicación Visor DICOM.
