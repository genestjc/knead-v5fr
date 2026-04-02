"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface EditModeIndicatorProps {
  isEnabled: boolean
  currentPath: string
}

export function EditModeIndicator({ isEnabled, currentPath }: EditModeIndicatorProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(true)

  if (!isEnabled || !isOpen) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black text-white rounded-lg shadow-lg p-4 flex flex-col items-start">
      <div className="flex items-center justify-between w-full mb-2">
        <span className="font-bold">Edit Mode Active</span>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white" aria-label="Close">
          ×
        </button>
      </div>
      <p className="text-sm mb-3">You're viewing draft content.</p>
      <div className="flex space-x-3">
        <a
          href={`/studio`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-3 rounded"
        >
          Open Studio
        </a>
        <button
          onClick={() => router.push(`/api/exit-preview?path=${encodeURIComponent(currentPath)}`)}
          className="bg-gray-600 hover:bg-gray-700 text-white text-sm py-1 px-3 rounded"
        >
          Exit Edit Mode
        </button>
      </div>
    </div>
  )
}
