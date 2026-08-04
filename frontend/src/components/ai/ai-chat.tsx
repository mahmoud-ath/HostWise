"use client";

import { useEffect, useRef, useState } from "react";
import { ReportSection } from "@/components/reports/report-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAIChat } from "@/hooks/use-api";
import { Sparkles, Send, Loader2 } from "lucide-react";
import type { ChatResult } from "@/lib/ai-types";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTED = [
  "What is my least profitable property?",
  "Why did revenue decrease in June?",
  "How can I increase revenue?",
  "Which expenses should I reduce?",
  "What pricing strategy do you recommend?",
];

export function AIChat({ year }: { year: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const chat = useAIChat();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chat.isPending]);

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || chat.isPending) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    chat.mutate(
      { question: q, year },
      {
        onSuccess: (res: ChatResult) =>
          setMessages((m) => [...m, { role: "assistant", text: res.answer }]),
        onError: () =>
          setMessages((m) => [
            ...m,
            { role: "assistant", text: "Sorry, I couldn't answer that right now. Please try again." },
          ]),
      }
    );
  };

  return (
    <ReportSection
      title="Ask HostWise AI"
      icon={<Sparkles className="h-5 w-5" />}
      description="Natural-language questions about your portfolio"
      action={<Badge variant="secondary">Beta</Badge>}
    >
      <div className="flex h-[440px] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <p className="max-w-md text-sm text-muted-foreground">
                Ask about your least profitable property, why revenue changed, how to
                improve occupancy, or what to do about expenses.
              </p>
              <div className="flex max-w-lg flex-wrap justify-center gap-2">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {chat.isPending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing your portfolio...
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask HostWise AI..."
            className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" disabled={!input.trim() || chat.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </ReportSection>
  );
}
