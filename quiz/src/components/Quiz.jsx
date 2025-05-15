import Q from '../../public/question.js'

export default function quiz() {
    return (
        <>
            {Q.map()}
            <div id="question"> 
                <h2></h2>
            </div>
        </>
    )
}