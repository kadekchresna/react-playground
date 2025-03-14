import { forwardRef } from "react"

import NewTask from './NewTask.jsx'

const Tasks = forwardRef(function Tasks({tasks, onDelete, onAdd}, ref) {
    return (
        <div>
            <h1 className="text-2xl font-bold text-stone-700 mb-4">Tasks</h1>
            <NewTask onDelete={onDelete} onAdd={onAdd}></NewTask>
            {tasks.length === 0 && <p className="text-stone-800 my-4">
                This Project doesn't have any tasks yet.
            </p>}
            {tasks.length > 0 && <ul className="p-4 mt-8 rounded-md bg-stone-100">
                    {
                        tasks.map(task => {
                            return (
                                <li key={task.id} className="flex justify-between my-4">
                                    <span>{task.text}</span>
                                    <button className="text-stone-700 hover:text-red-500" onClick={() => onDelete(task.id)}>Clear</button>
                                </li>
                            )
                        })
                    }
                </ul>}
        </div>
    )
})

export default Tasks