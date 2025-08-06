"use client";

import React from "react";
import { useToast } from "@/hooks/use-toast";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundaryClass extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback || (
        <div className="p-4 rounded bg-red-50 border border-red-200 text-center">
          <h3 className="text-xl font-adonis mb-2">Something went wrong</h3>
          <p className="font-georgia-pro mb-4">We encountered an error loading this content.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 font-adonis"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component to use hooks
export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const { toast } = useToast();

  // Custom fallback with toast
  const customFallback = fallback || (
    <div className="p-4 rounded bg-red-50 border border-red-200 text-center">
      <h3 className="text-xl font-adonis mb-2">Something went wrong</h3>
      <p className="font-georgia-pro mb-4">We encountered an error loading this content.</p>
      <button
        onClick={() => {
          toast({
            title: "Refreshing",
            description: "Attempting to reload the content",
          });
          window.location.reload();
        }}
        className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 font-adonis"
      >
        Refresh Page
      </button>
    </div>
  );

  return <ErrorBoundaryClass fallback={customFallback}>{children}</ErrorBoundaryClass>;
}
