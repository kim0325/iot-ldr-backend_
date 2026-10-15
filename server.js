const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir la interfaz web estática desde la carpeta /public
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar la base de datos SQL
const db = new sqlite3.Database('./monitoreo.db', (err) => {
    if (err) {
        console.error('Error al conectar con SQLite:', err.message);
    } else {
        console.log('Base de datos SQL conectada exitosamente.');
    }
});

// Crear tabla de almacenamiento
db.run(`
    CREATE TABLE IF NOT EXISTS lecturas_luz (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dispositivo TEXT,
        valor_adc INTEGER,
        porcentaje_luz REAL,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Función para obtener la fecha y hora local formateada (YYYY-MM-DD HH:MM:SS)
function obtenerFechaHoraLocal() {
    const opciones = {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const formateador = new Intl.DateTimeFormat('es-MX', opciones);
    const partes = formateador.formatToParts(new Date());
    
    let YYYY, MM, DD, hh, mm, ss;
    for (const parte of partes) {
        if (parte.type === 'year') YYYY = parte.value;
        if (parte.type === 'month') MM = parte.value;
        if (parte.type === 'day') DD = parte.value;
        if (parte.type === 'hour') hh = parte.value;
        if (parte.type === 'minute') mm = parte.value;
        if (parte.type === 'second') ss = parte.value;
    }
    return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
}

// Endpoint POST: Recibe datos del ESP32 y guarda la fecha en hora local
app.post('/api/lecturas', (req, res) => {
    const { dispositivo, valor_adc, porcentaje_luz } = req.body;

    if (valor_adc === undefined || porcentaje_luz === undefined) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const fechaLocal = obtenerFechaHoraLocal();
    const query = `INSERT INTO lecturas_luz (dispositivo, valor_adc, porcentaje_luz, fecha_registro) VALUES (?, ?, ?, ?)`;
    const params = [dispositivo || 'ESP32_LDR', valor_adc, porcentaje_luz, fechaLocal];

    db.run(query, params, function (err) {
        if (err) {
            console.error('Error al insertar en la base de datos:', err.message);
            return res.status(500).json({ error: err.message });
        }

        console.log(`[SQL GUARDADO] ID: ${this.lastID} | Luz: ${porcentaje_luz}% (ADC: ${valor_adc}) | Fecha: ${fechaLocal}`);
        res.status(201).json({
            mensaje: 'Lectura registrada correctamente',
            id_registro: this.lastID
        });
    });
});

// Endpoint GET: Consultar registros en orden descendente
app.get('/api/lecturas', (req, res) => {
    const query = `SELECT * FROM lecturas_luz ORDER BY id DESC`;
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor activo en el puerto ${PORT}`);
});