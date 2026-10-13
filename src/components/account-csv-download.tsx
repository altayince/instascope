"use client";
import type { Account } from "@/lib/instagram/types";
import { accountCsv } from "@/lib/account-csv";
import { download } from "@/lib/download";
import { ActionButton } from "./actions";

export function AccountCsvDownload({
  accounts,
  demo = false,
}: {
  accounts: readonly Account[];
  demo?: boolean;
}) {
  return (
    <ActionButton
      variant="secondary"
      type="button"
      disabled={!accounts.length}
      title="Downloads every account matching this view, including other pages. Recorded calendar dates are blank when unavailable."
      onClick={() =>
        download(
          new Blob([accountCsv(accounts, demo)], {
            type: "text/csv;charset=utf-8",
          }),
          demo ? "instascope-demo-accounts.csv" : "instascope-accounts.csv",
        )
      }
    >
      Download CSV ({accounts.length.toLocaleString("en-US")})
    </ActionButton>
  );
}
