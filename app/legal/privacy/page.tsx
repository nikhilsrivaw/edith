import type { Metadata } from "next";
import { Bullets, Mono, Section, SubHead, Title, Toc } from "../_components";

const UPDATED = "2026-05-26";
const CONTACT_EMAIL = "support@edith.expert";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How EDITH collects, uses, and protects your data when you use edith.expert. Covers GitHub App access, Google Search Console OAuth, AI processing, and your rights.",
  alternates: { canonical: "/legal/privacy" },
};

const SECTIONS = [
  { id: "intro", label: "Introduction" },
  { id: "data-we-collect", label: "Data we collect" },
  { id: "how-we-use", label: "How we use data" },
  { id: "subprocessors", label: "Sub-processors" },
  { id: "ai-and-llms", label: "AI & LLMs" },
  { id: "google-data", label: "Google user data" },
  { id: "github-data", label: "GitHub data" },
  { id: "retention", label: "Retention" },
  { id: "your-rights", label: "Your rights" },
  { id: "cookies", label: "Cookies" },
  { id: "security", label: "Security" },
  { id: "children", label: "Children" },
  { id: "transfers", label: "International transfers" },
  { id: "changes", label: "Changes" },
  { id: "contact", label: "Contact" },
];

export default function PrivacyPage() {
  return (
    <article>
      <Title
        eyebrow="Legal"
        title="Privacy Policy"
        updated={UPDATED}
      />

      <Toc items={SECTIONS} />

      <Section id="intro" number={1} title="Introduction">
        <p>
          EDITH (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;edith.expert&rdquo;)
          builds a SaaS product that audits AI-generated web applications.
          This Privacy Policy explains what personal data we collect when you
          use our website, dashboard, GitHub App, browser extension, MCP
          server, or any other EDITH-branded service (collectively, the
          &ldquo;Service&rdquo;), how we use that data, and your choices.
        </p>
        <p>
          We are a registered business operating EDITH on the domain
          edith.expert. For any privacy question, contact us at{" "}
          <a
            className="text-[var(--accent)] hover:brightness-110"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section id="data-we-collect" number={2} title="Data we collect">
        <SubHead>Account data</SubHead>
        <p>
          When you sign in via GitHub OAuth, we receive your GitHub username,
          display name, email address, avatar URL, and the OAuth access token
          required to call the GitHub API on your behalf. We store these in
          our user database so we can show you your repositories and post PR
          comments under your installation.
        </p>

        <SubHead>Repository scan data</SubHead>
        <p>
          When you install the EDITH GitHub App on a repository and trigger
          a scan (manually or via webhook), we fetch the repository&apos;s
          file tree and the contents of files we recognise as scannable
          (source code, configuration files, schemas). We parse this content
          server-side to run our static analysis checks, store the resulting
          issues, scores, and metadata, and discard the raw source files at
          the end of the scan. We never persist your full source code; only
          the small code snippets (typically 1-3 lines) attached to each
          finding for context.
        </p>

        <SubHead>Search Console data</SubHead>
        <p>
          If you connect your Google Search Console account, we receive a
          refresh token from Google scoped to{" "}
          <Mono>webmasters.readonly</Mono>. We use it to pull aggregated
          search-analytics data (impressions, clicks, CTR, position) for the
          properties you bind to your EDITH repositories. We never modify
          your Search Console settings. You can revoke this access at any
          time from your Google Account settings or by clicking
          &ldquo;Disconnect&rdquo; on your EDITH dashboard.
        </p>

        <SubHead>Extension telemetry</SubHead>
        <p>
          If you install the EDITH browser extension and sign it into your
          account, it sends the following from the pages you actively scan:
          URL, page title, Core Web Vitals measurements, a snapshot of the
          rendered <Mono>&lt;head&gt;</Mono> metadata, and any console errors
          captured during the probe window. The extension never reads form
          inputs, cookies, or local storage from the pages you visit. We
          store this telemetry against your account to surface it on your
          dashboard.
        </p>

        <SubHead>Usage and product analytics</SubHead>
        <p>
          We log technical events necessary to operate the Service: API
          requests, scan triggers, billing events, errors, and aggregated
          performance metrics. These logs include your IP address and user
          agent and are retained for up to 90 days for security and
          debugging purposes.
        </p>

        <SubHead>Billing data</SubHead>
        <p>
          When you upgrade to a paid plan, our payment processor (PayU)
          collects and processes your payment information directly. EDITH
          stores only a non-sensitive customer reference, plan tier,
          subscription status, and invoice metadata. We do not store full
          card numbers, CVVs, or banking credentials on our servers.
        </p>
      </Section>

      <Section id="how-we-use" number={3} title="How we use your data">
        <Bullets
          items={[
            <>
              <b>To operate the Service.</b> Run scans, generate fix prompts,
              post PR comments, sync Search Console data, render your
              dashboard, send transactional emails (login links, invoices,
              critical alerts you opt into).
            </>,
            <>
              <b>To improve product quality.</b> Aggregate, de-identified
              metrics about which checks fire most often, average scan
              duration, and feature usage. We never use the contents of your
              source code to train machine-learning models.
            </>,
            <>
              <b>To prevent abuse.</b> Rate-limit, detect anomalous traffic,
              investigate fraud, comply with applicable law.
            </>,
            <>
              <b>To communicate with you.</b> Send service notices, billing
              receipts, and (only with your opt-in) product updates.
            </>,
          ]}
        />
      </Section>

      <Section id="subprocessors" number={4} title="Sub-processors">
        <p>
          EDITH uses a small set of vetted infrastructure providers to
          operate the Service. We have data-processing terms in place with
          each. The current list:
        </p>
        <Bullets
          items={[
            <>
              <b>Supabase</b> (PostgreSQL hosting + auth) — primary database
              and user authentication store. Region: their default
              data-centre for our project.
            </>,
            <>
              <b>Vercel</b> (compute + edge network) — hosts the web app,
              API routes, and the cron orchestrator.
            </>,
            <>
              <b>GitHub</b> (source repository access) — only the
              repositories you explicitly install the EDITH App on are
              accessible to us.
            </>,
            <>
              <b>Anthropic</b> (Claude API) — generates the natural-language
              fix-prompts and runs the LLM citation tracker. We send only
              the issue context relevant to the prompt, never your entire
              codebase.
            </>,
            <>
              <b>Google</b> — Search Console API (only with your OAuth
              consent), Cloud authentication services.
            </>,
            <>
              <b>Inngest</b> — background job queue for scan workers and
              cron-triggered tasks.
            </>,
            <>
              <b>PayU</b> — payment processor. They directly receive your
              billing details and return a customer reference to EDITH.
            </>,
            <>
              <b>Slack</b> (optional) — only if you supply an ops webhook to
              receive your own alerts.
            </>,
          ]}
        />
      </Section>

      <Section id="ai-and-llms" number={5} title="AI and LLMs">
        <p>
          EDITH uses large-language models in two clearly-scoped ways:
        </p>
        <Bullets
          items={[
            <>
              <b>Fix-prompt generation.</b> When you expand an issue, we send
              the issue title, severity, dimension, file path, line number,
              and a small snippet of the affected code to Anthropic&apos;s
              Claude API. Claude returns a natural-language fix prompt. We
              cache the result so the same issue is not re-sent.
            </>,
            <>
              <b>LLM citation tracking.</b> Periodically, we ask Claude what
              it knows about your brand and parse the response for citations.
              The query sent to Claude contains only the brand name and the
              question template; it does not contain your source code or
              user data.
            </>,
          ]}
        />
        <p>
          We have configured our API integrations such that Anthropic and
          other AI providers do not use the data we send to train their
          underlying models. We do not enable any kind of long-term
          memorisation of customer content.
        </p>
      </Section>

      <Section id="google-data" number={6} title="Google user data">
        <p>
          EDITH&apos;s use of Google user data conforms to{" "}
          <a
            className="text-[var(--accent)] hover:brightness-110"
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener"
          >
            Google&apos;s API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <SubHead>What we access</SubHead>
        <p>
          The only Google scope EDITH requests is{" "}
          <Mono>https://www.googleapis.com/auth/webmasters.readonly</Mono>.
          This grants read-only access to your Search Console properties
          (the list of verified sites and their search-analytics data).
          We do not request access to Gmail, Drive, Contacts, Calendar, or
          any other Google service.
        </p>
        <SubHead>How we use it</SubHead>
        <p>
          We pull aggregated search-analytics data (impressions, clicks,
          CTR, average position) and store the result in our database
          against your EDITH organisation. We use this exclusively to
          render the SEO dashboard, correlate ranking data with on-page
          findings, and surface low-hanging-fruit recommendations to you.
          We do not transfer, sell, or use your Google user data for
          advertising or other commercial purposes.
        </p>
        <SubHead>Revoking access</SubHead>
        <p>
          You can disconnect Google at any time at{" "}
          <a
            className="text-[var(--accent)] hover:brightness-110"
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener"
          >
            myaccount.google.com/permissions
          </a>{" "}
          or from your EDITH dashboard. When you disconnect, we
          immediately delete the refresh token and stop syncing new data.
          Existing aggregated metrics in your dashboard remain until you
          delete your account.
        </p>
      </Section>

      <Section id="github-data" number={7} title="GitHub data">
        <p>
          EDITH operates as a GitHub App that you (or an organisation
          admin) install on specific repositories. We request the minimum
          permissions required: <b>contents:read</b> (to fetch source for
          scanning), <b>pull_requests:write</b> (to post PR comments and
          status checks), and <b>metadata:read</b>.
        </p>
        <p>
          You can revoke the installation at any time at
          github.com/settings/installations. When you do, we stop receiving
          webhooks for that repo. Existing scan history is retained per the
          retention rules below until you delete it or your account.
        </p>
      </Section>

      <Section id="retention" number={8} title="Data retention">
        <Bullets
          items={[
            <>
              <b>Account data</b> — kept while your account is active and
              for 30 days after you delete it, then permanently removed.
            </>,
            <>
              <b>Source code fetched during scans</b> — held only for the
              duration of the scan (typically &lt; 2 minutes), then
              deleted. Never persisted.
            </>,
            <>
              <b>Scan results, issues, scores</b> — retained for the
              lifetime of your account or until you delete the
              repository, whichever comes first.
            </>,
            <>
              <b>Search Console metrics</b> — last 90 days rolling.
            </>,
            <>
              <b>Operational logs</b> — 90 days.
            </>,
            <>
              <b>Billing records</b> — retained for the legally-required
              period (typically 7 years for tax purposes).
            </>,
          ]}
        />
      </Section>

      <Section id="your-rights" number={9} title="Your rights">
        <p>
          You have the following rights regarding your personal data,
          subject to applicable law:
        </p>
        <Bullets
          items={[
            <>
              <b>Access.</b> You can request a copy of the personal data we
              hold about you.
            </>,
            <>
              <b>Correction.</b> You can update inaccurate data directly
              in your dashboard, or contact us.
            </>,
            <>
              <b>Deletion.</b> You can delete your account at any time from
              Settings, which removes your personal data (subject to
              limited legal-hold exceptions).
            </>,
            <>
              <b>Portability.</b> You can export your scan history and
              findings as JSON from the dashboard.
            </>,
            <>
              <b>Objection / withdrawal of consent.</b> You can revoke any
              OAuth grant (GitHub, Google) at the source provider; we
              honour that immediately.
            </>,
            <>
              <b>Complaint.</b> If we mishandle your data, you have the
              right to lodge a complaint with your local data-protection
              authority.
            </>,
          ]}
        />
        <p>
          To exercise any of these rights, email{" "}
          <a
            className="text-[var(--accent)] hover:brightness-110"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          . We respond within 30 days.
        </p>
      </Section>

      <Section id="cookies" number={10} title="Cookies and similar technologies">
        <p>
          EDITH uses a small number of cookies and similar technologies,
          all strictly necessary or first-party:
        </p>
        <Bullets
          items={[
            <>
              <b>Authentication cookies</b> set by Supabase Auth — keep you
              signed in.
            </>,
            <>
              <b>Short-lived OAuth state cookies</b> set during the GitHub
              and Google OAuth flows — expire in 10 minutes.
            </>,
            <>
              <b>Theme / preference</b> stored in <Mono>localStorage</Mono> —
              never sent to our servers.
            </>,
          ]}
        />
        <p>
          We do not use third-party advertising or cross-site tracking
          cookies.
        </p>
      </Section>

      <Section id="security" number={11} title="Security">
        <p>
          We use industry-standard controls to protect your data: TLS in
          transit, encrypted database storage at rest, row-level security
          policies on all sensitive tables, principle-of-least-privilege
          for service-role keys, and regular dependency vulnerability
          scanning (EDITH itself runs against EDITH). We do not store
          plaintext API keys or OAuth secrets in version control. Service
          tokens are rotatable from your dashboard.
        </p>
        <p>
          No system is perfectly secure. If you discover a vulnerability,
          please disclose it responsibly to{" "}
          <a
            className="text-[var(--accent)] hover:brightness-110"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>{" "}
          and we will acknowledge within 72 hours.
        </p>
      </Section>

      <Section id="children" number={12} title="Children">
        <p>
          EDITH is a tool for professional software developers and is not
          directed to anyone under 16 (or the applicable age of digital
          consent in your jurisdiction). We do not knowingly collect
          personal data from children. If you believe we have, contact us
          and we will delete it.
        </p>
      </Section>

      <Section id="transfers" number={13} title="International data transfers">
        <p>
          Our infrastructure providers may process data in the United
          States, European Union, India, or other regions. Where required
          by law, we rely on appropriate transfer mechanisms (Standard
          Contractual Clauses or equivalent). By using the Service, you
          consent to your data being processed in these regions.
        </p>
      </Section>

      <Section id="changes" number={14} title="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we
          make material changes we will update the &ldquo;Last
          updated&rdquo; date at the top of this page and, where
          required, notify you by email or in-app banner. Continued use
          of the Service after a change constitutes acceptance.
        </p>
      </Section>

      <Section id="contact" number={15} title="Contact us">
        <p>
          Questions, requests, or complaints — email{" "}
          <a
            className="text-[var(--accent)] hover:brightness-110"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          . For urgent security disclosures, mark the subject line
          &ldquo;SECURITY&rdquo; and we will prioritise.
        </p>
      </Section>
    </article>
  );
}
