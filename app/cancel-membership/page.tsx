export default function CancelMembership() {
  return (
    <main
      style={{
        fontFamily: "georgia-pro, serif",
        padding: "2rem",
      }}
    >
      <style>{`@import url("https://use.typekit.net/gne1bgd.css");`}</style>
      <h1
        style={{
          fontFamily: "adonis, serif",
          fontSize: "2.5rem",
        }}
      >
        Cancel Membership
      </h1>
      <div
        style={{ marginTop: "2rem", fontSize: "1.2rem" }}
      >
        <p>
          We're sorry to see you go. If you wish to cancel
          your Knead Monthly membership, please confirm
          below.
        </p>
        {/* Add your wallet authentication and cancellation logic here */}
        <form method="POST" action="/api/cancel-membership">
          <button
            type="submit"
            style={{
              marginTop: "2rem",
              padding: "1rem 2rem",
              fontFamily: "adonis, serif",
              fontSize: "1.2rem",
              background: "#222",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Cancel Membership
          </button>
        </form>
      </div>
    </main>
  );
}
