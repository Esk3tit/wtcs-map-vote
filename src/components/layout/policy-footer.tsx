import { Link } from "@tanstack/react-router"

export function PolicyFooter() {
  return (
    <footer className="py-4 text-center text-xs text-muted-foreground/60">
      <Link to="/privacy" target="_blank" className="hover:text-muted-foreground transition-colors">
        Privacy Policy
      </Link>
      {" · "}
      <Link to="/terms" target="_blank" className="hover:text-muted-foreground transition-colors">
        Terms of Service
      </Link>
    </footer>
  )
}
