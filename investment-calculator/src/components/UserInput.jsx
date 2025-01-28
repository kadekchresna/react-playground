
export default function UserInput({handleSetInvestment, investment}) {
    return (
        <section id='user-input'>
            <div className="input-group">
                <p>
                    <label >Initial Investment</label>
                    <input type='number' value={investment.initialInvestment} onChange={(event) => handleSetInvestment("initialInvestment", +event.target.value)} required />
                </p>
                <p>
                    <label >Annual Investment</label>
                    <input type='number' value={investment.annualInvestment} onChange={(event) => handleSetInvestment("annualInvestment", +event.target.value)}  required />
                </p>
            </div>
            <div className="input-group">
                <p>
                    <label >Expected Return</label>
                    <input type='number' value={investment.expectedReturn} onChange={(event) => handleSetInvestment("expectedReturn", +event.target.value)} required />
                </p>
                <p>
                    <label >Duration</label>
                    <input type='number' value={investment.duration} onChange={(event) => handleSetInvestment("duration", +event.target.value)} required />
                </p>
            </div>
        </section>
    )
}