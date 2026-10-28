"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "../auth-actions";
import { ConfirmDialog } from "./confirm-dialog";

/** 押すと確かめてからログアウトする。移動は form の送信に任せる（redirect を catch に巻き込まない） */
export function LogoutButton() {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <form ref={formRef} action={logoutAction}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        ログアウト
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="ログアウトしますか？"
        description={<p>もう一度入るときは、ログインからやり直します。</p>}
        confirmLabel="ログアウトする"
        onConfirm={async () => formRef.current?.requestSubmit()}
      />
    </form>
  );
}
