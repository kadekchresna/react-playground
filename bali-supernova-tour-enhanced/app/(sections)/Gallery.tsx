import Lightbox from "../(components)/Lightbox";
import data from "../(data)/destinations.json";

export default function Gallery() {
  const images = data.map((d) => d.image);
  return (
    <section className="section" id="gallery">
      <div className="container">
        <h2 className="h2">Gallery</h2>
        <p className="muted mt-2">A glimpse of the places you’ll experience.</p>
        <div className="mt-6">
          <Lightbox images={images} />
        </div>
      </div>
    </section>
  );
}
