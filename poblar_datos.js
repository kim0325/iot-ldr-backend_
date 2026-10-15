const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./monitoreo.db');

const INTERVALO_MINUTOS = 5; 
const DIAS = 7;
const TOTAL_LECTURAS = (DIAS * 24 * 60) / INTERVALO_MINUTOS; // 2,016 registros

console.log(`Generando ${TOTAL_LECTURAS} lecturas para los últimos ${DIAS} días...`);

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS lecturas_luz (
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

    const ahora = new Date();

    for (let i = TOTAL_LECTURAS; i >= 0; i--) {
        const fecha = new Date(ahora.getTime() - (i * INTERVALO_MINUTOS * 60 * 1000));
        const hora = fecha.getHours();
        const minuto = fecha.getMinutes();
        const horaDecimal = hora + (minuto / 60);

        let porcentaje;

        if (horaDecimal >= 6 && horaDecimal < 9) {
            // Mañana: Ventana + 1 foco encendido
            const luzVentana = (horaDecimal - 6) * 6;
            const unFoco = 48 + (Math.random() * 4 - 2);
            porcentaje = unFoco + luzVentana + (Math.random() * 3 - 1.5);
        } 
        else if (horaDecimal >= 9 && horaDecimal < 18) {
            // Día: Focos apagados, solo luz natural por ventana
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
        const fechaFormateada = fecha.toISOString().replace('T', ' ').substring(0, 19);

        stmt.run(['ESP32_LDR', valorAdc, porcentaje, fechaFormateada]);
    }

    stmt.finalize();
    console.log('¡Inyección completada exitosamente!');
});

db.close();