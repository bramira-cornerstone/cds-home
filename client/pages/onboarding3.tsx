import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FreeMoneyCard } from "@/components/FreeMoneyCard";

export default function Onboarding3() {
  const navigate = useNavigate();

  const handleNext = useCallback(() => {
    navigate("/onboarding4");
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-white px-4 mt-6">
      <div className="flex flex-col items-center gap-6 max-w-2xl">
        {/* Free Money Card with all content and functionality */}
        <FreeMoneyCard />

        {/* Next Button */}
        <button
          onClick={handleNext}
          className="w-full text-white font-medium rounded transition-colors max-w-md"
          style={{
            backgroundColor: "rgba(0, 79, 255, 1)",
            padding: "12px 16px",
            lineHeight: "20px",
            fontSize: "16px",
          }}
        >
          <p>Take the next step...</p>
        </button>
      </div>
    </div>
  );
}
