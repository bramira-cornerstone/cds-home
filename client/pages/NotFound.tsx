import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <section className="container mx-auto px-4 py-14">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 mb-3 dark:text-white">
          404
        </h1>
        <p className="text-lg text-slate-600 mb-6">Oops! Page not found</p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-white shadow hover:bg-slate-800 transition-colors"
        >
          Return Home
        </Link>
      </div>
    </section>
  );
};

export default NotFound;
