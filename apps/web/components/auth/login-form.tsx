"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const maxAge = 60 * 60 * 24;

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("superadmin@reservasi.local");
  const [password, setPassword] = useState("dev-password");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { token, user } = await login({ email, password });
      localStorage.setItem("reservasi_token", token);
      localStorage.setItem("reservasi_user", JSON.stringify(user));
      setCookie("reservasi_role", user.role);
      setCookie("reservasi_email", user.email);
      if (user.restaurantSlug) {
        setCookie("reservasi_restaurant_slug", user.restaurantSlug);
      }

      const requestedNext = searchParams.get("next");
      const fallback = user.role === "SUPER_ADMIN" ? "/super-admin" : `/admin?slug=${user.restaurantSlug ?? "teras-rempah"}`;
      const next = requestedNext && isAllowedNext(requestedNext, user.role) ? requestedNext : fallback;
      router.replace(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f9fc] px-4 py-10 text-[#061b31]">
      <div className="mx-auto mb-8 max-w-md text-center">
        <p className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#533afd]">Reservasi Online</p>
        <h1 className="mt-4 text-4xl font-light tracking-[-0.04em]">Login dashboard</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Masuk ke dashboard operasional resto.</p>
      </div>
      <Card className="mx-auto max-w-md border-[#e5edf5] shadow-[rgba(50,50,93,0.18)_0px_30px_45px_-30px]">
        <CardHeader>
          <CardTitle>Login Reservasi</CardTitle>
          <CardDescription>Masuk sebagai admin resto untuk kelola booking dan pembayaran.</CardDescription>
        </CardHeader>
        <CardContent>
          {message ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div> : null}
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Masuk..." : "Masuk"}
            </Button>
          </form>
          <div className="mt-5 rounded-2xl bg-slate-100/80 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-slate-700">Akun demo lokal:</p>
            <p>Admin resto: admin@terasrempah.local</p>
            <p>Password: dev-password</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function isAllowedNext(next: string, role: string) {
  if (next.startsWith("/super-admin")) return role === "SUPER_ADMIN";
  if (next.startsWith("/admin")) return role === "SUPER_ADMIN" || role === "RESTAURANT_ADMIN";
  return false;
}
