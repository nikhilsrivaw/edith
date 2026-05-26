import type { Metadata } from "next";
import { Bullets, Mono, Section, Title, Toc } from "../_components";

const UPDATED = "2026-05-26";
const CONTACT_EMAIL = "support@edith.expert";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms governing your use of EDITH (edith.expert), including acceptable use, billing, intellectual property, and limits of liability.",
  alternates: { canonical: "/legal/tos" },
};

const SECTIONS = [
  { id: "acceptance", label: "Acceptance" },
  { id: "service", label: "The Service" },
  { id: "eligibility", label: "Eligibility & account" },
  { id: "your-content", label: "Your code & content" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "billing", label: "Subscriptions & billing" },
  { id: "trials", label: "Free tier & trials" },
  { id: "ip", label: "Intellectual property" },
  { id: "third-parties", label: "Third-party services" },
  { id: "feedback", label: "Feedback" },
  { id: "warranties", label: "Warranties & disclaimers" },
  { id: "liability", label: "Limitation of liability" },
  { id: "indemnity", label: "Indemnification" },
  { id: "termination", label: "Termination" },
  { id: "law", label: "Governing law" },
  { id: "changes", label: "Changes" },
  { id: "contact", label: "Contact" },
];

export default function TermsPage() {
  return (
    <article>
      <Title eyebrow="Legal" title="Terms of Service" updated={UPDATED} />

      <Toc items={SECTIONS} />

      <Section id="acceptance" number={1} title="Acceptance of these terms">
        <p>
          These Terms of Service (the &ldquo;Terms&rdquo;) govern your
          access to and use of EDITH (the &ldquo;Service&rdquo;), operated
          on the domain edith.expert. By creating an account, installing
          the EDITH GitHub App, installing the EDITH browser extension,
          or otherwise using any part of the Service, you agree to be
          bound by these Terms. If you do not agree, do not use the
          Service.
        </p>
        <p>
          If you are using the Service on behalf of an organisation, you
          represent that you have authority to bind that organisation to
          these Terms, and &ldquo;you&rdquo; refers to that organisation.
        </p>
      </Section>

      <Section id="service" number={2} title="The Service">
        <p>
          EDITH is a software-as-a-service product that audits
          web-application source code for security, performance,
          reliability, SEO, and related defects, and generates
          remediation guidance in formats compatible with AI coding
          tools. The Service may include any of: the EDITH web
          dashboard, the EDITH GitHub App, the EDITH browser extension,
          the EDITH MCP server, our public APIs, and integrations with
          third-party services such as Google Search Console.
        </p>
        <p>
          We may add, change, or remove features at any time, with or
          without notice. We will give reasonable notice before removing
          material paid features.
        </p>
      </Section>

      <Section id="eligibility" number={3} title="Eligibility & account">
        <p>
          You must be at least 16 years old (or the applicable age of
          digital consent in your jurisdiction) and legally able to
          enter into a binding contract to use the Service.
        </p>
        <p>
          You are responsible for keeping your account credentials
          secure. You must not share your account, transfer it to
          another person, or use anyone else&apos;s account without
          permission. You are responsible for all activity that occurs
          under your account.
        </p>
      </Section>

      <Section id="your-content" number={4} title="Your code and content">
        <p>
          You retain all right, title, and interest in your source code,
          repository content, search-analytics data, and any other
          content you provide or that the Service ingests on your behalf
          (&ldquo;Your Content&rdquo;). You grant EDITH a limited,
          worldwide, royalty-free licence to host, copy, process, and
          display Your Content solely as necessary to operate and
          improve the Service for you.
        </p>
        <p>
          We do not use Your Content to train machine-learning models.
          We do not sell or rent Your Content to third parties. We
          process Your Content only as described in our{" "}
          <a
            className="text-[var(--accent)] hover:brightness-110"
            href="/legal/privacy"
          >
            Privacy Policy
          </a>
          .
        </p>
        <p>
          You represent and warrant that you have all rights necessary
          to grant the licence above, and that Your Content does not
          violate any third party&apos;s rights or any applicable law.
        </p>
      </Section>

      <Section id="acceptable-use" number={5} title="Acceptable use">
        <p>You agree not to use the Service to:</p>
        <Bullets
          items={[
            "Violate any law or regulation, including export-control, anti-spam, or privacy laws.",
            "Scan or attempt to access repositories or websites you do not own or are not authorised to audit.",
            "Reverse-engineer, decompile, or otherwise attempt to derive the source code of the Service except to the extent expressly permitted by applicable law.",
            "Probe, scan, or test the vulnerability of the Service except via our published responsible-disclosure channel.",
            "Send spam, malware, or anything intended to disrupt other users' use of the Service.",
            "Resell or sublicense the Service except as expressly permitted by your subscription plan.",
            "Use automated means (other than our published APIs) to scrape data from the Service.",
            "Bypass or attempt to bypass any rate limit, billing gate, or access control.",
          ]}
        />
        <p>
          We may suspend or terminate accounts that violate this
          section, with or without notice depending on severity.
        </p>
      </Section>

      <Section id="billing" number={6} title="Subscriptions and billing">
        <p>
          EDITH offers free and paid plans. Paid plans are processed via
          our payment partner, PayU. By subscribing to a paid plan you
          authorise EDITH (through PayU) to charge the recurring fee
          shown at the time of purchase, plus applicable taxes, to the
          payment method you provide.
        </p>
        <p>
          Subscriptions renew automatically at the end of each billing
          period unless cancelled. You may cancel at any time from your
          dashboard; cancellation takes effect at the end of the
          current paid period and the Service downgrades to the free
          tier thereafter. Fees already paid are non-refundable except
          where required by law.
        </p>
        <p>
          We may change prices for new subscriptions at any time. Price
          changes for existing subscribers take effect at the next
          renewal and we will notify you at least 30 days in advance.
        </p>
      </Section>

      <Section id="trials" number={7} title="Free tier & trials">
        <p>
          Some features may be made available free of charge or for a
          limited evaluation period. We may modify or end the free tier
          or trial offers at any time. Free-tier accounts may be subject
          to lower usage limits, slower scan queueing, and feature
          restrictions documented at the time of signup.
        </p>
      </Section>

      <Section id="ip" number={8} title="Intellectual property">
        <p>
          The Service, including the EDITH brand, the dashboard
          interface, the scanner engine, the check catalogue, the
          generated fix prompts, our documentation, and all related
          intellectual property, is owned by EDITH or its licensors and
          is protected by intellectual-property laws. Except for the
          limited rights expressly granted by these Terms, you receive
          no licence to our intellectual property.
        </p>
        <p>
          You may not remove or alter any copyright, trademark, or
          attribution notices in the Service or in the auto-generated
          PR comments, fix prompts, or reports that EDITH produces on
          your behalf.
        </p>
      </Section>

      <Section id="third-parties" number={9} title="Third-party services">
        <p>
          The Service integrates with third-party services including
          GitHub, Google Search Console, Anthropic Claude, Inngest,
          Supabase, Vercel, and PayU. Your use of those services is
          governed by their own terms; we are not responsible for any
          third-party service or its availability. Where you authorise
          us to access a third-party account on your behalf via OAuth,
          you remain responsible for that authorisation and may revoke
          it at any time from the third party&apos;s settings.
        </p>
      </Section>

      <Section id="feedback" number={10} title="Feedback">
        <p>
          If you send us suggestions, ideas, or feature requests
          (&ldquo;Feedback&rdquo;), you grant EDITH a perpetual,
          worldwide, royalty-free licence to use the Feedback for any
          purpose, including incorporating it into the Service,
          without compensation or attribution to you.
        </p>
      </Section>

      <Section id="warranties" number={11} title="Warranties and disclaimers">
        <p>
          <b>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
            AVAILABLE&rdquo;.
          </b>{" "}
          To the maximum extent permitted by law, EDITH disclaims all
          warranties, express or implied, including any warranties of
          merchantability, fitness for a particular purpose,
          non-infringement, and quiet enjoyment.
        </p>
        <p>
          EDITH performs static and runtime analysis of your code, but
          we do not guarantee that the Service will detect every
          security vulnerability, performance regression, SEO defect,
          accessibility issue, or other problem in your application.
          EDITH&apos;s findings, scores, and fix prompts are provided
          for informational purposes only. You remain solely responsible
          for the quality, security, and operation of your software.
        </p>
        <p>
          EDITH&apos;s AI-generated fix prompts are produced by
          third-party large language models and may contain errors or
          omissions. You must review and test any code change suggested
          by EDITH before deploying it. EDITH is not responsible for the
          consequences of applying its suggestions.
        </p>
      </Section>

      <Section id="liability" number={12} title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, EDITH and its
          affiliates, directors, employees, and agents will not be
          liable for any indirect, incidental, special, consequential,
          punitive, or exemplary damages, including loss of profits,
          revenue, data, or goodwill, even if EDITH has been advised of
          the possibility of such damages.
        </p>
        <p>
          EDITH&apos;s total aggregate liability for all claims arising
          out of or related to the Service in any twelve-month period
          will not exceed the greater of (a) the amount you paid EDITH
          in fees during that period, or (b) one hundred US dollars
          (USD&nbsp;$100).
        </p>
      </Section>

      <Section id="indemnity" number={13} title="Indemnification">
        <p>
          You agree to defend, indemnify, and hold harmless EDITH and
          its affiliates from any claim, demand, loss, liability, or
          expense (including reasonable attorneys&apos; fees) arising
          out of or related to (a) Your Content, (b) your violation of
          these Terms, (c) your violation of any law or third-party
          right, or (d) your use of the Service in a manner not
          contemplated by these Terms.
        </p>
      </Section>

      <Section id="termination" number={14} title="Termination">
        <p>
          You may terminate your account at any time from the Settings
          page. We may terminate or suspend your account for any
          violation of these Terms, non-payment of fees, prolonged
          inactivity, or for any other reason on reasonable notice.
        </p>
        <p>
          Upon termination, your right to use the Service ends
          immediately. We will delete your account data within 30 days,
          subject to limited legal-hold exceptions described in the{" "}
          <a
            className="text-[var(--accent)] hover:brightness-110"
            href="/legal/privacy"
          >
            Privacy Policy
          </a>
          . Sections of these Terms that by their nature should survive
          termination (Intellectual Property, Warranties &amp;
          Disclaimers, Limitation of Liability, Indemnification,
          Governing Law) will survive.
        </p>
      </Section>

      <Section id="law" number={15} title="Governing law and disputes">
        <p>
          These Terms are governed by the laws of India, without regard
          to its conflict-of-laws rules. The courts of Bengaluru,
          Karnataka, India have exclusive jurisdiction over any dispute
          arising out of or related to these Terms or the Service,
          except that EDITH may seek injunctive relief in any court of
          competent jurisdiction to protect its intellectual property
          or to enforce the Acceptable Use section.
        </p>
        <p>
          If you reside in a jurisdiction that grants you mandatory
          consumer rights (for example the European Union or the United
          Kingdom), nothing in this section limits those rights.
        </p>
      </Section>

      <Section id="changes" number={16} title="Changes to these terms">
        <p>
          We may update these Terms from time to time. When we make
          material changes we will update the &ldquo;Last updated&rdquo;
          date at the top and, where required, notify you by email or
          in-app banner at least 30 days before the change takes effect.
          Continued use of the Service after the effective date
          constitutes acceptance.
        </p>
      </Section>

      <Section id="contact" number={17} title="Contact">
        <p>
          Questions about these Terms — email{" "}
          <a
            className="text-[var(--accent)] hover:brightness-110"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          . For invoicing or refund queries, include your account email
          and invoice number; we respond within five business days.
        </p>
        <p className="rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-4 py-3 font-mono text-[12px] text-[var(--text-dim)]">
          By using EDITH you confirm you have read, understood, and
          agree to be bound by these Terms and the{" "}
          <a
            className="text-[var(--accent)] hover:brightness-110"
            href="/legal/privacy"
          >
            Privacy Policy
          </a>
          .
        </p>
        <p className="text-[12px] text-[var(--text-muted)]">
          The string <Mono>/legal/tos</Mono> is the canonical location
          of these Terms.
        </p>
      </Section>
    </article>
  );
}
