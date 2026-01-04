'use client'
import { useEffect, useState } from 'react'
export default function ThemeToggle(){
  const [dark, setDark] = useState(false)
  useEffect(()=>{ document.documentElement.classList.toggle('dark', dark) },[dark])
  return <button onClick={()=>setDark(v=>!v)} className="btn btn-outline text-sm">{dark?'Light':'Dark'} Mode</button>
}
