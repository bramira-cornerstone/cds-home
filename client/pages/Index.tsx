export default function Home() {
  return (
    <section className="relative flex flex-col items-center justify-between flex-1 py-6 md:py-32 w-full h-full">
      <video
        autoPlay
        muted
        loop
        className="w-full h-full object-cover"
        style={{ maxWidth: "500px" }}
        src="https://cdn.builder.io/o/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F79f94d13a8664794afd5acf8df3d4470?alt=media&token=2364049f-f1f5-4d84-b10c-a317dea447f5&apiKey=1fc926a98c3145c69dfab54fa66e93f8"
      />
    </section>
  );
}
