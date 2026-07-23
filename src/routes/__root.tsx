/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import * as React from 'react'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import appCss from '~/styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
      },
      { name: 'theme-color', content: '#f3f4f6' },
      {
        name: 'description',
        content: '健康随访管家 — 血压记录、趋势分析与健康小结',
      },
      { title: '健康随访管家' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body className="bg-gray-100">
        <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-gray-50 shadow-sm">
          <main className="flex-1 overflow-y-auto pb-24">{children}</main>
          <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md items-stretch justify-around border-t border-gray-200 bg-white/90 pt-2 backdrop-blur-md">
            <TabLink to="/" label="首页" icon={HomeIcon} />
            <TabLink to="/trends" label="趋势" icon={ChartIcon} />
            <TabLink to="/profile" label="我的" icon={UserIcon} />
          </nav>
        </div>
        <TanStackRouterDevtools position="top-right" />
        <Scripts />
      </body>
    </html>
  )
}

function TabLink({
  to,
  label,
  icon: Icon,
}: {
  to: '/' | '/trends' | '/profile'
  label: string
  icon: React.FC<React.SVGProps<SVGSVGElement>>
}) {
  const active = useRouterState({
    select: (s) => s.location.pathname === to,
  })
  return (
    <Link
      to={to}
      className={active ? 'tab text-blue-600' : 'tab text-gray-400'}
    >
      <Icon className="h-6 w-6" />
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  )
}

function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function ChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  )
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
