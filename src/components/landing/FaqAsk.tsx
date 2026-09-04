import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { HelpCircle, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/account";
import { listPublishedFaqQuestions, submitFaqQuestion } from "@/lib/faq.functions";
import { usePrefs } from "@/lib/prefs";

/** Bloc « Poser une question » : envoi libre, affichage des questions approuvées + réponse SilenceCut. */
export function FaqAsk() {
  const { lang } = usePrefs();
  const fr = lang === "fr";
  const session = useSession();
  const qc = useQueryClient();

  const fetchPublished = useServerFn(listPublishedFaqQuestions);
  const submit = useServerFn(submitFaqQuestion);
  const [text, setText] = useState("");

  const published = useQuery({
    queryKey: ["faq-published"],
    queryFn: () => fetchPublished(),
  });

  const send = useMutation({
    mutationFn: async () => submit({ data: { question: text.trim() } }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(fr ? "Écris une question un peu plus longue." : "Write a longer question.");
        return;
      }
      setText("");
      toast.success(
        fr
          ? "Question envoyée — elle apparaîtra ici une fois approuvée."
          : "Question sent — it will appear here once approved.",
      );
      void qc.invalidateQueries({ queryKey: ["faq-published"] });
    },
    onError: () => toast.error(fr ? "Envoi impossible." : "Could not send."),
  });

  const items = published.data ?? [];

  return (
    <div className="card-hover-soft panel mt-6 space-y-5 p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
          <HelpCircle className="size-4" />
        </span>
        <h3 className="font-display text-lg font-semibold">
          {fr ? "Poser une question" : "Ask a question"}
        </h3>
      </div>

      {session ? (
        <div className="space-y-2">
          <Textarea
            value={text}
            maxLength={400}
            rows={3}
            placeholder={
              fr ? "Ta question sur SilenceCut…" : "Your question about SilenceCut…"
            }
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={text.trim().length < 5 || send.isPending}
              onClick={() => send.mutate()}
            >
              <Send className="size-4" />
              {fr ? "Envoyer" : "Send"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {fr ? "Connecte-toi pour poser une question. " : "Sign in to ask a question. "}
          <Link to="/auth" className="text-primary underline">
            {fr ? "Connexion" : "Sign in"}
          </Link>
        </p>
      )}

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {fr
              ? "Aucune question publiée pour le moment."
              : "No published question yet."}
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border/60 bg-card/40 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {item.initials}
                </span>
                <p className="text-sm font-medium">{item.question}</p>
              </div>
              {item.answer && (
                <div className="mt-3 rounded-lg bg-primary/10 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {fr ? "Réponse de SilenceCut" : "SilenceCut answer"}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.answer}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
