import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
})

export const metadata: Metadata = {
    title: {
        default: 'Authormity — LinkedIn Content Platform',
        template: '%s | Authormity',
    },
    description:
        'AI-powered LinkedIn personal branding platform. Write less, post better, grow faster. The smarter alternative to Supergrow.',
    keywords: [
        'LinkedIn content',
        'personal branding',
        'AI writing',
        'LinkedIn growth',
        'ghostwriting',
        'content calendar',
    ],
    authors: [{ name: 'Authormity' }],
    creator: 'Authormity',
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://authormity.com',
        siteName: 'Authormity',
        title: 'Authormity — LinkedIn Content Platform',
        description: 'AI-powered LinkedIn personal branding. Write less, post better, grow faster.',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Authormity — LinkedIn Content Platform',
        description: 'AI-powered LinkedIn personal branding. Write less, post better, grow faster.',
    },
    robots: {
        index: true,
        follow: true,
    },
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en" className={inter.variable} suppressHydrationWarning>
            <body className="min-h-screen bg-backgroundDark antialiased">
                {children}
                <Toaster
                    position="top-right"
                    toastOptions={{
                        style: {
                            background: '#0f1729',
                            color: '#e2e8f0',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '0.75rem',
                        },
                        success: {
                            iconTheme: {
                                primary: '#0A66C2',
                                secondary: '#fff',
                            },
                        },
                    }}
                />
            </body>
        </html>
    )
}
