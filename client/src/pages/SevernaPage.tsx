export default function SevernaPage({ section = "home" }: { section?: "home" | "about" | "contact" }) {
  const src = section === "about" ? "/severna/severna-atkris.framer.website/index.html#about" : section === "contact" ? "/severna/severna-atkris.framer.website/index.html#form" : "/severna/severna-atkris.framer.website/index.html";
  return (
    <iframe
      src={src}
      title="Severna"
      style={{ width: "100%", height: "100vh", border: "none" }}
    />
  );
}