"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

export function FAQDropdown({
  question,
  answer,
}: {
  question: string
  answer: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-gray-100 py-4">
      <button className="w-full text-left flex items-center justify-between group" onClick={() => setOpen(!open)}>
        <h3
          className="text-xl font-normal text-black group-hover:text-gray-700 transition-colors"
          style={{ fontFamily: "Adonis, serif" }}
        >
          {question}
        </h3>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="mt-4 text-gray-700 leading-relaxed animate-fade-in"
          style={{ fontFamily: "Georgia Pro, serif" }}
        >
          {answer}
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
