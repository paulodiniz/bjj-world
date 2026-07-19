import type { Metadata } from 'next'
import { Header } from '@/components/Header'
import { AuthRedirectHandler } from '@/components/AuthRedirectHandler'
import '@/app/globals.css'

export const metadata: Metadata = {
  title: 'Tapcodex - BJJ Knowledge Graph',
  description: 'AI-powered knowledge graph for Brazilian Jiu-Jitsu',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/css/app.css?v=4" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
      </head>
      <body>
        <Header />
        <AuthRedirectHandler />
        {children}
      </body>
    </html>
  )
}
