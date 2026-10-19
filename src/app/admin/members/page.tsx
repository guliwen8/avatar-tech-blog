"use client";
import { AdminShell, useAdminReady } from "../AdminShell";
import { MemberManagement } from "@/components/MemberManagement";
function Content() {
  return useAdminReady() ? <MemberManagement /> : null;
}
export default function Page() {
  return (
    <AdminShell title="读者与会员" active="/admin/members">
      <Content />
    </AdminShell>
  );
}
