export default function SevernaPage({ section = "home" }: { section?: "home" | "about" | "contact" }) {
  const src = section === "about" ? "/severna/severna-atkris.framer.website/index.html#about" : section === "contact" ? "/severna/severna-atkris.framer.website/index.html#form" : "/severna/severna-atkris.framer.website/index.html";
  return (
    <div style={{ width: "100%", height: "100vh", overflow: "hidden", position: "relative" }}>
      <iframe
        src={src}
        title="Severna"
        style={{ position: "absolute", top: 0, left: 0, width: "130vw", height: "130vh", border: "none", transform: "translateX(-13vw) scale(1.3)", transformOrigin: "0 0" }}
      />
    </div>
  );
}