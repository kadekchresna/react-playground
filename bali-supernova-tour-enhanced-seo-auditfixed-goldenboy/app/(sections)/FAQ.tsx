import Accordion from '../(components)/Accordion'
import faqs from '../(data)/faqs.json'
export default function FAQ(){
  return (
    <section className="section" id="faq">
      <div className="container">
        <h2 className="h2">Frequently Asked Questions</h2>
        <div className="mt-6">
          <Accordion items={faqs}/>
        </div>
      </div>
    </section>
  )
}
