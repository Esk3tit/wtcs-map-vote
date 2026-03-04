import { createFileRoute, Link } from "@tanstack/react-router"
import privacyHtml from "@/content/privacy-policy.html?raw"
import { policyContentStyles } from "@/lib/policy-styles"

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicyPage,
})

function PrivacyPolicyPage() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div
          className={policyContentStyles}
          dangerouslySetInnerHTML={{ __html: privacyHtml }}
        />
        <footer className="mt-12 pt-8 border-t border-border/30 text-center">
          <p className="text-xs text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </p>
        </footer>
      </div>
    </div>
  )
}
