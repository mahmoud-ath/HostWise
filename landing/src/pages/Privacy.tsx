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

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function Privacy() {
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
          Privacy Policy.
        </h1>
        <p className="mt-3 text-sm text-[#191919]/50">
          Last updated: August 21, 2026
        </p>

        <Block title="Overview">
          <P>
            HostWise is a local-first desktop application for vacation rental
            hosts. Your business and financial data — properties, bookings,
            revenue, expenses — is stored on your own device in a local
            database and is not uploaded to our servers. This policy explains
            what we do collect when you use our website, subscribe to our
            newsletter, or contact us, and how we use it.
          </P>
        </Block>

        <Block title="Information we collect">
          <Ul
            items={[
              "Email address — when you subscribe to product updates, request a download, or contact support",
              "Usage analytics — anonymous, aggregated page-view data via our hosting analytics",
              "Messages you send us — feedback forms, support emails, and issue reports",
            ]}
          />
        </Block>

        <Block title="How we use your information">
          <Ul
            items={[
              "Send you the download link and product updates you asked for",
              "Respond to support requests and feedback",
              "Improve the product and website based on aggregated usage",
              "Never sell or rent your personal information",
            ]}
          />
        </Block>

        <Block title="Your data stays on your device">
          <P>
            HostWise is built to be private by design. Your property and
            financial data lives in a single local file on your machine, works
            fully offline, and is only transferred when you explicitly export
            or share it (for example, generating a report PDF or sending a
            backup). We have no access to the data in your app.
          </P>
        </Block>

        <Block title="Analytics & cookies">
          <P>
            Our website uses privacy-friendly, aggregate analytics to
            understand which pages are visited. This data is not used for
            advertising and does not contain your property or financial
            information.
          </P>
        </Block>

        <Block title="Sharing">
          <P>
            We only share personal information with service providers that help
            us operate (such as website hosting and email processing), or where
            required by law. We do not sell or rent your information to anyone.
          </P>
        </Block>

        <Block title="Your rights">
          <Ul
            items={[
              "Access or update the personal information you gave us",
              "Unsubscribe from email updates at any time — every email includes an unsubscribe option",
              "Ask us to delete your email and messages by contacting support",
            ]}
          />
        </Block>

        <Block title="Children">
          <P>
            HostWise is not directed at children, and we do not knowingly
            collect personal information from children.
          </P>
        </Block>

        <Block title="Changes to this policy">
          <P>
            We may update this policy from time to time. We will post any
            changes on this page and update the "Last updated" date above.
          </P>
        </Block>

        <Block title="Contact">
          <P>
            Questions about this policy? Email us at markuspub4@gmail.com.
          </P>
        </Block>
      </div>
    </main>
  );
}
