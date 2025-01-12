import { useState } from "react"

import Player from "./components/player"
import GameBoard from "./components/GameBoard"
import Log from "./components/Log"
import GameOver from "./components/GameOver"
import {WINNING_COMBINATIONS} from "./components/winning-combinations"

const INITIAL_BOARD = [
  [null, null, null],
  [null, null, null],
  [null, null, null],
]

function deriveActivePlayer(gameBoard) {
  let currentPlayer = "X"
  if (gameBoard.length > 0 && gameBoard[0].player === "X") {
    currentPlayer = 'O'
  }

  return currentPlayer
}


function App() {
  const [playerName, setPlayerName] = useState({"X": "Player 1", "O":"Player 2"})
  const [gameBoard, setGameboard] = useState([])
  let activePlayer = deriveActivePlayer(gameBoard)

  let board = [...INITIAL_BOARD.map((inner) => [...inner])]

  for (const turn of gameBoard) {
      const {position, player} = turn
      const {row, col} = position

      board[row][col] = player
  }

  let winner
  for (const combination of WINNING_COMBINATIONS) {
    let firstCombination = board[combination[0].row][combination[0].column]
    let secondCombination = board[combination[1].row][combination[1].column]
    let thirdCombination = board[combination[2].row][combination[2].column]

    if (firstCombination &&  firstCombination === secondCombination && firstCombination===thirdCombination) {
      winner = playerName[firstCombination]
      break
    }
  }

  function handleSetGameboard(rowIndex, colIndex) {
    setGameboard((oldBoard) => {

      const currentPlayer = deriveActivePlayer(gameBoard)

        const newBoard = [{position: {row: rowIndex, col: colIndex}, player: currentPlayer}, ...oldBoard]
        return newBoard
    })
  }

  const hasDraw = gameBoard.length === 9 && !winner


  function handleRematch() {
    setGameboard([])
  }

  function handleSetPlayerName(symbol, name) {
    setPlayerName((player) => {
      return {
        ...player,
        [symbol]: name
      }
    })
  }

   return (
    <main>
      <div id="game-container">
        <ol id="players" className="highlight-player">
          <Player initialName="Player 1" symbol="X" isActive={activePlayer === "X"} handleSetPlayerName={handleSetPlayerName}/>
          <Player initialName="Player 2" symbol="O" isActive={activePlayer === "O"} handleSetPlayerName={handleSetPlayerName}/>
        </ol>
        {(winner || hasDraw) && <GameOver winner={winner} handleRematch={handleRematch}/>}
        <GameBoard gameBoard={board} handleSetGameboard={handleSetGameboard}/>
      </div>
      <Log gameBoard={gameBoard}/>
    </main>
  )
}

export default App
