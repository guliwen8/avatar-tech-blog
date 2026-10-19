"use client";
import { AdminShell, useAdminReady } from "../AdminShell";
import { FileManagement } from "@/components/FileManagement";
function Content() {
  return useAdminReady() ? <FileManagement /> : null;
}
export default function Page() {
  return (
    <AdminShell title="文件管理" active="/admin/files">
      <Content />
    </AdminShell>
  );
}
