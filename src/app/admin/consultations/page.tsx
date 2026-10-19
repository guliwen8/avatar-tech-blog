"use client";
import { AdminShell, useAdminReady } from "../AdminShell";
import { ConsultationDesk } from "@/components/ConsultationDesk";
function Content() {
  return useAdminReady() ? <ConsultationDesk admin /> : null;
}
export default function Page() {
  return (
    <AdminShell title="咨询管理" active="/admin/consultations">
      <Content />
    </AdminShell>
  );
}
