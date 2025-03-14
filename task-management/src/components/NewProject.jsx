import { useRef } from 'react'
import Input from './Input.jsx'
import Modal from './Modal.jsx'

export default function NewProject({onAdd, onCancel}) {

    const modal = useRef()

    const title = useRef()
    const description = useRef()
    const duedate = useRef()

    function handleSave() {
        const inputedTitle = title.current.value
        const inputedDesc = description.current.value
        const inputedDueDate = duedate.current.value

        // validation
        if (inputedTitle.trim() === '' || inputedDesc.trim() === '' || inputedDueDate.trim() === '') {
            modal.current.open()
            return
        }


        onAdd({
            title: inputedTitle,
            description: inputedDesc,
            dueDate: inputedDueDate,
        })
        
    }

    return (
        <>
            <Modal ref={modal} buttonCaption={"Close"}>
                <h2 className='text-xl font-bold text-stone-500 my-4'>Invalid input</h2>
                <p className='text-stone-400 mb-4'>Fix your god damn input bish!</p>
            </Modal>
            <div className='w-[35rem] mt-16'>
                <menu className='flex items-center justify-end gap-4 my-4'>
                    <li><button 
                        className='text-stone-400 hover:text-stone-950'
                        onClick={onCancel}
                        >Cancel</button></li>
                    <li><button 
                        className='px-6 py-2 rounded-md bg-stone-500 text-stone-50 hover:bg-stone-950'
                        onClick={handleSave}
                        >Save</button></li>
                </menu>
                <div>
                    <Input ref={title} label="Title"></Input>
                    <Input ref={description} label="Description" textarea={true}></Input>
                    <Input ref={duedate} type='date' label="DueDate"></Input>
                </div>
            </div>
        </>
    )
}