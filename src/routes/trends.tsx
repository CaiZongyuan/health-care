import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/trends')({
  component: TrendsPage,
})

function TrendsPage() {
  return (
    <div className="space-y-4 p-4 pt-6">
      <h1 className="text-2xl font-bold text-gray-800">趋势</h1>
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-sm leading-relaxed text-gray-500">
          血压折线、达标率（家庭血压 135/85）、清晨高血压标记、历史明细。开发中。
        </p>
      </section>
    </div>
  )
}
