"use client";
import { AdminShell, useAdminReady } from "../AdminShell";
import { PaymentDesk } from "@/components/PaymentDesk";

function Content() {
  return useAdminReady() ? <PaymentDesk /> : null;
}

export default function Page() {
  return (
    <AdminShell title="收款与订单" active="/admin/payments">
      <Content />
    </AdminShell>
  );
}
