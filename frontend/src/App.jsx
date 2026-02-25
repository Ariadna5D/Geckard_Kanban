import { useEffect, useState } from 'react'; 
import './App.css'

function App() {
  // 1. Ahora el estado es una lista (array) de tareas
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 2. Llamamos a la ruta GET que el CLI creó por defecto: /api/tasks
    fetch('/api/tasks')
      .then((response) => response.json()) // Convertimos la respuesta a JSON
      .then((data) => {
        setTasks(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="App">
      <h1>Mi Kanban TFG</h1>
      
      {loading ? (
        <p>Cargando tareas...</p>
      ) : (
        <div className="task-list">
          {tasks.length === 0 ? (
            <p>No hay tareas todavía. ¡Crea una desde Postman!</p>
          ) : (
            tasks.map((task) => (
              <div key={task._id} className="task-card">
                <h3>{task.title}</h3>
                <p>{task.description}</p>
                <span className="status-tag">{task.status}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default App;