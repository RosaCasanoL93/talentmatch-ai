# TalentMatch AI

> Plataforma web inteligente para gestionar procesos de reclutamiento, analizar CV y ordenar postulantes mediante un ranking explicable.

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-Backend-000000?style=for-the-badge&logo=express&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)

## Descripcion general

**TalentMatch AI** es una aplicacion web full-stack orientada a procesos de seleccion de personal. Permite publicar ofertas laborales, recibir postulaciones, cargar CV, analizar informacion relevante del candidato y generar un ranking de compatibilidad con explicacion del resultado.

El sistema esta pensado para demostraciones academicas, pilotos controlados y validacion funcional de una solucion de reclutamiento asistida por inteligencia artificial.

## Modulos principales

| Modulo | Descripcion |
|---|---|
| Portal de candidato | Permite revisar ofertas disponibles y postular sin iniciar sesion. |
| Postulacion con DNI | Registra el DNI del postulante para trazabilidad y consulta posterior. |
| Carga de CV | Acepta archivos en formato TXT, PDF y DOCX. |
| Analisis automatico | Extrae datos del CV y evalua experiencia, tecnologias y coincidencias. |
| Ranking de postulantes | Ordena candidatos segun compatibilidad con cada puesto. |
| Consulta por DNI | Permite al candidato verificar su posicion en el ranking. |
| Panel interno | Gestion de ofertas, candidatos, reportes y auditoria. |
| Exportacion CSV | Genera archivos para revision y sustento de decisiones. |

## Funcionalidades destacadas

- Autenticacion con roles para administrador, reclutador y auditor.
- Gestion de ofertas laborales y criterios de evaluacion.
- Registro de competencias tecnicas y habilidades blandas.
- Portal publico para postulantes.
- Validacion para evitar postulaciones duplicadas por DNI en una misma oferta.
- Lectura de CV en PDF, DOCX y TXT.
- Deteccion de correo, telefono, experiencia y tecnologias.
- Analisis de entrevista asincronica por texto.
- Ranking IA con recomendacion explicable.
- Reportes ejecutivos y bitacora de auditoria.
- Interfaz responsive con estilo profesional y modo oscuro.

## Tecnologia utilizada

| Componente | Tecnologia |
|---|---|
| Backend | Node.js + Express |
| Frontend | HTML, CSS y JavaScript |
| Persistencia | Base de datos JSON local |
| Archivos | Carga local en carpeta `uploads/` |
| Autenticacion | JWT |
| Seguridad base | Helmet, CORS y variables de entorno |
| Despliegue | Docker / Render |

## Estructura del proyecto

```txt
server.js             Backend, rutas API y motor de analisis
public/index.html     Interfaz principal
public/styles.css     Estilos visuales responsive
public/app.js         Logica del frontend
data/                 Base de datos JSON
uploads/              CV cargados por candidatos
Dockerfile            Configuracion para despliegue con Docker
render.yaml           Referencia para despliegue en Render
.env.example          Variables de entorno de ejemplo
README.md             Documentacion del proyecto
```

## Instalacion local

### 1. Requisitos

- Node.js 18 o superior.
- npm instalado.
- Git, si se desea subir el proyecto a GitHub.

### 2. Clonar o abrir el proyecto

Si el proyecto ya esta descargado, abre la carpeta donde se encuentran `package.json`, `server.js` y `Dockerfile`.

Si esta en GitHub:

```bash
git clone https://github.com/TU_USUARIO/talentmatch-ai.git
cd talentmatch-ai
```

### 3. Configurar variables de entorno

En Windows PowerShell:

```powershell
copy .env.example .env
```

En Linux/macOS:

```bash
cp .env.example .env
```

Edita el archivo `.env` y define una clave segura:

```env
NODE_ENV=development
JWT_SECRET=coloca_una_clave_segura_y_larga
DB_PATH=./data/talentmatch.json
UPLOAD_DIR=./uploads
```

### 4. Instalar dependencias

```bash
npm install
```

### 5. Ejecutar la aplicacion

```bash
npm start
```

Luego abre:

```txt
http://localhost:3000
```

## Despliegue en Render

Esta aplicacion requiere un servicio con soporte **Node.js**. No debe publicarse como sitio estatico, porque utiliza backend, autenticacion, carga de archivos y persistencia de datos.

### Opcion recomendada: Render con Docker

En Render, crea un **Web Service** conectado a tu repositorio de GitHub.

Configuracion sugerida:

```txt
Source: repositorio de GitHub
Branch: main
Root Directory: vacio, si package.json esta en la raiz
Dockerfile Path: ./Dockerfile
Docker Build Context Directory: .
```

Variables de entorno:

```txt
NODE_ENV=production
JWT_SECRET=coloca_una_clave_segura_y_larga
DB_PATH=./data/talentmatch.json
UPLOAD_DIR=./uploads
```

No agregues manualmente `PORT`, porque Render lo asigna automaticamente.

### Archivo `.dockerignore`

Para evitar errores de dependencias incompletas en Render, el proyecto debe incluir un archivo `.dockerignore` con este contenido:

```dockerignore
node_modules
npm-debug.log
.git
.env
uploads
```

Despues de subir cambios a GitHub, en Render usa:

```txt
Manual Deploy -> Clear build cache & deploy
```

## Uso del sistema

### Para candidatos

1. Ingresar al portal publico.
2. Revisar las ofertas disponibles.
3. Seleccionar un puesto.
4. Completar los datos personales, incluido el DNI.
5. Cargar el CV en PDF, DOCX o TXT.
6. Enviar la postulacion.
7. Consultar posteriormente la posicion en el ranking usando el DNI registrado.

### Para reclutadores o administradores

1. Iniciar sesion desde el panel interno.
2. Crear o actualizar ofertas laborales.
3. Revisar postulantes registrados.
4. Analizar el ranking de compatibilidad.
5. Revisar la explicacion del resultado.
6. Exportar reportes CSV para sustento del proceso.

## Seguridad y privacidad

Las credenciales de demostracion no deben publicarse en la pantalla inicial, capturas, videos ni repositorios publicos. Para una presentacion academica o piloto privado, las credenciales deben compartirse por un canal interno.

Antes de usar el sistema con informacion real de candidatos, se recomienda implementar:

- HTTPS obligatorio.
- Recuperacion segura de contrasena.
- Politicas de contrasena robustas.
- Base de datos persistente como PostgreSQL.
- Almacenamiento cifrado para CV.
- Copias de seguridad automaticas.
- Consentimiento informado para postulantes.
- Revision legal sobre tratamiento de datos personales.

## Alcance actual

Esta version esta lista para demostracion academica, piloto funcional y validacion controlada. Incluye backend, frontend, autenticacion, gestion de ofertas, carga de CV, analisis automatico, ranking de candidatos, consulta por DNI, reportes y auditoria.

Para operacion empresarial, se recomienda migrar la persistencia JSON a una base de datos administrada, reforzar la seguridad y formalizar el tratamiento legal de datos personales.

## Autoria

Proyecto desarrollado como solucion web para procesos de seleccion asistidos por analisis inteligente de postulantes.
