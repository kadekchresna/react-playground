import Button from "./Button";

export default function ProjectSidebar({onStartAddProject, projects, onSelect, selectedID}) {
    return (
        <aside className="w-1/3 px-8 py-16 bg-stone-900 text-stone-50 md:w-72 rounded-r-xl">
            <h2 className="mb-8 font-bold uppercase md:text-xl text-stone-200">Your Project</h2>
            <div>
                <Button className="px-4 py-2 text-xs md:text-base rounded-md bg-stone-700 text-stone-400 hover:bg-stone-500 hover:text-stone-100" onClick={onStartAddProject}>+ Add Project</Button>
            </div>
            <ul className="mt-8">
                {projects.map(p => {

                    let cssClass = "w-full text-left px-2 py-1 my-1 rounded-sm hover:text-stone-200"

                    if (p.id === selectedID) {
                        cssClass += ' bg-stone-800 text-stone-200'
                    } else {
                        cssClass += ' text-stone-400'
                    }


                    return (
                        <li key={p.id}>
                            <button className={cssClass} onClick={() => onSelect(p.id)}>{p.title}</button>
                        </li>
                    )
                })}
            </ul>
        </aside>
    )
}