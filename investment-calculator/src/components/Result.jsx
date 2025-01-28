import { calculateInvestmentResults, formatter } from "../util/investment";

export default function Result({ investmentInput }) {
    const res = calculateInvestmentResults(investmentInput)
    return (
        <table id="result">
            <thead>
                <tr>
                    <th>Year</th>
                    <th>Initial Investment</th>
                    <th>Annual Investment</th>
                    <th>Interest</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                {res.map((result) => {
                    return (
                        <tr id={result.year} key={result.year}>
                            <td>{result.year}</td>
                            <td>{formatter.format(res[0].valueEndOfYear - (res[0].annualInvestment + res[0].interest))}</td>
                            <td>{formatter.format(result.annualInvestment)}</td>
                            <td>{formatter.format(result.interest)}</td>
                            <td>{formatter.format(result.valueEndOfYear)}</td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}