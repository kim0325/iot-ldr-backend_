const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./monitoreo.db');

const INTERVALO_MINUTOS = 5; 
const DIAS = 7;
const TOTAL_LECTURAS = (DIAS * 24 * 60) / INTERVALO_MINUTOS; // 2,016 muestras

// Fijar la fecha ancla exactamente a las 07:44 AM de hoy (15 de Octubre de 2026)
const fechaAncla = new Date(2026, 9, 15, 8, 49, 54); // 15 de Octubre de 2026, 08:35:00 AM

function formatearFechaLocal(date) {
    const pad = (n) => String(n).padStart(2, '0');
    const YYYY = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const DD = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
}

console.log(`Recreando tabla e inyectando ${TOTAL_LECTURAS} lecturas hasta el punto exacto: ${formatearFechaLocal(fechaAncla)}...`);

db.serialize(() => {
    // 1. Limpiar tabla previa
    db.run(`DROP TABLE IF EXISTS lecturas_luz`);
    
    // 2. Crear tabla desde cero
    db.run(`
        CREATE TABLE lecturas_luz (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dispositivo TEXT,
            valor_adc INTEGER,
            porcentaje_luz REAL,
            fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const stmt = db.prepare(`
        INSERT INTO lecturas_luz (dispositivo, valor_adc, porcentaje_luz, fecha_registro) 
        VALUES (?, ?, ?, ?)
    `);

    for (let i = TOTAL_LECTURAS; i >= 0; i--) {
        const fecha = new Date(fechaAncla.getTime() - (i * INTERVALO_MINUTOS * 60 * 1000));
        const hora = fecha.getHours();
        const minuto = fecha.getMinutes();
        const horaDecimal = hora + (minuto / 60);

        let porcentaje;

        if (horaDecimal >= 6 && horaDecimal < 9) {
            // Mañana: Entrada de luz por ventana + 1 foco encendido
            const luzVentana = (horaDecimal - 6) * 6;
            const unFoco = 48 + (Math.random() * 4 - 2);
            porcentaje = unFoco + luzVentana + (Math.random() * 3 - 1.5);
        } 
        else if (horaDecimal >= 9 && horaDecimal < 18) {
            // Día: Solo luz natural por la ventana
            const cenit = Math.sin(((horaDecimal - 9) / 9) * Math.PI);
            const luzVentanaSol = 32 + (cenit * 24);
            porcentaje = luzVentanaSol + (Math.random() * 4 - 2);
        } 
        else if (horaDecimal >= 18 && horaDecimal < 23) {
            // Noche: 2 focos encendidos
            porcentaje = 84 + (Math.random() * 5 - 2.5);
        } 
        else {
            // Madrugada: Habitación a oscuras
            porcentaje = 4 + (Math.random() * 3);
        }

        porcentaje = Math.min(100, Math.max(0, parseFloat(porcentaje.toFixed(1))));
        const valorAdc = Math.round((porcentaje / 100) * 4095);
        const fechaTexto = formatearFechaLocal(fecha);

        stmt.run(['ESP32_LDR', valorAdc, porcentaje, fechaTexto]);
    }

    stmt.finalize();
    console.log('¡Base de datos recreada e inyectada con exito hasta las 07:44 AM!');
});

db.close();