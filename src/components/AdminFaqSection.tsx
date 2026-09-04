import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessagesSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  answerFaqQuestion,
  deleteFaqQuestion,
  listAllFaqQuestions,
} from "@/lib/faq.functions";
import { usePrefs } from "@/lib/prefs";

/** Modération des questions (admin) : réponse + durée d'affichage. */
export function AdminFaqSection() {
  const { lang } = usePrefs();
  const fr = lang === "fr";
  const fetchAll = useServerFn(listAllFaqQuestions);
  const answer = useServerFn(answerFaqQuestion);
  const remove = useServerFn(deleteFaqQuestion);

  const [drafts, setDrafts] = useState<Record<string, { answer: string; days: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const all = useQuery({ queryKey: ["faq-admin"], queryFn: () => fetchAll() });
  const items = all.data ?? [];

  const draft = (id: string) => drafts[id] ?? { answer: "", days: "7" };

  const publish = async (id: string) => {
    const d = draft(id);
    const days = Number(d.days);
    if (d.answer.trim().length < 2) return;
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      toast.error(fr ? "Durée entre 1 et 365 jours." : "Duration must be 1-365 days.");
      return;
    }
    setBusy(id);
    try {
      const r = await answer({ data: { id, answer: d.answer.trim(), days } });
      if (!r.ok) toast.error(fr ? "Réponse trop courte." : "Answer too short.");
      else {
        toast.success(fr ? "Question publiée." : "Question published.");
        await all.refetch();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const drop = async (id: string) => {
    setBusy(id);
    try {
      await remove({ data: { id } });
      await all.refetch();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <MessagesSquare className="size-4 text-primary" />
        {fr ? "Questions des utilisateurs" : "User questions"}
      </h3>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {fr ? "Aucune question pour le moment." : "No question yet."}
        </p>
      )}

      <div className="space-y-3">
        {items.map((q) => {
          const d = draft(q.id);
          return (
            <div key={q.id} className="space-y-2 rounded-lg border border-border/60 bg-card/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                    {q.initials}
                  </span>
                  <p className="text-xs">{q.question}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy === q.id}
                  onClick={() => void drop(q.id)}
                  aria-label={fr ? "Supprimer" : "Delete"}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {q.status === "published"
                  ? fr
                    ? `Publiée jusqu'au ${q.expiresAt ? new Date(q.expiresAt).toLocaleDateString() : "—"}`
                    : `Published until ${q.expiresAt ? new Date(q.expiresAt).toLocaleDateString() : "—"}`
                  : fr
                    ? "En attente"
                    : "Pending"}
              </div>

              <Textarea
                rows={2}
                value={d.answer || q.answer || ""}
                placeholder={fr ? "Réponse de SilenceCut…" : "SilenceCut answer…"}
                onChange={(e) =>
                  setDrafts((s) => ({ ...s, [q.id]: { ...d, answer: e.target.value } }))
                }
              />
              <div className="flex items-end gap-2">
                <div className="w-24">
                  <label className="text-[10px] text-muted-foreground">
                    {fr ? "Jours" : "Days"}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={d.days}
                    onChange={(e) =>
                      setDrafts((s) => ({ ...s, [q.id]: { ...d, days: e.target.value } }))
                    }
                  />
                </div>
                <Button
                  size="sm"
                  disabled={busy === q.id}
                  onClick={() => {
                    if (!drafts[q.id] && q.answer) {
                      setDrafts((s) => ({ ...s, [q.id]: { answer: q.answer!, days: d.days } }));
                    }
                    void publish(q.id);
                  }}
                >
                  {fr ? "Approuver & publier" : "Approve & publish"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
