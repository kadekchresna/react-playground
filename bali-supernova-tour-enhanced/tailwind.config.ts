import type { Config } from 'tailwindcss'
const config: Config = {
  darkMode: 'class',
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:"#ECFDFB",100:"#CFF7F3",200:"#A5F0E8",300:"#74E3D8",400:"#42D3C8",
          500:"#12B8B0",600:"#0EA5A0",700:"#0B827E",800:"#0A6462",900:"#0A4A49",
          DEFAULT:"#12B8B0"
        },
        sand: {
          50:"#F9F5EE",100:"#F3EAD8",200:"#EAD9C3",300:"#DFC9AF",400:"#D1B796",
          500:"#BFA07D",600:"#9E8365",700:"#7F6951",800:"#675544",900:"#4E4034"
        },
        coral: {
          50:"#FFF1EE",100:"#FFDAD4",200:"#FFB7A9",300:"#FF927E",400:"#F97C68",
          500:"#F26D5B",600:"#E25946",700:"#C74635",800:"#A63628",900:"#7C261C"
        },
        saffron: {
          50:"#FFF8E8",100:"#FFEFC2",200:"#FFE191",300:"#FFD061",400:"#FFC23E",
          500:"#F4A261",600:"#DF8B44",700:"#B76E33",800:"#915526",900:"#6E3E1B"
        },
        sage: {
          50:"#F2F8F2",100:"#E2F0E3",200:"#C5E2C7",300:"#A3D2A7",400:"#84C58B",
          500:"#6CB975",600:"#5CA164",700:"#4C8453",800:"#3E6943",900:"#2E4D31"
        },
        coconut: { 50:"#F7FAFB", 100:"#F3F6F7" },
        lava: { 900:"#111827", 700:"#374151", 600:"#4B5563" }
      },
      boxShadow: { card: '0 10px 30px rgba(0,0,0,0.06)' }
    },
  },
  plugins: [],
}
export default config
