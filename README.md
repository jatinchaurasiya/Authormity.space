# Authormity

Production-grade LinkedIn personal branding & AI content platform.

## Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (Postgres + Auth)
- **AI**: OpenRouter → Arcee Trinity
- **Payments**: DodoPayments
- **Email**: Resend
- **Scheduled Jobs**: Supabase Edge Functions

## Getting Started

1. Copy environment variables:
   ```bash
   cp .env.local.example .env.local
   ```

2. Fill in all environment variable values

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Supabase Setup

Run `src/supabase/migrations/001_schema.sql` in your Supabase SQL Editor to create the complete database schema.

## Environment Variables

See `.env.local.example` for the complete list.

## Project Structure

```
src/
├── app/
│   ├── (marketing)/    # Landing page
│   ├── (auth)/         # Login, callback, onboarding
│   ├── (app)/          # Authenticated app shell
│   └── api/            # API routes
├── components/         # React components
├── lib/                # Core utilities & API clients
├── types/              # TypeScript interfaces
└── supabase/           # DB migrations & Edge Functions
```
