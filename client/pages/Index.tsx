export default function Home() {
  return (
    <section className="relative flex flex-col items-center justify-center flex-1 py-6 md:py-0 w-full h-full">
      <video
        autoPlay
        muted
        loop
        className="w-full h-full object-cover"
        style={{ maxWidth: "500px" }}
        src="/images/preview.mp4"
      />
    </section>
  );
}
