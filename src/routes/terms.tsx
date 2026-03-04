import { createFileRoute, Link } from "@tanstack/react-router"
import termsHtml from "@/content/terms-of-service.html?raw"
import { policyContentStyles } from "@/lib/policy-styles"

export const Route = createFileRoute("/terms")({
  component: TermsOfServicePage,
})

function TermsOfServicePage() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div
          className={policyContentStyles}
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
