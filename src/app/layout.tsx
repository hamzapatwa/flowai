import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgentFlow — AI-native workflow builder',
  description: 'Describe what you want. Agents make it happen.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#6366f1',
          colorBackground: '#0a0a0a',
          colorText: '#fafafa',
          colorInputBackground: '#111111',
          colorInputText: '#fafafa',
        },
      }}
    >
      <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <body className="bg-[#0a0a0a] text-[#fafafa] antialiased min-h-screen">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
