"use client"

import type React from "react"

export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl p-8 min-w-80 max-w-md w-full relative animate-modal-in md:animate-modal-in mobile:animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "Adonis, 'Georgia Pro', serif" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-gray-700 w-8 h-8 flex items-center justify-center"
        >
          ×
        </button>
        {children}
      </div>

      <style jsx>{`
        @media (max-width: 600px) {
          .animate-slide-up {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100vw;
            min-width: unset;
            border-radius: 24px 24px 0 0;
            animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          }
        }
        
        @media (min-width: 601px) {
          .animate-modal-in {
            animation: modalIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          }
        }
        
        @keyframes modalIn {
          from { 
            opacity: 0; 
            transform: scale(0.95);
          }
          to { 
            opacity: 1; 
            transform: scale(1);
          }
        }
        
        @keyframes slideUp {
          from { 
            transform: translateY(100%);
          }
          to { 
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
