import { useState } from "react";

export function AccountTutorialCard() {
  const [isOpen, setIsOpen] = useState(true);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6 card-shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-800">
          <p>Tutorial</p>
        </h2>
        <button
          onClick={handleToggle}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          {isOpen ? "Close Tutorial" : "Open Tutorial"}
        </button>
      </div>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? "460px" : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="flex justify-center">
          <iframe
            src="https://player.mux.com/yeBJDo01JVbFUg3D02RlF72NgjRIUo9jCLRfBNZEqSvMw?accent-color=%230080ff&primary-color=%23ff8000&secondary-color=%23FFFFFF"
            style={{
              height: "460px",
              width: "300px",
              border: "none",
              aspectRatio: "16/9",
              objectFit: "cover",
            }}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
          />
        </div>
      </div>
    </article>
  );
}
