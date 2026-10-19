import path from "node:path";
import { isAuthed } from "./auth";
import { currentMember } from "./member-session";
import type { FileActor, PrivateFile } from "./private-files";
export function privateFileRoot() {
  return path.resolve(
    process.env.FILE_STORAGE_PATH ||
      path.join(
        path.dirname(
          process.env.DB_PATH || path.join(process.cwd(), "data/blog.db"),
        ),
        "private-files",
      ),
  );
}
export async function fileActor(): Promise<FileActor> {
  const [admin, member] = await Promise.all([isAuthed(), currentMember()]);
  return { admin, memberId: member?.id, memberUntil: member?.memberUntil };
}
export function fileInfo(file: PrivateFile) {
  return {
    id: file.id,
    name: file.name,
    mime: file.mime,
    size: file.size,
    status: file.status,
    purpose: file.purpose,
    postSlug: file.post_slug,
    uploadedBy: file.uploaded_by,
    createdAt: file.created_at,
    url: "/api/files/" + file.id,
  };
}
