import clsx from "clsx";
import { RECIPIENT_STATUS_LABELS, type RecipientStatus } from "@/lib/types";

const STYLES: Record<RecipientStatus, string> = {
  pending: "bg-gray-100 text-gray-700 border-gray-200",
  checking_accredible: "bg-orange-50 text-orange-700 border-orange-200",
  pre_existing: "bg-purple-50 text-purple-700 border-purple-200",
  announced: "bg-blue-50 text-blue-700 border-blue-200",
  claimed: "bg-yellow-50 text-yellow-800 border-yellow-200",
  pending_issuance: "bg-orange-50 text-orange-700 border-orange-200",
  issued: "bg-purple-50 text-purple-700 border-purple-200",
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({ status }: { status: RecipientStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap",
        STYLES[status],
      )}
    >
      {RECIPIENT_STATUS_LABELS[status]}
    </span>
  );
}
