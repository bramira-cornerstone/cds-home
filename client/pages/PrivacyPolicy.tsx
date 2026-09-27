export default function PrivacyPolicy() {
  return (
    <section className="container mx-auto max-w-4xl px-4 py-10 md:py-14">
      <article className="rounded-xl bg-white/90 p-6 shadow-sm md:p-10">
        <h1 className="mb-6 text-3xl font-bold text-slate-900 md:text-4xl">
          Privacy Policy
        </h1>
        <div className="space-y-6 text-base leading-relaxed text-slate-700 md:text-lg">
          <p>
            Cornerstone Digital Sports respects your privacy. This policy explains
            what information may be handled when you visit this website and how it
            is used.
          </p>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
              Information we receive
            </h2>
            <p>
              You can browse this website without creating an account or submitting
              personal information. We do not use Google Analytics, Mixpanel,
              advertising pixels, or cross-site advertising trackers in the website
              source code.
            </p>
            <p>
              If you choose to contact us by email, we receive the email address and
              any information you include in your message. We use that information
              to respond and manage the inquiry, and retain the correspondence only
              as long as reasonably needed for those purposes or to meet legal
              obligations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
              Hosting, security, and analytics
            </h2>
            <p>
              This website is hosted and delivered using Cloudflare Pages. Like
              other website infrastructure providers, Cloudflare may process
              technical information associated with requests, such as IP addresses,
              browser and device details, and requested pages, to deliver, maintain,
              and secure the service. Cloudflare processes that information under
              its own terms and{" "}
              <a
                href="https://www.cloudflare.com/privacypolicy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#004FFF] underline underline-offset-2 hover:text-[#003BCC]"
              >
                privacy policy
              </a>
              .
            </p>
            <p>
              If Cloudflare Web Analytics is enabled for this Pages project, it may
              provide page-view and website-performance metrics. Cloudflare
              describes Web Analytics as not collecting or using visitors’ personal
              data and as not tracking end users across its customers’ internet
              properties. See Cloudflare’s{" "}
              <a
                href="https://developers.cloudflare.com/web-analytics/about/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#004FFF] underline underline-offset-2 hover:text-[#003BCC]"
              >
                Web Analytics documentation
              </a>
              . Analytics configuration is managed in Cloudflare and may be changed
              there independently of this website’s source code.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
              Cookies and local storage
            </h2>
            <p>
              The website source code does not set advertising or cross-site
              tracking cookies. The language selector stores your selected language
              in your browser’s local storage so it can be remembered on a later
              visit. This preference is not used to track you.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
              Disclosure and external websites
            </h2>
            <p>
              We do not sell personal information or share it with third parties for
              cross-context behavioral advertising. We may use service providers,
              including Cloudflare, to host, deliver, and secure this website, and
              may disclose information when required by law.
            </p>
            <p>
              This website may link to third-party services. If you follow an
              external link, that service’s own privacy policy and practices apply.
              We do not control how third parties collect or use information.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
              Your choices and contact
            </h2>
            <p>
              You can change or clear the language preference stored in your
              browser. Depending on your location, you may have additional rights
              concerning personal information. To ask a privacy-related question or
              make a request, contact us at{" "}
              <a
                href="mailto:contact@cornerstonedigitalsports.com"
                className="text-[#004FFF] underline underline-offset-2 hover:text-[#003BCC]"
              >
                contact@cornerstonedigitalsports.com
              </a>
              .
            </p>
            <p>
              We may update this policy as the website or applicable requirements
              change. The current version will be posted on this page.
            </p>
          </section>
        </div>
      </article>
    </section>
  );
}
