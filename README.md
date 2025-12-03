# Eden App

A Next.js 14 application with Supabase authentication, built with TypeScript, App Router, and Tailwind CSS.

## Features

- 🔐 Email magic link authentication via Supabase
- 🛡️ Protected dashboard route
- 🎨 Modern UI with Tailwind CSS
- 📱 Responsive design
- 🔒 Secure session management

## Prerequisites

- Node.js 18+ installed
- A Supabase project (get one free at [supabase.com](https://supabase.com))

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy your **Project URL** and **anon/public key**

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important:** Never commit `.env.local` to version control. It's already included in `.gitignore`.

### 4. Configure Supabase Authentication

In your Supabase dashboard:

1. Go to **Authentication** → **URL Configuration**
2. Add your site URL (e.g., `http://localhost:3000` for development)
3. Add `http://localhost:3000/auth/callback` to **Redirect URLs**

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

### Environment Variables

When deploying to Vercel, you'll need to add your Supabase credentials as environment variables in the Vercel dashboard:

1. Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

**Important:** 
- Your `.env.local` file stays local and will never be committed to git (it's in `.gitignore`)
- Environment variables must be added separately in Vercel for each deployment environment (Production, Preview, Development)
- After adding environment variables, redeploy your application for changes to take effect

### Supabase URL Configuration for Production

After deploying to Vercel, update your Supabase project settings:

1. Go to your Supabase dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Add your Vercel deployment URL to **Site URL** (e.g., `https://your-app.vercel.app`)
4. Add `https://your-app.vercel.app/auth/callback` to **Redirect URLs**

## Project Structure

```
.
├── app/
│   ├── dashboard/          # Protected dashboard route
│   │   ├── layout.tsx      # Dashboard layout with auth bar
│   │   └── page.tsx        # Dashboard page
│   ├── globals.css         # Global styles with Tailwind
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Landing page with login form
├── components/
│   └── LogoutButton.tsx    # Logout button component
├── lib/
│   ├── auth.ts             # Authentication helpers
│   └── supabase/
│       ├── client.ts       # Browser Supabase client
│       └── server.ts       # Server Supabase client
├── middleware.ts           # Route protection middleware
└── package.json
```

## How It Works

1. **Landing Page (`/`)**: Users enter their email to receive a magic link
2. **Email Magic Link**: Supabase sends an email with a secure login link
3. **Authentication**: Clicking the link authenticates the user and redirects to `/dashboard`
4. **Protected Route**: The dashboard is protected by middleware and server-side auth checks
5. **Session Management**: User sessions are managed via secure HTTP-only cookies

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Security Notes

- All Supabase credentials are stored in environment variables
- No secrets are hardcoded in the application
- Authentication is handled server-side where possible
- Sessions are managed securely via HTTP-only cookies
- Protected routes are verified both in middleware and server components

## Troubleshooting

### "Invalid API key" error
- Verify your `.env.local` file has the correct Supabase credentials
- Ensure the environment variables are prefixed with `NEXT_PUBLIC_`

### Magic link not working
- Check your Supabase project's URL configuration
- Verify the redirect URL is added in Supabase dashboard
- Check your email spam folder

### Dashboard redirects to home
- Ensure you're logged in (check for the magic link email)
- Verify your Supabase project is active
- Check browser console for errors

## Next Steps

- Add user profile management
- Implement additional Supabase features (database queries, storage, etc.)
- Add more protected routes as needed
- Customize the dashboard UI

## License

MIT

