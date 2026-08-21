import { ArrowLeft } from "lucide-react";

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl font-normal tracking-tight text-[#191919] md:text-2xl">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[#191919]/70">
        {children}
      </div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

export default function Terms() {
  return (
    <main className="px-6 pb-24 pt-28 sm:px-10 md:px-14 md:pt-36">
      <div className="mx-auto max-w-3xl">
        <a
          href="#/"
          className="inline-flex items-center gap-1.5 text-sm text-[#191919]/60 transition-colors duration-200 hover:text-[#191919]"
        >
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          Back to home
        </a>

        <h1 className="mt-6 font-serif text-4xl font-normal tracking-tight text-[#191919] md:text-5xl">
          Terms of Service.
        </h1>
        <p className="mt-3 text-sm text-[#191919]/50">
          Last updated: August 21, 2026
        </p>

        <Block title="Agreement">
          <P>
            These Terms of Service ("Terms") govern your use of the HostWise
            website and desktop application. By downloading, installing, or
            using HostWise, you agree to these Terms. If you do not agree,
            please do not use the software.
          </P>
        </Block>

        <Block title="License">
          <P>
            Subject to these Terms, we grant you a limited, non-exclusive,
            non-transferable license to install and use HostWise on your own
            devices for your personal or business use. A license unlocks the
            full application on your machine.
          </P>
        </Block>

        <Block title="Paid product & refunds">
          <P>
            HostWise is a paid desktop product. Pricing, license terms, and any
            trial are described on our site and at the point of purchase. If a
            refund policy applies to your purchase, it is stated at checkout;
            please contact support@hostwise.app with questions about invoicing
            or team licenses.
          </P>
        </Block>

        <Block title="Acceptable use">
          <P>You agree not to:</P>
          <ul className="space-y-2">
            <li className="flex gap-3">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
              Misuse, abuse, or attempt to damage the software or website
            </li>
            <li className="flex gap-3">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
              Reverse-engineer, decompile, or redistribute the software except
              as permitted by law
            </li>
            <li className="flex gap-3">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
              Use the software for any unlawful purpose
            </li>
          </ul>
        </Block>

        <Block title="Your data">
          <P>
            You own the data you import into HostWise. It is stored locally on
            your device and we do not access it. You are responsible for the
            accuracy of the data you import and for ensuring you have the right
            to use it (for example, exports from your booking platforms).
          </P>
        </Block>

        <Block title="Disclaimer">
          <P>
            HostWise is provided "as is" and "as available", without warranties
            of any kind, whether express or implied, including merchantability
            or fitness for a particular purpose. Financial reports and
            recommendations are informational tools — you remain responsible
            for your own business and financial decisions.
          </P>
        </Block>

        <Block title="Limitation of liability">
          <P>
            To the maximum extent permitted by law, we are not liable for any
            indirect, incidental, special, or consequential damages arising
            from your use of HostWise, even if we have been advised of the
            possibility of such damages.
          </P>
        </Block>

        <Block title="Termination">
          <P>
            You may stop using HostWise at any time. We may terminate access to
            the software or services if you breach these Terms.
          </P>
        </Block>

        <Block title="Changes to these Terms">
          <P>
            We may update these Terms from time to time. Continued use of
            HostWise after changes are posted constitutes acceptance of the
            updated Terms.
          </P>
        </Block>

        <Block title="Contact">
          <P>
            Questions about these Terms? Email us at support@hostwise.app.
          </P>
        </Block>
      </div>
    </main>
  );
}
