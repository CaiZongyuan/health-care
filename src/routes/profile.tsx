import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  return (
    <div className="space-y-4 p-4 pt-6">
      <h1 className="text-2xl font-bold text-gray-800">我的</h1>
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-sm leading-relaxed text-gray-500">
          长期健康档案：身高/体重、既往病史、长期用药、紧急联系人。开发中。
        </p>
      </section>
    </div>
  )
}
