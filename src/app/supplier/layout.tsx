import { redirect } from "next/navigation";

import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ConsoleShell } from "@/components/supplier/console-shell";

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login?next=/supplier");
  if (session.role !== "SUPPLIER") redirect("/marketplace");

  const profile = await db.supplierProfile.findUnique({
    where: { userId: session.sub },
    select: { id: true, businessName: true },
  });

  // Onboarding renders its own bare shell — wrapping it in the console before
  // a profile exists would show a nav to pages that cannot load.
  if (!profile) return <>{children}</>;

  const pendingCount = await db.supplierOrder.count({
    where: { supplierId: profile.id, status: "PENDING" },
  });

  return (
    <ConsoleShell businessName={profile.businessName} pendingCount={pendingCount}>
      {children}
    </ConsoleShell>
  );
}
