"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import { reportError } from "@/lib/error-reporting";

const ACCESS_LABELS: Record<string, string> = {
  owner: "sahip",
  editor: "düzenleyici",
  viewer: "görüntüleyici",
};

export function NotificationChecker() {
  const { status } = useSession();
  const { addToast } = useToast();
  const checked = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || checked.current) return;
    checked.current = true;

    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        if (!data.notifications?.length) return;

        for (const n of data.notifications) {
          const grantor = n.granted_by_name || "Birisi";
          const level = ACCESS_LABELS[n.access_level] || n.access_level;
          addToast({
            message: `${grantor} seni ${n.profile_name} profiline ${level} olarak ekledi.`,
            type: "info",
            duration: 10000,
            action: {
              label: "Profilleri gör",
              href: "/settings/access",
            },
          });
        }

        fetch("/api/notifications", { method: "POST" });
      })
      .catch((err) => reportError(err, { op: "notifications.check" }));
  }, [status, addToast]);

  return null;
}
