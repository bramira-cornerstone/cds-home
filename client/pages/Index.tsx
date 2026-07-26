export default function Home() {
  return (
    <section className="relative flex flex-col items-center justify-start md:justify-center flex-1 py-6 md:py-0 w-full h-full">
      <video
        autoPlay
        muted
        loop
        className="w-full h-full object-cover"
        style={{ maxWidth: "500px" }}
        src="https://cdn.builder.io/o/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F6d31e1af898f41f5a762dea2b00cab1a?alt=media&token=46a3638a-ef8f-4760-91b1-185cd2a8e7c7&apiKey=1fc926a98c3145c69dfab54fa66e93f8"
      />
    </section>
  );
}
