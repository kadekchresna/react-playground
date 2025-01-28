import Header from "./components/Header.jsx"
import Result from "./components/Result.jsx"
import UserInput from "./components/UserInput.jsx"

import { useState } from "react"

function App() {
  const [investment, setInvestment] = useState({
    initialInvestment: 10000,
    annualInvestment: 300,
    expectedReturn: 5.5,
    duration: 12,
  })

  const isValidInput = investment.duration <= 0

  function handleSetInvestment(keyInvestment, valueInvestment) {
    setInvestment((prevInvestment) => {
      return {
        ...prevInvestment,
        [keyInvestment]: valueInvestment,
      }
    })
  }
  return (
    <>
      <Header />
      <UserInput handleSetInvestment={handleSetInvestment} investment={investment}/>
      {!isValidInput && <Result investmentInput={investment}/>}
      {isValidInput && <p className="center">Invalid input</p>}
    </>

  )
}

export default App
