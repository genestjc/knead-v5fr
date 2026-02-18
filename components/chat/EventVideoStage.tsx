      {/* ✅ Bottom controls bar */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-georgia-pro text-sm font-semibold text-red-600">LIVE</span>
            </div>
            <span className="font-georgia-pro text-sm text-gray-600">
              {participantIds.length} participant{participantIds.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isHost ? (
              <button
                onClick={handleEndEvent}
                className="px-6 py-2 bg-red-600 text-white rounded-full font-georgia-pro hover:bg-red-700 transition"
              >
                End Event
              </button>
            ) : (
              <button
                onClick={handleLeaveCall}
                className="px-6 py-2 bg-gray-600 text-white rounded-full font-georgia-pro hover:bg-gray-700 transition"
              >
                Leave Call
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventVideoStage;
