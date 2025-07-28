"use client"

import React from "react"
import { NextStudio } from "next-sanity/studio"
import config from "../../../sanity.config"
import { Suspense } from "react"

function StudioLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">Loading Sanity Studio...</p>
        <p className="text-gray-400 text-sm mt-2">Please wait while we initialize the content management system</p>
      </div>
    </div>
  )
}

function StudioError({ error }: { error: Error }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-red-50">
      <div className="text-center max-w-md">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-red-800 mb-2">Studio Error</h1>
        <p className="text-red-600 mb-4">Failed to load Sanity Studio</p>
        <details className="text-left bg-red-100 p-4 rounded-lg">
          <summary className="cursor-pointer font-medium text-red-800">Error Details</summary>
          <pre className="mt-2 text-sm text-red-700 whitespace-pre-wrap">{error.message}</pre>
        </details>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reload Studio
        </button>
      </div>
    </div>
  )
}

class StudioErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Sanity Studio Error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return <StudioError error={this.state.error} />
    }

    return this.props.children
  }
}

export default function StudioPage() {
  return (
    <div style={{ height: "100vh" }}>
      <StudioErrorBoundary>
        <Suspense fallback={<StudioLoading />}>
          <NextStudio config={config} />
        </Suspense>
      </StudioErrorBoundary>
    </div>
  )
}
