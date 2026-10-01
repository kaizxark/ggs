export default function SevernaPage({ section = "home" }: { section?: "home" | "about" | "contact" }) {
  const src = section === "about" ? "/severna/severna-atkris.framer.website/index.html#about" : section === "contact" ? "/severna/severna-atkris.framer.website/index.html#form" : "/severna/severna-atkris.framer.website/index.html";
  return (
    <div style={{ width: "100%", height: "100vh", overflow: "hidden" }}>
      <iframe
        src={src}
        title="Severna"
        style={{ width: "130%", height: "130vh", border: "none", transform: "scale(1.3)", transformOrigin: "top left" }}
      />
    </div>
  );
}