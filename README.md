# TalentMatch AI - Producto web funcional

Aplicación web full-stack para una plataforma inteligente de reclutamiento que analiza CVs, entrevistas y habilidades blandas mediante un motor de evaluación explicable.

## Funcionalidades incluidas

- Inicio de sesión con roles: administrador, reclutador y auditor.
- Backend Node.js + Express.
- Base de datos JSON persistente en servidor.
- Gestión de ofertas laborales.
- Ponderación de competencias técnicas y habilidades blandas.
- Portal público para candidatos con ofertas disponibles.
- Postulación sin inicio de sesión mediante formulario público.
- Registro de DNI para trazabilidad de postulación.
- Consulta pública de posición en ranking mediante DNI.
- Registro de candidatos desde panel interno o portal público.
- Carga de CV en TXT, PDF o DOCX.
- Extracción de texto desde PDF y DOCX mediante librerías locales.
- Detección de correo, teléfono, experiencia y tecnologías.
- Análisis de entrevista asincrónica por texto.
- Ranking de compatibilidad candidato-puesto.
- Explicación textual de la recomendación IA.
- Auditoría de sesgos simulada.
- Reportes ejecutivos.
- Exportación CSV.
- Bitácora de auditoría.
- Interfaz profesional responsive con modo oscuro.

## Credenciales iniciales privadas

Estas credenciales se mantienen solo en la documentación técnica. No se muestran en la pantalla pública de la aplicación.

Administrador:

```txt
correo: admin@talentmatch.ai
contraseña: Admin2026!
```

Reclutador:

```txt
correo: rrhh@empresa.pe
contraseña: Recruiter2026!
```

Cambie estas credenciales antes de usar el sistema con información real. No publique estas credenciales en la interfaz, repositorios públicos ni capturas de pantalla.

## Instalación local

1. Instale Node.js 18 o superior.
2. Abra la carpeta del proyecto en una terminal.
3. Copie el archivo de entorno:

```bash
cp .env.example .env
```

En Windows PowerShell:

```powershell
copy .env.example .env
```

4. Instale dependencias:

```bash
npm install
```

5. Ejecute la aplicación:

```bash
npm start
```

6. Abra el navegador en:

```txt
http://localhost:3000
```

## Despliegue en dominio

Esta aplicación necesita hosting con soporte Node.js. No es solo HTML estático.

Opciones recomendadas:

- Render
- Railway
- Fly.io
- VPS propio
- cPanel con Node.js App
- Docker en servidor propio

### Despliegue rápido en Render

1. Suba este proyecto a un repositorio de GitHub.
2. Cree un servicio Web en Render.
3. Configure:

```txt
Build command: npm install
Start command: npm start
```

4. Agregue las variables de entorno:

```txt
NODE_ENV=production
JWT_SECRET=una_clave_segura_larga
DB_PATH=./data/talentmatch.json
UPLOAD_DIR=./uploads
```

5. Publique el servicio y apunte su dominio personalizado desde DNS.

## Uso operativo

1. Inicie sesión como administrador.
2. Registre ofertas laborales y defina competencias técnicas y blandas.
3. Registre candidatos y cargue su CV.
4. Pegue o cargue contenido curricular para mejorar el análisis.
5. Agregue respuestas de entrevista asincrónica.
6. Para postular como candidato, ingrese a la pantalla inicial sin iniciar sesión, seleccione un puesto disponible, registre su DNI, cargue el CV y envíe el formulario público.
7. El candidato puede consultar su posición en el ranking ingresando el DNI usado en la postulación.
8. Revise ranking IA, explicación, reportes y auditoría desde el panel de administrador o reclutador.
9. Exporte CSV para sustentar decisiones.

## Alcance real del producto

Esta entrega es funcional para uso académico, demostración y piloto controlado. Incluye backend, base de datos, autenticación, formularios, análisis automático y reportes.

Para uso empresarial con datos sensibles se recomienda agregar:

- HTTPS obligatorio en producción.
- Políticas de contraseña robustas.
- Recuperación de contraseña por correo.
- Almacenamiento cloud cifrado para archivos.
- Base de datos PostgreSQL administrada.
- Copias de seguridad automáticas.
- Consentimiento informado para candidatos.
- Términos de tratamiento de datos personales.
- Modelos de IA certificados o API de IA externa.
- Revisión legal para Ley N.° 29733 y GDPR.

## Estructura

```txt
server.js             Backend, rutas API y motor de análisis
public/index.html     Interfaz principal
public/styles.css     Estilos profesionales responsive
public/app.js         Lógica frontend
data/                 Base de datos JSON generada automáticamente
uploads/              Archivos CV cargados
Dockerfile            Despliegue con Docker
render.yaml           Referencia de despliegue en Render
.env.example          Variables de entorno
```
