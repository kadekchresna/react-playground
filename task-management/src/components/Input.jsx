
import {forwardRef} from 'react'

const input = forwardRef(function Input({ label, textarea, ...props }, ref) {

    
    var className="w-full p-1 border-b-2 rounded-sm border-stone-200 bg-stone-300 focus:outline-none focus:border-stone-600"
    return (
        <p className="flex flex-col gap-1 my-4">
            <label className="text-sm font-bold uppercase text-stone-500">{label}</label>
            {textarea ? 
                <textarea ref={ref} className={className} {...props}></textarea> : 
                <input ref={ref} className={className} {...props}></input>}
        </p>
    )
})

export default input;