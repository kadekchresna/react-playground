'use client'
import { useState } from 'react'
export default function Accordion({items}:{items:{q:string,a:string}[]}){
  return <div className="divide-y rounded-2xl border bg-[color:var(--bg-surface)]">{items.map((it,i)=>(<Item key={i} q={it.q} a={it.a}/>))}</div>
}
function Item({q,a}:{q:string,a:string}){
  const [open,setOpen]=useState(false)
  return (
    <details className="group p-5" open={open} onToggle={(e)=>setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer list-none flex items-center justify-between">
        <span className="font-medium">{q}</span>
        <span className="ml-4 text-brand-600">{open?'–':'+'}</span>
      </summary>
      <div className="mt-3 text-sm text-[color:var(--text-muted)]">{a}</div>
    </details>
  )
}
