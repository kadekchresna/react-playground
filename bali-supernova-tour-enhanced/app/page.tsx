import Hero from './(sections)/Hero'
import About from './(sections)/About'
import Destinations from './(sections)/Destinations'
import Tours from './(sections)/Tours'
import Gallery from './(sections)/Gallery'
import Testimonials from './(sections)/Testimonials'
import CTA from './(sections)/CTA'
import FAQ from './(sections)/FAQ'
import Contact from './(sections)/Contact'

export default function HomePage(){
  return (
    <main>
      <Hero/>
      <About/>
      <Destinations/>
      <Tours/>
      <Gallery/>
      <Testimonials/>
      <CTA/>
      <FAQ/>
      <Contact/>
    </main>
  )
}
