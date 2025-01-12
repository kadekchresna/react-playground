export default function Log({ gameBoard }) {
    return (
        <ol id="log">
            {
                gameBoard.map((turn) => <li key={`${turn.position.row}${turn.position.col}`}>{turn.player} selected {turn.position.row},{turn.position.col}</li>)
            }
        </ol>   
        
    )
}