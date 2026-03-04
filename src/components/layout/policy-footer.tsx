export function PolicyFooter() {
  return (
    <footer className="py-4 text-center text-xs text-muted-foreground/60">
      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">
        Privacy Policy
      </a>
      {" · "}
      <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">
        Terms of Service
      </a>
    </footer>
  )
}
