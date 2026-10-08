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

// 1. Inicializar la base de datos SQL
const db = new sqlite3.Database('./monitoreo.db', (err) => {
    if (err) {
        console.error('Error al conectar con SQLite:', err.message);
    } else {
        console.log('Base de datos SQL conectada exitosamente.');
    }
});

// 2. Crear tabla si no existe
db.run(`
    CREATE TABLE IF NOT EXISTS lecturas_luz (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dispositivo TEXT,
        valor_adc INTEGER,
        porcentaje_luz REAL,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// 3. Endpoint POST: Recibe datos del ESP32
app.post('/api/lecturas', (req, res) => {
    const { dispositivo, valor_adc, porcentaje_luz } = req.body;

    if (valor_adc === undefined || porcentaje_luz === undefined) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const query = `INSERT INTO lecturas_luz (dispositivo, valor_adc, porcentaje_luz) VALUES (?, ?, ?)`;
    const params = [dispositivo || 'ESP32_LDR', valor_adc, porcentaje_luz];

    db.run(query, params, function (err) {
        if (err) {
            console.error('Error al insertar en la base de datos:', err.message);
            return res.status(500).json({ error: err.message });
        }

        console.log(`[SQL GUARDADO] ID: ${this.lastID} | Luz: ${porcentaje_luz}% (ADC: ${valor_adc})`);
        res.status(201).json({
            mensaje: 'Lectura registrada correctamente',
            id_registro: this.lastID
        });
    });
});

// 4. Endpoint GET: Consultar lecturas
app.get('/api/lecturas', (req, res) => {
    const query = `SELECT * FROM lecturas_luz ORDER BY id DESC LIMIT 50`;
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Node.js activo en el puerto ${PORT}`);
    console.log(`Panel visual disponible en: http://localhost:${PORT}`);
});