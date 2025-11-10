// Carga las variables de entorno del archivo .env
require('dotenv').config();

// Importa Express y CORS
const express = require('express');
const cors = require('cors');
// Importa la configuración de la base de datos
const { sql, connectDB } = require('./config/db'); // Aquí importamos db.js

// Crea una instancia de la aplicación Express
const app = express();

// Middleware: Permite a Express parsear JSON en las peticiones
app.use(express.json());

// Middleware: Habilita CORS
app.use(cors({
    origin: 'http://localhost:3000' // Asegúrate que esta es la URL de tu frontend React
}));

// --- Conectar a la base de datos al iniciar el servidor ---
let dbPool; // Variable para almacenar el pool de conexión
connectDB()
    .then(pool => {
        dbPool = pool; // Asigna el pool de conexión globalmente una vez que se conecta
        console.log('Backend conectado a SQL Server y listo para recibir peticiones.');
    })
    .catch(err => {
        console.error('Fallo al iniciar el servidor debido a un error de conexión a la DB:', err);
        process.exit(1); // Salir si no se puede conectar a la DB
    });

// --- RUTAS DE LA API PARA TAREAS ---

// 1. GET /api/tasks - Obtener todas las tareas
app.get('/api/tasks', async (req, res) => {
    try {
        // Ejecuta una consulta SQL para seleccionar todas las tareas
        const result = await dbPool.request().query('SELECT id, title, description, completed FROM Tareas ORDER BY createdAt DESC');
        
        // Mapeamos los resultados para asegurar que `completed` sea booleano para el frontend
        const tasks = result.recordset.map(task => ({
            ...task,
            completed: task.completed === true || task.completed === 1 // Maneja BIT (1/0) o boolean directamente
        }));
        res.json(tasks);
    } catch (err) {
        console.error('Error al obtener tareas:', err);
        res.status(500).json({ message: 'Error interno del servidor al obtener tareas.' });
    }
});

// 2. POST /api/tasks - Crear una nueva tarea
app.post('/api/tasks', async (req, res) => {
    const { title, description } = req.body;
    if (!title) {
        return res.status(400).json({ message: 'El título de la tarea es obligatorio.' });
    }

    try {
        // Usamos una Prepared Statement para prevenir inyección SQL
        // OUTPUT INSERTED.* devuelve la fila recién insertada, incluyendo el ID autogenerado
        const result = await dbPool.request()
            .input('title', sql.NVarChar, title)
            .input('description', sql.NVarChar, description || null) // Permite descripción nula
            .query('INSERT INTO Tareas (title, description) OUTPUT INSERTED.id, INSERTED.title, INSERTED.description, INSERTED.completed VALUES (@title, @description)');
        
        const newTask = result.recordset[0];
        // Convertimos el campo 'completed' a booleano antes de enviarlo al frontend
        newTask.completed = newTask.completed === true || newTask.completed === 1; 
        res.status(201).json(newTask);
    } catch (err) {
        console.error('Error al crear tarea:', err);
        res.status(500).json({ message: 'Error interno del servidor al crear tarea.' });
    }
});

// 3. PUT /api/tasks/:id - Actualizar una tarea existente
app.put('/api/tasks/:id', async (req, res) => {
    const { id } = req.params; // El ID viene de la URL
    const { title, description, completed } = req.body; // Los datos a actualizar vienen del cuerpo de la petición

    try {
        const request = dbPool.request()
            .input('id', sql.Int, id); // Input para el ID de la tarea

        let updateFields = []; // Array para construir dinámicamente la consulta de actualización
        if (title !== undefined) {
            updateFields.push('title = @title');
            request.input('title', sql.NVarChar, title);
        }
        if (description !== undefined) {
            updateFields.push('description = @description');
            request.input('description', sql.NVarChar, description);
        }
        if (completed !== undefined) {
            updateFields.push('completed = @completed');
            request.input('completed', sql.Bit, completed ? 1 : 0); // Convierte booleano a BIT (1 o 0)
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'No se proporcionaron campos para actualizar.' });
        }

        // Construye la consulta UPDATE con OUTPUT para obtener la tarea actualizada
        const query = `UPDATE Tareas SET ${updateFields.join(', ')} OUTPUT INSERTED.id, INSERTED.title, INSERTED.description, INSERTED.completed WHERE id = @id;`;
        const result = await request.query(query);

        if (result.rowsAffected[0] === 0) { // Si no se afectaron filas, la tarea no fue encontrada
            return res.status(404).json({ message: 'Tarea no encontrada.' });
        }
        
        const updatedTask = result.recordset[0];
        // Convierte el campo 'completed' a booleano antes de enviarlo
        updatedTask.completed = updatedTask.completed === true || updatedTask.completed === 1; 
        res.json(updatedTask); // Envía la tarea actualizada
    } catch (err) {
        console.error(`Error al actualizar tarea con ID ${id}:`, err);
        res.status(500).json({ message: 'Error interno del servidor al actualizar tarea.' });
    }
});

// 4. DELETE /api/tasks/:id - Eliminar una tarea
app.delete('/api/tasks/:id', async (req, res) => {
    const { id } = req.params; // El ID de la tarea a eliminar

    try {
        // Ejecuta la consulta DELETE
        const result = await dbPool.request()
            .input('id', sql.Int, id) // Input para el ID
            .query('DELETE FROM Tareas WHERE id = @id');

        if (result.rowsAffected[0] === 0) { // Si no se afectaron filas, la tarea no fue encontrada
            return res.status(404).json({ message: 'Tarea no encontrada.' });
        }
        res.status(204).send(); // 204 No Content: éxito sin cuerpo de respuesta
    } catch (err) {
        console.error(`Error al eliminar tarea con ID ${id}:`, err);
        res.status(500).json({ message: 'Error interno del servidor al eliminar tarea.' });
    }
});

// Ruta de prueba inicial (mantenemos)
app.get('/', (req, res) => {
    res.send('¡Bienvenido al Backend de tu Gestor de Tareas (conectado a DB)!');
});

// Define el puerto donde correrá el servidor
const PORT = process.env.PORT || 5000;

// Inicia el servidor Express
// Es crucial que el servidor Express solo se inicie DESPUÉS de que la conexión a la DB se haya establecido con éxito.
app.listen(PORT, () => {
    console.log(`Servidor de Backend corriendo en el puerto ${PORT}`);
    console.log(`Puedes probarlo en: http://localhost:${PORT}`);
    console.log(`API de Tareas disponible en: http://localhost:${PORT}/api/tasks`);
});