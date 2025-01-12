import {useState} from "react";


export default function Player({initialName, symbol, isActive, handleSetPlayerName}){
  const [isEditing, setIsEditing] = useState(false);  
  const [playerName, setPlayerName] = useState({name: initialName, gender: "male"});  

  function handleEditClick() {
    setIsEditing(editing => !editing)

    if (isEditing) {
      handleSetPlayerName(symbol, playerName.name)
    }
  }

  function handleChangeName(e) {
    setPlayerName((name) => {
      return {...name, name: e.target.value}
    })
  }

  let playerNameTag = <span className="player-name">{playerName.name}</span>
  if (isEditing) {
    playerNameTag = <input type="text" value={playerName.name} onChange={handleChangeName} required/>
  }
  
    return (
        <li className={ isActive ? "active" : undefined}>
        <span className="player">
            {playerNameTag}
          <span className="player-symbol">{symbol}</span>
        </span>
        <button onClick={handleEditClick}>{!isEditing ? "Edit" : "Save"}</button>
      </li>
    )
}