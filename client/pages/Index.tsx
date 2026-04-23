export default function Home() {
  return (
    <section className="relative flex flex-col items-center justify-between flex-1 py-6 md:py-32 w-full h-full">
      <video
        autoPlay
        muted
        loop
        className="w-full h-full object-cover"
        style={{ maxWidth: "500px" }}
        src="https://cdn.builder.io/o/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F303935a5bf3b4d26831ba54cf1d74975?alt=media&token=a1e7c746-be8c-4eb4-9657-b38c58bff649&apiKey=1fc926a98c3145c69dfab54fa66e93f8"
      />
    </section>
  );
}
