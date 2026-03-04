import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"

interface PolicyFooterProps {
  className?: string
}

export function PolicyFooter({ className }: PolicyFooterProps) {
  return (
    <footer className={cn("py-4 text-center text-xs text-muted-foreground/60", className)}>
      <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">
        Privacy Policy
      </Link>
      {" · "}
      <Link to="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">
        Terms of Service
      </Link>
    </footer>
  )
}
