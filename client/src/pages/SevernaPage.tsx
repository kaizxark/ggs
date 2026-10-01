import { useEffect } from "react";

export default function SevernaPage({ section = "home" }: { section?: "home" | "about" | "contact" }) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [section]);

  const src = section === "about" ? "/severna/severna-atkris.framer.website/index.html#about" : section === "contact" ? "/severna/severna-atkris.framer.website/index.html#form" : "/severna/severna-atkris.framer.website/index.html";
  return (
    <div style={{ height: "100vh", overflowY: "auto", background: "#fff" }}>
      <iframe
        src={src}
        title="Severna"
        onLoad={() => {
          try {
            const win = (document.querySelector('iframe') as HTMLIFrameElement)?.contentWindow;
            if (win?.document) {
              const s = win.document.createElement('style');
              s.textContent = '[data-framer-name="footer"] a[href*="framer"], a[href*="framer.com"], .framer-footer, .framer-6CtRv a[href*="framer"], div:has(> a[href*="framer"]), [data-framer-component-type="Link"] a[href*="framer.com"] { display: none !important; }';
              win.document.head.appendChild(s);

              // Replace logo text with Global Kids
              const logoTexts = win.document.querySelectorAll('[data-framer-name="Severna"]');
              logoTexts.forEach(el => { (el as HTMLElement).textContent = "Global Kids"; });
              const subTexts = win.document.querySelectorAll('.framer-x6usmw');
              subTexts.forEach(el => { (el as HTMLElement).textContent = "PRIVATE SCHOOL"; });

              // Replace logo image with logo.png
              const logoImgs = win.document.querySelectorAll('[data-framer-component-type="SVG"][data-framer-name="Vector"]');
              logoImgs.forEach((img) => {
                const container = img.closest('.framer-1506cxs') || img.parentElement;
                if (container) {
                  container.innerHTML = '<img src="/logo.png" style="width:40px;height:44px;object-fit:contain;" alt="Global Kids Logo" />';
                }
              });

              win.scrollTo(0, 0);
            }
          } catch {}
        }}
        style={{
          width: "100%",
          height: "130vh",
          border: "none",
          display: "block",
          zoom: "1.3"
        }}
      />
    </div>
  );
}
