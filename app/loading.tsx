export default function Loading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 260,
          height: 6,
          background: "rgba(37, 99, 235, 0.15)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            background: "#2563eb",
            borderRadius: 999,
            animation: "loading-fill 2.4s cubic-bezier(0.1, 0.6, 0.4, 1) forwards",
          }}
        />
      </div>
      <style>{`
        @keyframes loading-fill {
          0%   { width: 0%; }
          40%  { width: 60%; }
          70%  { width: 78%; }
          90%  { width: 88%; }
          100% { width: 92%; }
        }
      `}</style>
    </div>
  );
}
