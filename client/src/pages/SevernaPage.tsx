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

              const replace = () => {
                win.document.querySelectorAll('.framer-text').forEach(el => {
                  const txt = (el as HTMLElement).textContent || "";
                  if (txt.includes("Severna")) (el as HTMLElement).textContent = "Global Kids";
                });
                win.document.querySelectorAll('.framer-1506cxs').forEach(div => {
                  (div as HTMLElement).innerHTML = '<img src="/logo.png" style="width:40px;height:44px;object-fit:contain;display:block;" alt="Global Kids Logo" />';
                });
              };
              replace();
              const obs = new win.MutationObserver(() => replace());
              obs.observe(win.document.body, { childList: true, subtree: true });
              setTimeout(() => obs.disconnect(), 3000);

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
