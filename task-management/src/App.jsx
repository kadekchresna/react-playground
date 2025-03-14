
import { useState } from 'react';

import ProjectSidebar from './components/ProjectSidebar.jsx'
import NewProject from './components/NewProject.jsx';
import NoProjectSelected from './components/NoProjectSelected.jsx';
import SelectedProject from './components/SelectedProject.jsx';

function App() {
  const [projectState, setProjectState] = useState({
    selectedProjectID: undefined,
    projects: [],
    tasks: []
  })

  function handleAddTask(text) {
    setProjectState(prevState => {
      const taskID = Math.random()

      const newTask = {
        text: text,
        projectID: projectState.selectedProjectID,
        id: taskID
      }
      return {
        ...prevState,
        tasks: [
          newTask,
          ...prevState.tasks,
        ]
      }
    })
  }

  function handleDeleteTask(id) {
    setProjectState(prevState => {
      return {
        ...prevState,
        tasks: prevState.tasks.filter(task => task.id !== id),
      }
    })
  }

  function handleStartProject() {
    setProjectState(prevState => {
      return {
        ...prevState,
        selectedProjectID: null,
      }
    })
  }

  function handleNewProject(projectData) {
    const projectID = Math.random()
    const newProject = {
      ...projectData,
      id: projectID
    }
    setProjectState(prevState => {
      return {
        ...prevState,
        selectedProjectID: undefined,
        // selectedProjectID: projectID,
        projects: [
          ...projectState.projects, 
          newProject
        ]
      }
    })
  }


  function handleOnSelectProject(id) {
    setProjectState(prevState => {
      return {
        ...prevState,
        selectedProjectID: id,
      }
    })
  }


  function handleOnCancel() {
    setProjectState(prevState => {
      return {
        ...prevState,
        selectedProjectID: undefined,
      }
    })
  }

  function handleOnDelete() {
    setProjectState(prevState => {
      return {
        ...prevState,
        selectedProjectID: undefined,
        projects: prevState.projects.filter(project => project.id !== prevState.selectedProjectID )
      }
    })
    
  }

  let selectedProject = projectState.projects.find(project => project.id === projectState.selectedProjectID)

  

  let content = <SelectedProject project={selectedProject} onDelete={handleOnDelete} onDeleteTask={handleDeleteTask} onAddTask={handleAddTask} tasks={projectState.tasks}></SelectedProject>;
  if (projectState.selectedProjectID === null) {
    content = <NewProject onStartAddProject={handleStartProject} onAdd={handleNewProject} onCancel={handleOnCancel}></NewProject>
  } else if (projectState.selectedProjectID === undefined) {
    content = <NoProjectSelected onStartAddProject={handleStartProject}></NoProjectSelected>
  }

  return (
    <main className='h-screen my-8 flex flex-row gap-8'>
      <ProjectSidebar onStartAddProject={handleStartProject} projects={projectState.projects} onSelect={handleOnSelectProject} selectedID={projectState.selectedProjectID}></ProjectSidebar>
      {content}
    </main>
  );
}

export default App;
