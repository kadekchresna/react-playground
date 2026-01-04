import tours from './(data)/tours.json'
export default function sitemap() {
  const base = 'https://balinova.example.com'
  const pages = ['', '/contact', '/privacy-policy', '/terms']
  const items = [
    ...pages.map(p=> ({ url: base + p })),
    ...tours.map(t => ({ url: `${base}/tours/${t.slug}` })),
  ]
  return items
}
