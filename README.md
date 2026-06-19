# 🏁 RETO SPEED — Sistema de Resultados en Vivo

Sistema web para mostrar los resultados del torneo **Reto Speed** en una pantalla grande (10 m × 5.6 m), con cronómetro, ingreso manual de tiempos y recomposición automática de posiciones.

## ¿Qué hace?

- **Pantalla de proyección** (`/`): muestra el top 4 con la línea gráfica del torneo y hace scroll automático por el resto de los 16 equipos. Se actualiza sola en tiempo real.
- **Panel de control** (`/control`): protegido por PIN. Incluye cronómetro manual (iniciar/detener/reset), ingreso de tiempos en formato `M:SS:CC` (ej. `4:55:67`), y botón para borrar todo y empezar de cero.
- **Recomposición automática**: al ingresar un tiempo, el equipo con el menor tiempo sube al primer lugar. Los equipos sin tiempo quedan al final, en orden de carrera.

Los 16 equipos vienen precargados en su orden de competencia:
`GRAIAU, GEECO, GAD, DAI, OC, GITI, GCP, GRYGE, GRF, GL, GI, GOF, GS, GEFPP, ONEC, GRIFI`

---

## Despliegue en Railway (paso a paso)

### 1. Subir a GitHub

```bash
cd reto-speed
git init
git add .
git commit -m "Reto Speed - sistema de resultados"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/reto-speed.git
git push -u origin main
```

### 2. Crear el proyecto en Railway

1. Entra a [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Selecciona tu repositorio `reto-speed`.
3. Railway detecta Node.js y hace el build automáticamente.

### 3. Añadir la base de datos PostgreSQL

1. Dentro del proyecto: **New** → **Database** → **Add PostgreSQL**.
2. Railway crea la base y define la variable `DATABASE_URL` automáticamente. **No tienes que copiarla.** La app la lee sola y crea las tablas + siembra los 16 equipos en el primer arranque.

### 4. Configurar el PIN

En el servicio de la app → pestaña **Variables** → añade:

| Variable    | Valor (ejemplo)     |
|-------------|---------------------|
| `ADMIN_PIN` | `tu-pin-secreto`    |

> Si no la defines, el PIN por defecto es `1234`. **Cámbialo antes de la carrera oficial.**

### 5. Generar el dominio público

En el servicio de la app → **Settings** → **Networking** → **Generate Domain**.

Tendrás una URL como `https://reto-speed-production.up.railway.app`.

- **Pantalla grande:** abre la URL raíz `/`.
- **Operador (otro dispositivo):** abre `/control` e ingresa el PIN.

---

## Cómo usarlo el día del evento

1. **Antes de empezar:** entra a `/control`, y si hiciste pruebas, presiona **"Borrar todo y empezar de cero"** (pide doble confirmación).
2. **Proyección:** abre `/` en la computadora conectada a la pantalla de 10×5.6 m. Ponla en pantalla completa (F11).
3. **Por cada equipo:** usa el cronómetro o ingresa el tiempo manualmente, elige el equipo y presiona **Guardar**. La proyección se actualiza en 1–2 segundos y las posiciones se reordenan solas.
4. **Corrección:** si te equivocas, puedes volver a guardar el tiempo de un equipo (lo sobreescribe) o usar "Borrar" para dejarlo sin tiempo.

---

## Correr localmente (opcional)

Necesitas PostgreSQL instalado.

```bash
npm install
cp .env.example .env      # edita DATABASE_URL y ADMIN_PIN
# crea la base: createdb retospeed
DATABASE_URL="postgresql://usuario:pass@localhost:5432/retospeed" ADMIN_PIN="1234" npm start
```

Abre http://localhost:3000 (proyección) y http://localhost:3000/control (operador).

---

## Estructura

```
reto-speed/
├── src/
│   ├── server.js     # Servidor Express + API
│   └── db.js         # PostgreSQL: esquema, siembra, ranking
├── public/
│   ├── index.html    # Pantalla de proyección
│   └── control.html  # Panel del operador
├── package.json
├── railway.json      # Config de despliegue Railway
├── .env.example
└── .gitignore
```

## Notas técnicas

- **Formato de tiempo:** `M:SS:CC` = minuto : segundo : centésimas (2 dígitos), como en las imágenes de referencia (`4:55:67`). Internamente se guarda en milisegundos para ordenar con precisión.
- **Sincronización:** proyección y control se comunican vía la base de datos; pueden estar en dispositivos distintos. La proyección consulta cada 1.5 s.
- **Sin dependencias de frontend:** HTML/CSS/JS puro, sin frameworks, para máxima fiabilidad en el evento.
