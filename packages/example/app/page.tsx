import Link from "next/link"

export default function Page() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        width: "100vw",
        height: "100vh",
        gap: "1rem",
      }}
    >
      <h1 style={{ fontFamily: "serif" }}>Reforest</h1>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.6rem",
        }}
      >
        <Link href="/experience">Experience</Link>
        <Link href="/timeline">Timeline</Link>
        <Link href="/simple">Simple</Link>
      </div>
    </div>
  )
}
