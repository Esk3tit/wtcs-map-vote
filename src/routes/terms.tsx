import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/terms")({
  component: TermsOfServicePage,
})

const termsHtml = `<h1>Terms of Service</h1>
<p>Last updated: March 04, 2026</p>
<p>Please read these Terms of Service (&quot;Terms&quot;, &quot;Terms of Service&quot;) carefully before using the WTCS Map Vote website at <a href="https://wtcsmapban.com" rel="external nofollow noopener" target="_blank">https://wtcsmapban.com</a> (the &quot;Service&quot;) operated by WTCS Map Vote (&quot;us&quot;, &quot;we&quot;, or &quot;our&quot;).</p>
<p>Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms. These Terms apply to all visitors, users, and others who access or use the Service.</p>
<p>By accessing or using the Service you agree to be bound by these Terms. If you disagree with any part of the terms then you may not access the Service.</p>

<h2>Description of Service</h2>
<p>WTCS Map Vote is a web-based application that facilitates map voting for competitive gaming sessions. The Service allows administrators to create voting sessions and players to participate in map selection through various voting formats.</p>

<h2>Accounts</h2>
<p>Administrator accounts are created through Google OAuth authentication. Only authorized administrators approved by the root administrator may access administrative features of the Service.</p>
<p>Players participate in voting sessions using temporary tokens and do not require account creation. Player access is granted through session-specific links provided by administrators.</p>
<p>You are responsible for safeguarding your account credentials and for any activities or actions under your account. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.</p>

<h2>Acceptable Use</h2>
<p>You agree not to use the Service to:</p>
<ul>
<li>Violate any applicable laws or regulations</li>
<li>Interfere with or disrupt the Service or servers or networks connected to the Service</li>
<li>Attempt to gain unauthorized access to any portion of the Service or any other systems or networks connected to the Service</li>
<li>Use the Service for any purpose that is unlawful or prohibited by these Terms</li>
<li>Impersonate any person or entity, or falsely state or misrepresent your affiliation with a person or entity</li>
<li>Attempt to bypass any rate limiting or security measures implemented in the Service</li>
</ul>

<h2>Intellectual Property</h2>
<p>The Service and its original content, features, and functionality are and will remain the exclusive property of WTCS Map Vote. The Service is protected by copyright, trademark, and other laws. Our trademarks may not be used in connection with any product or service without prior written consent.</p>

<h2>User Content</h2>
<p>The Service allows administrators to manage maps, teams, and voting sessions. By submitting content to the Service, you grant us a non-exclusive, worldwide, royalty-free license to use, modify, and display that content solely for the purpose of operating and providing the Service.</p>

<h2>Third-Party Services</h2>
<p>The Service integrates with the following third-party services:</p>
<ul>
<li><strong>Google OAuth</strong> &mdash; for administrator authentication</li>
<li><strong>Convex</strong> &mdash; for database and backend services</li>
<li><strong>PostHog</strong> &mdash; for optional analytics (when configured)</li>
<li><strong>Sentry</strong> &mdash; for optional error tracking (when configured)</li>
<li><strong>Netlify</strong> &mdash; for hosting</li>
</ul>
<p>Your use of these third-party services is subject to their respective terms of service and privacy policies.</p>

<h2>Availability and Modifications</h2>
<p>We reserve the right to withdraw or amend our Service, and any service or material we provide via the Service, in our sole discretion without notice. We will not be liable if for any reason all or any part of the Service is unavailable at any time or for any period.</p>
<p>We may modify these Terms at any time. If we make changes, we will update the &quot;Last updated&quot; date at the top of these Terms. Your continued use of the Service after any changes constitutes acceptance of the new Terms.</p>

<h2>Termination</h2>
<p>We may terminate or suspend your access immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
<p>Upon termination, your right to use the Service will immediately cease. All provisions of the Terms which by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.</p>

<h2>Disclaimer</h2>
<p>Your use of the Service is at your sole risk. The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. The Service is provided without warranties of any kind, whether express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, non-infringement, or course of performance.</p>

<h2>Limitation of Liability</h2>
<p>In no event shall WTCS Map Vote, nor its operators, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>

<h2>Governing Law</h2>
<p>These Terms shall be governed and construed in accordance with the laws of the State of California, United States, without regard to its conflict of law provisions.</p>
<p>Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect.</p>

<h2>Contact Us</h2>
<p>If you have any questions about these Terms of Service, You can contact us:</p>
<ul>
<li>By email: khaiphn41@gmail.com</li>
</ul>`

function TermsOfServicePage() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div
          className="policy-content [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-foreground [&_h1]:mb-2
            [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-4
            [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-8 [&_h3]:mb-3
            [&_h4]:text-lg [&_h4]:font-medium [&_h4]:text-foreground [&_h4]:mt-6 [&_h4]:mb-2
            [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:mb-4
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:text-muted-foreground
            [&_ul_ul]:mt-2
            [&_li]:mb-2 [&_li]:leading-relaxed
            [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary/80
            [&_strong]:text-foreground [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: termsHtml }}
        />
        <footer className="mt-12 pt-8 border-t border-border/30 text-center">
          <p className="text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
          </p>
        </footer>
      </div>
    </div>
  )
}
