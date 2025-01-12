function GameOver({winner, handleRematch}) {
    return ( 
        <div id="game-over">
            <h2>Game Over!</h2>
            {winner && <p>{winner} won!</p>}
            {!winner && <p>It's a draw!</p>}
            <button onClick={handleRematch}>Remmatch</button>
        </div>
     );
}

export default GameOver;