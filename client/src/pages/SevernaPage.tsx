import { useEffect } from "react";

export default function SevernaPage({ section = "home" }: { section?: "home" | "about" | "contact" }) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [section]);

  const src = section === "about" ? "/severna/severna-atkris.framer.website/index.html#about" : section === "contact" ? "/severna/severna-atkris.framer.website/index.html#form" : "/severna/severna-atkris.framer.website/index.html";
  return (
    <div style={{ height: "130vh", overflowY: "auto", position: "relative", background: "#fff" }}>
      <iframe
        src={src}
        title="Severna"
        onLoad={() => {
          try {
            const win = (document.querySelector('iframe') as HTMLIFrameElement)?.contentWindow;
            if (win?.document) {
              const styleEl = win.document.createElement('style');
              styleEl.textContent = 'a[href*="framer.com"], a[href*="framer"][href]:not([href="/"]):not([href*="#"]) { display: none !important; }';
              win.document.head.appendChild(styleEl);

              const replaceText = () => {
                win.document.querySelectorAll('.framer-text').forEach(el => {
                  if ((el as HTMLElement).textContent?.includes("Severna")) {
                    (el as HTMLElement).textContent = "Global Kids";
                  }
                });
              };
              replaceText();
              const obs = new win.MutationObserver(replaceText);
              obs.observe(win.document.body, { childList: true, subtree: true });
              setTimeout(() => obs.disconnect(), 2000);

              // Only replace first SVG logo container once
              setTimeout(() => {
                const logoDiv = win.document.querySelector('.framer-1506cxs');
                if (logoDiv) {
                  (logoDiv as HTMLElement).innerHTML = '<img src="/logo.png" style="width:40px;height:44px;object-fit:contain;display:block;" alt="Global Kids Logo" />';
                }
              }, 500);

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
