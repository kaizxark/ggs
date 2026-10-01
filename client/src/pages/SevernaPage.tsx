import { useEffect, useState, useRef } from "react";

export default function SevernaPage({ section = "home" }: { section?: "home" | "about" | "contact" }) {
  const [html, setHtml] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/severna.html")
      .then(res => res.text())
      .then(data => {
        setHtml(data);
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (loaded && contentRef.current) {
      // Find the target section in the loaded HTML
      const targetId = section === "about" ? "about" : section === "contact" ? "form" : "home";
      const targetElement = contentRef.current.querySelector(`#${targetId}, [data-section="${targetId}"]`);
      
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [loaded, section]);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#2a5a52] font-medium">Loading...</div>
      </div>
    );
  }

  return (
    <div ref={contentRef} dangerouslySetInnerHTML={{ __html: html }} className="severna-page" />
  );
}