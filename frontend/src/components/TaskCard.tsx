function TaskCard({ task }) {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "in progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "done":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-amber-100 text-amber-800 border-amber-200";
    }
  };

  return (
    <div className="bg-sky-100 rounded-xl shadow-sm border-2 border-sky-200 p-5   transition-all duration-200 flex flex-col justify-between h-full">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2 leading-snug">
          {task.title}
        </h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {task.description}
        </p>
        <p className="text-gray-400 text-sm mb-4 line-clamp-3">
          ID: {task._id}
        </p>
      </div>
      <div className="flex justify-between items-center mt-4 pt-4 ">
        <span
          className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(
            task.status
          )}`}
        >
          {task.status || "Pending"}
        </span>
      </div>
    </div>
  );
}

export default TaskCard;
