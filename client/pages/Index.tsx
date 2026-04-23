export default function Home() {
  return (
    <section className="relative flex flex-col items-center justify-between flex-1 py-6 md:py-32 w-full h-full">
      <video
        autoPlay
        muted
        loop
        className="w-full h-full object-cover"
        src="https://cdn.builder.io/o/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2Fbf8e1effbd114f19924066f117275f9f?alt=media&token=b46ab98d-956c-4294-aaea-67671b95ff07&apiKey=1fc926a98c3145c69dfab54fa66e93f8"
      />
    </section>
  );
}
