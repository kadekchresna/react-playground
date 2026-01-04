export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: 'https://balinova.example.com/sitemap.xml',
  }
}
