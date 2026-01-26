import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function LoginPage() {
  const { signIn } = useAuthActions()
  const [isLoading, setIsLoading] = useState(false)

  // Reset loading state when window regains focus (handles OAuth popup cancel/error)
  useEffect(() => {
    const handleFocus = () => setIsLoading(false)
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const handleGoogleSignIn = () => {
    setIsLoading(true)
    void signIn("google")
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="w-full max-w-sm border-border/50 bg-card/80 backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-6 sm:p-8 space-y-6">
          {/* Logo/Title Section */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="size-10 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-6 text-primary-foreground"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">WTCS Map Vote</h1>
            <p className="text-muted-foreground text-xs sm:text-sm font-medium tracking-wide uppercase">Admin Portal</p>
          </div>

          {/* Sign in Button */}
          <div className="space-y-4">
            <Button
              size="lg"
              disabled={isLoading}
              className="w-full h-12 bg-white text-gray-800 border border-gray-200 shadow-sm
                         hover:bg-gray-50 hover:shadow-md hover:border-gray-300
                         active:scale-[0.98]
                         focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                         disabled:opacity-70 disabled:cursor-not-allowed
                         transition-all duration-150"
              onClick={handleGoogleSignIn}
              aria-label="Sign in with Google"
            >
              {isLoading ? (
                <Loader2 className="size-5 animate-spin text-gray-600" />
              ) : (
                <GoogleIcon />
              )}
              <span className="font-medium">
                {isLoading ? "Signing in..." : "Continue with Google"}
              </span>
            </Button>
          </div>

          {/* Footer Text */}
          <div className="pt-4 border-t border-border/30">
            <p className="text-xs text-center text-muted-foreground leading-relaxed">
              Only authorized administrators can access this portal
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
