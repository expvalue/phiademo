"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const CATEGORY_FILTERS = ["All", "Electronics", "Fashion", "Home", "Beauty", "Travel", "Fitness"];
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

type Match = {
  friendName: string;
  eventType: "purchase" | "view";
  distance: number | null;
  timestamp: string;
  productTitle: string;
};

type Explanation = {
  summary: string;
  semanticScore: number | null;
  friendStrength: number;
  recencyScore: number;
  eventWeight: number;
  lexicalBoost: number;
  matches: Match[];
};

type Recommendation = {
  id: number;
  title: string;
  brand: string;
  category: string;
  price: string;
  description: string;
  friendName: string;
  friendAvatar: string;
  eventType: "purchase" | "view";
  confidence: string;
  distance: number | null;
  similarity: number | null;
  score: number;
  explanation: Explanation;
};

const eventVerb = (eventType: "purchase" | "view") => (eventType === "purchase" ? "bought" : "viewed");

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Recommended for you based on your friends");
  const [mode, setMode] = useState("social");
  const [provider, setProvider] = useState("voyage");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams();
      if (activeQuery) params.set("q", activeQuery);
      if (activeCategory !== "All") params.set("category", activeCategory);
      params.set("limit", "12");

      setLoading(true);
      setErrorMessage("");
      fetch(`${API_BASE}/api/recommendations?${params.toString()}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to fetch recommendations");
          }
          return res.json();
        })
        .then((data) => {
          setItems(data.items ?? []);
          setMode(data.mode ?? "social");
          setProvider(data.embeddingProvider ?? "voyage");
          setStatus(
            activeQuery
              ? `Top matches for “${activeQuery}” from your friends' activity`
              : "Recommended for you based on your friends"
          );
        })
        .catch(() => {
          setItems([]);
          setMode(activeQuery ? "semantic" : "social");
          setStatus(activeQuery ? `No matches for “${activeQuery}”` : "Recommended for you based on your friends");
          setErrorMessage("Semantic search is unavailable right now.");
        })
        .finally(() => setLoading(false));
    }, 350);

    return () => clearTimeout(handler);
  }, [activeQuery, activeCategory]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveQuery(query.trim());
  };

  const friendsHighlight = useMemo(() => {
    const names = Array.from(new Set(items.map((item) => item.friendName))).slice(0, 3);
    return names.join(", ");
  }, [items]);

  const semanticBadgeLabel =
    mode === "semantic"
      ? `Semantic mode: ${provider === "fallback" ? "Fallback" : "Voyage"}`
      : "Feed mode: Social";

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-hero">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">phiademo</p>
            <h1 className="text-2xl font-semibold text-slate-900">Social semantic product recommendations</h1>
          </div>
          <Button variant="outline" size="sm">
            <Sparkles className="mr-2 h-4 w-4" /> Live Demo
          </Button>
        </header>

        <section className="mx-auto w-full max-w-6xl px-6 pb-12">
          <div className="glass rounded-[32px] border border-white/60 p-8 shadow-soft">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <h2 className="text-3xl font-semibold text-slate-900">Find the perfect pick through your friends.</h2>
                <p className="max-w-xl text-sm text-slate-500">
                  phiademo blends social proof with semantic search. Ask for what you want and see why your
                  friends' purchases or views are the best signal.
                </p>
              </div>
              <div className="min-w-[280px] rounded-3xl bg-white/80 p-4">
                <p className="text-xs font-semibold text-slate-500">Signal blend</p>
                <p className="mt-2 text-sm text-slate-700">Voyage embeddings · Chroma similarity · Friend recency</p>
                <p className="mt-4 text-xs text-slate-400">Confidence uses vector distance thresholds</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-12 rounded-full border border-slate-200 bg-white pl-11 text-sm"
                  placeholder="What are you looking for?"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Button type="submit" className="h-12 rounded-full px-8 text-sm font-semibold">
                Explore feed
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap gap-2">
              {CATEGORY_FILTERS.map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  variant={activeCategory === filter ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setActiveCategory(filter)}
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{status}</h3>
            <p className="text-sm text-slate-500">
              {friendsHighlight ? `Highlights from ${friendsHighlight}` : "Powered by your friends' activity"}
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full px-4 py-2 text-xs">
            {semanticBadgeLabel}
          </Badge>
        </div>

        {errorMessage ? (
          <p className="mt-6 text-sm text-rose-500">{errorMessage}</p>
        ) : null}

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, idx) => (
                <div key={`skeleton-${idx}`} className="h-72 animate-pulse rounded-3xl bg-white/60" />
              ))
            : items.map((item) => (
                <Card key={item.id} className="rounded-3xl border border-slate-100 bg-white shadow-soft">
                  <CardHeader className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-400">{item.category}</p>
                        <h4 className="text-lg font-semibold text-slate-900">{item.title}</h4>
                        <p className="text-sm text-slate-500">{item.brand}</p>
                      </div>
                      <Badge className="rounded-full bg-slate-900 text-white">{item.confidence}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">{item.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>${item.price}</span>
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.eventType}</span>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={item.friendAvatar} />
                        <AvatarFallback>{item.friendName[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">Because {item.friendName}</p>
                        <p className="text-xs text-slate-500">
                          {item.friendName} {eventVerb(item.eventType)} {item.title}
                        </p>
                      </div>
                    </div>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full rounded-full text-sm">
                          Why this?
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Why this recommendation?</DialogTitle>
                          <DialogDescription>{item.explanation.summary}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 text-sm text-slate-600">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold uppercase text-slate-400">Semantic score</p>
                              <p>{item.explanation.semanticScore ?? "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase text-slate-400">Distance</p>
                              <p>{item.distance?.toFixed(3) ?? "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase text-slate-400">Friend strength</p>
                              <p>{item.explanation.friendStrength}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase text-slate-400">Recency</p>
                              <p>{item.explanation.recencyScore}</p>
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase text-slate-400">Top friend matches</p>
                            <ul className="mt-2 space-y-2">
                              {item.explanation.matches.map((match, idx) => (
                                <li key={`${item.id}-match-${idx}`} className="flex items-center justify-between">
                                  <span>
                                    {match.friendName} {eventVerb(match.eventType)} {match.productTitle}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {match.distance !== null ? match.distance.toFixed(3) : "—"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <p>
                            This item ranked highly because its semantic match dominated the score while friend
                            strength and recency gave it an extra boost.
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              ))}
        </div>
        {!loading && items.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">No recommendations yet. Try a different query or category.</p>
        ) : null}
      </section>
    </div>
  );
}
