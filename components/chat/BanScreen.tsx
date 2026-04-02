'use client';

export function BanScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🚫</span>
          </div>
          <h1 className="font-georgia-pro text-2xl font-bold text-gray-900 mb-2">
            Chat Access Restricted
          </h1>
          <p className="font-georgia-pro text-gray-600">
            We're sorry, but you've been banned from Knead chat.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="font-georgia-pro text-sm text-gray-700 leading-relaxed">
            If you feel this was a mistake or would like to request reinstatement, 
            please email us with your wallet address:
          </p>
          <a 
            href="mailto:help@kneadmag.com"
            className="font-georgia-pro text-sm font-semibold text-blue-600 hover:text-blue-700 mt-2 inline-block"
          >
            help@kneadmag.com
          </a>
        </div>

        <div className="border-t border-gray-200 pt-4 mb-4">
          <p className="font-georgia-pro text-xs text-gray-500">
            You can still read essays and browse Knead, but chat and event participation are restricted.
          </p>
        </div>

        <a
          href="/"
          className="inline-block px-6 py-2 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
        >
          Return to Homepage
        </a>
      </div>
    </div>
  );
}
