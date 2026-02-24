import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/dashboard/', '/settings/', '/api/', '/onboarding/', '/(auth)/', '/(app)/'],
        },
        sitemap: 'https://authormity.com/sitemap.xml',
    }
}
