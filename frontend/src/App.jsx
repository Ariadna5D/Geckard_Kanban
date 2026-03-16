import { useEffect, useState } from 'react';
import './App.css';
import TaskCard from './components/TaskCard'; 

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tasks')
      .then((response) => response.json())
      .then((data) => {
        setTasks(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen  p-8 font-sans ">
      
      <h1 className="text-6xl font-bold text-sky-500 mb-8 text-center tracking-tight">Kanban TFG</h1>
      
      {loading ? (
        <p className="text-center text-gray-500 animate-pulse">Cargando tareas...</p>
      ) : (
        <div className="flex flex-wrap justify-center gap-6 w-full">
          {tasks.length === 0 ? (
            <p className="text-center text-gray-500 col-span-full">No hay tareas todavía</p>
          ) : (
            tasks.map((task) => (
              <TaskCard key={task._id} task={task} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default App;