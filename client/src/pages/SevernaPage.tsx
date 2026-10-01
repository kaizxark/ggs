export default function SevernaPage({ section = "home" }: { section?: "home" | "about" | "contact" }) {
  const src = section === "about" ? "/severna/severna-atkris.framer.website/index.html#about" : section === "contact" ? "/severna/severna-atkris.framer.website/index.html#form" : "/severna/severna-atkris.framer.website/index.html";
  return (
    <iframe
      src={src}
      title="Severna"
      className="w-full h-screen border-0"
      style={{ display: "block" }}
    />
  );
}