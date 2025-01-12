

const INITIAL_BOARD = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
]

export default function GameBoard({gameBoard, handleSetGameboard}) {

    // const [gameBoard, setGameboard] = useState(INITIAL_BOARD)

    // function handlePlayerSymbol(rowIndex, colIndex) {
    //     setGameboard((oldBoard) => {

    //         const newBoard = [...oldBoard.map(innerArray => [...innerArray])]
    //         newBoard[rowIndex][colIndex] = playerSymbol
    //         return newBoard
    //     })

    //     handleSetActivePlayer()
    // }



    return (
        <ol id="game-board">
            {gameBoard.map((row, rowIndex) => {
                return (<li key={rowIndex}>
                    <ol>    
                        {row.map((symbol, colIndex) => {
                            return (<li key={colIndex}>
                                <button onClick={() => handleSetGameboard(rowIndex, colIndex)} disabled={symbol != null}>{symbol}</button>
                            </li>)
                        })}      
                    </ol>
                </li>)
            })}
        </ol>
    );
}