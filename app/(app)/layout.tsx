import Sidebar from "@/components/layout/Sidebar";
import { getSidebarFabTeam } from "@/lib/fab-team";
import Topbar from "@/components/layout/Topbar";
import AgentWidget from "@/components/agent/AgentWidget";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fabTeamLinks = getSidebarFabTeam();

  // Returns the local development user when that bypass is enabled, so this
  // stays a single null check regardless of which identity path is live.
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-[#0A0A0B] text-zinc-100 overflow-hidden">
      <Sidebar fabTeamLinks={fabTeamLinks} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <AgentWidget />
    </div>
  );
}
