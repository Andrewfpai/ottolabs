import { redirect } from "next/navigation";

export default function RootPage() {
  // The shell lives under /dashboard; "/" is only ever a doorway.
  redirect("/dashboard");
}
