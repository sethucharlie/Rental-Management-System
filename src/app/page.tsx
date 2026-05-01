import { redirect } from "next/navigation";

export default function Home() {
  // Automatically redirect the root URL to the dashboard.
  // If the user isn't logged in, the dashboard layout will automatically kick them to /login.
  redirect("/dashboard/tenants");
}
