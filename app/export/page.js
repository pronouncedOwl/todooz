import ExportDump from "@/components/ExportDump";
import { getTodos } from "@/lib/db";
import { formatActiveExportJson } from "@/lib/export-active";
import { getTodayRecurring } from "@/lib/recurring";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Export · Toodooz",
};

export default async function ExportPage() {
  const [todos, recurring] = await Promise.all([
    getTodos(),
    getTodayRecurring(),
  ]);
  const json = formatActiveExportJson(todos, recurring);
  return <ExportDump json={json} />;
}
