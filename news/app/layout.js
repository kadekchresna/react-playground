import Link from "next/link";
import "./globals.css";
import Image from "next/image";

export const metadata = {
  title: "Next.js Page Routing & Rendering",
  description: "Learn how to route to different pages.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <header id="main-header">
        <ul>
          <li>{/* <Image src={"/public/icon.jpg"} fill></Image> */}</li>
          <li>
            <Link href={"/"}>Home</Link>
            <Link href={"/news"}>News</Link>
          </li>
        </ul>
      </header>
      <body>{children}</body>
    </html>
  );
}
