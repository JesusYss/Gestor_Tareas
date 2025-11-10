const sql = require('mssql');
require('dotenv').config();

const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
        trustedConnection: true // ¡Esta línea es CRUCIAL para la Autenticación de Windows!
    }
};

async function connectDB() {
    try {
        await sql.close(); 
        const pool = new sql.ConnectionPool(config);
        await pool.connect();
        console.log('Conectado a SQL Server');
        return pool;
    } catch (err) {
        console.error('Error al conectar a SQL Server:', err);
        process.exit(1);
    }
}

module.exports = {
    sql,
    connectDB
};