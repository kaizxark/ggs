import { useEffect } from "react";

export default function SevernaPage({ section = "home" }: { section?: "home" | "about" | "contact" }) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [section]);

  const src = section === "about" ? "/severna/severna-atkris.framer.website/index.html#about" : section === "contact" ? "/severna/severna-atkris.framer.website/index.html#form" : "/severna/severna-atkris.framer.website/index.html";
  return (
    <iframe
      src={src}
      title="Severna"
      onLoad={() => { try { const el = document.querySelector('iframe'); if (el?.contentWindow) el.contentWindow.scrollTo(0,0); } catch{} }}
      className="w-full h-screen border-0"
      style={{ display: "block", zoom: "1.3" }}
    />
  );
}