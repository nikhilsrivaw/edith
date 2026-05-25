import { describe, it, expect } from "vitest";
import { runV4Checks } from "./checks-v4";
import { buildTestProject } from "./test-utils";
import type { FetchedFile } from "./github-tree";

function runWith(files: FetchedFile[]) {
  return runV4Checks(buildTestProject(files), files);
}
function hasCheck(files: FetchedFile[], checkId: string) {
  return runWith(files).some((i) => i.checkId === checkId);
}

describe("checks-v4 · LLM-app footguns", () => {
  it("flags LLM call missing max_tokens", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/llm.ts",
            content: `
              const r = await openai.chat.completions.create({
                model: "gpt-4o", messages: [{role:"user",content:"hi"}],
              });`,
          },
        ],
        "ai_pattern/llm-no-max-tokens",
      ),
    ).toBe(true);
  });

  it("flags LLM call inside useEffect", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `"use client";
              import { useEffect } from "react";
              export default function C(){
                useEffect(()=>{
                  openai.chat.completions.create({ model:"gpt-4o", messages:[] });
                }, [q]);
                return null;
              }`,
          },
        ],
        "ai_pattern/llm-in-useeffect",
      ),
    ).toBe(true);
  });

  it("flags LLM call inside while loop", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/agent.ts",
            content: `
              async function loop(){
                while(true){
                  await client.messages.create({ model:"claude-haiku-4-5", messages:[] });
                }
              }`,
          },
        ],
        "ai_pattern/llm-in-loop",
      ),
    ).toBe(true);
  });

  it("flags system prompt in client component", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/chat.tsx",
            content: `"use client";
              const SYSTEM_PROMPT = "You are a helpful agent.";
              export default function C(){ return null; }`,
          },
        ],
        "ai_pattern/system-prompt-in-client",
      ),
    ).toBe(true);
  });

  it("flags raw user input in prompt template", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/p.ts",
            content:
              "const prompt = `system: be brief. user: ${userInput}`;",
          },
        ],
        "ai_pattern/prompt-injection-risk",
      ),
    ).toBe(true);
  });

  it("flags hardcoded ancient model", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/m.ts",
            content: `const MODEL = "gpt-3.5-turbo";`,
          },
        ],
        "ai_pattern/ancient-model",
      ),
    ).toBe(true);
  });

  it("flags streaming consumer without AbortController", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/s.ts",
            content: `
              async function read(res: Response){
                const reader = res.body.getReader();
                while(true){ const {done} = await reader.read(); if(done) break; }
              }`,
          },
        ],
        "ai_pattern/streaming-no-abort",
      ),
    ).toBe(true);
  });

  it("flags tool dispatcher without allowlist", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/t.ts",
            content: `
              async function run(tools: any, name: string, args: any){
                return tools[name](args);
              }`,
          },
        ],
        "ai_pattern/tool-no-allowlist",
      ),
    ).toBe(true);
  });

  it("flags embeddings call with no cache", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/e.ts",
            content: `
              async function embed(t: string){
                return openai.embeddings.create({ model:"text-embedding-3-small", input:t });
              }`,
          },
        ],
        "ai_pattern/embedding-no-cache",
      ),
    ).toBe(true);
  });

  it("flags uncapped conversation history", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/c.ts",
            content: `
              const messages: any[] = [];
              export function add(m: any){ messages.push(m); }`,
          },
        ],
        "ai_pattern/uncapped-conversation",
      ),
    ).toBe(true);
  });

  it("flags dangerouslySetInnerHTML near LLM response", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `
              export default function C({completion}: {completion: string}){
                return <div dangerouslySetInnerHTML={{ __html: completion }} />;
              }`,
          },
        ],
        "ai_pattern/llm-dangerously-set-html",
      ),
    ).toBe(true);
  });

  it("flags missing temperature in scoring flow", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/scoring.ts",
            content: `
              await openai.chat.completions.create({
                model: "gpt-4o", max_tokens: 100, messages: []
              });`,
          },
        ],
        "ai_pattern/missing-temperature",
      ),
    ).toBe(true);
  });
});

describe("checks-v4 · React / Next.js", () => {
  it("flags 'use client' without any client APIs", () => {
    expect(
      hasCheck(
        [
          {
            path: "components/static.tsx",
            content: `"use client";
              export function Static(){ return <div>static text</div>; }`,
          },
        ],
        "performance/use-client-unneeded",
      ),
    ).toBe(true);
  });

  it("flags client page.tsx fetching in useEffect", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/dashboard/page.tsx",
            content: `"use client";
              import { useEffect, useState } from "react";
              export default function Page(){
                const [d,setD] = useState(null);
                useEffect(()=>{ fetch("/api/x").then(r=>r.json()).then(setD); }, []);
                return null;
              }`,
          },
        ],
        "performance/client-fetch-in-page",
      ),
    ).toBe(true);
  });

  it("flags useState initialised from prop", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `
              import { useState } from "react";
              export function C({ value }: { value: number }){
                const [v] = useState(value);
                return <div>{v}</div>;
              }`,
          },
        ],
        "reliability/use-state-from-prop",
      ),
    ).toBe(true);
  });

  it("flags useEffect with inline object dep", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `
              import { useEffect } from "react";
              export function C(){ useEffect(()=>{}, [{ a: 1 }]); return null; }`,
          },
        ],
        "reliability/useeffect-object-dep",
      ),
    ).toBe(true);
  });

  it("flags useState(expensive())", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `
              import { useState } from "react";
              function expensive(){ return 1; }
              export function C(){ const [s] = useState(expensive()); return <div>{s}</div>; }`,
          },
        ],
        "performance/usestate-expensive-init",
      ),
    ).toBe(true);
  });

  it("flags stale-closure useEffect (setX(X+1) with missing dep)", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `
              import { useEffect, useState } from "react";
              export function C(){
                const [count, setCount] = useState(0);
                useEffect(()=>{
                  const id = setInterval(()=> setCount(count + 1), 1000);
                  return ()=> clearInterval(id);
                }, []);
                return null;
              }`,
          },
        ],
        "reliability/useeffect-stale-closure",
      ),
    ).toBe(true);
  });

  it("flags non-public process.env in client component", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `"use client";
              const k = process.env.STRIPE_SECRET;
              export default function C(){ return null; }`,
          },
        ],
        "deploy_readiness/client-non-public-env",
      ),
    ).toBe(true);
  });

  it("flags notFound() in client component", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `"use client";
              import { notFound } from "next/navigation";
              export default function C(){ if(!1) notFound(); return null; }`,
          },
        ],
        "reliability/next-rsc-only-in-client",
      ),
    ).toBe(true);
  });

  it("flags cookies() without await", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/auth.ts",
            content: `
              import { cookies } from "next/headers";
              export function getToken(){ const c = cookies(); return c.get("x"); }`,
          },
        ],
        "reliability/next15-unawaited-cookies",
      ),
    ).toBe(true);
  });

  it("flags 'use server' action with no auth check", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/actions.ts",
            content: `"use server";
              export async function deleteAll(){ await db.users.deleteMany({}); }`,
          },
        ],
        "security/server-action-no-auth",
      ),
    ).toBe(true);
  });

  it("flags <Image> without width/height", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `
              import Image from "next/image";
              export default function C(){ return <Image src="/x.png" alt="x" />; }`,
          },
        ],
        "performance/image-no-size",
      ),
    ).toBe(true);
  });

  it("flags route with await but no loading.tsx + error.tsx", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/dashboard/page.tsx",
            content: `
              export default async function Page(){
                const d = await fetchData();
                return <div>{d.x}</div>;
              }`,
          },
        ],
        "reliability/missing-route-boundaries",
      ),
    ).toBe(true);
  });
});

describe("checks-v4 · Database", () => {
  it("flags DB client at module scope in API route", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/users/route.ts",
            content: `
              import { PrismaClient } from "@prisma/client";
              const prisma = new PrismaClient();
              export async function GET(){ return Response.json(await prisma.user.findMany()); }`,
          },
        ],
        "reliability/db-client-at-module-scope",
      ),
    ).toBe(true);
  });

  it("flags SELECT *", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/q.ts",
            content: `const q = "select * from users where id = $1";`,
          },
        ],
        "performance/select-star",
      ),
    ).toBe(true);
  });

  it("flags await in DB loop (N+1)", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/q.ts",
            content: `
              async function f(ids: number[]){
                const out: any[] = [];
                for (const id of ids){
                  out.push(await prisma.user.findUnique({ where:{ id } }));
                }
              }`,
          },
        ],
        "performance/await-in-loop-db",
      ),
    ).toBe(true);
  });

  it("flags SELECT without LIMIT", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/q.ts",
            content: "const sql = `select id, email from users`;",
          },
        ],
        "performance/select-no-limit",
      ),
    ).toBe(true);
  });

  it("flags FK without index", () => {
    expect(
      hasCheck(
        [
          {
            path: "supabase/migrations/0001.sql",
            content: `
              create table public.orders (
                id uuid primary key,
                user_id uuid references users(id)
              );`,
          },
        ],
        "performance/fk-no-index",
      ),
    ).toBe(true);
  });

  it("flags multi-table writes without transaction", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/q.ts",
            content: `
              async function f(){
                await prisma.user.create({ data: {} });
                await prisma.post.create({ data: {} });
              }`,
          },
        ],
        "data_safety/multi-write-no-transaction",
      ),
    ).toBe(true);
  });

  it("flags UNIQUE missing on email column", () => {
    expect(
      hasCheck(
        [
          {
            path: "supabase/migrations/0001.sql",
            content: `
              create table public.users (
                id uuid primary key,
                email text not null
              );`,
          },
        ],
        "data_safety/unique-constraint-missing",
      ),
    ).toBe(true);
  });

  it("flags plain 'password' column", () => {
    expect(
      hasCheck(
        [
          {
            path: "supabase/migrations/0001.sql",
            content: `
              create table users (
                id uuid primary key,
                password text not null
              );`,
          },
        ],
        "security/password-not-hashed-column",
      ),
    ).toBe(true);
  });

  it("flags bcrypt with low rounds", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/auth.ts",
            content: `
              import bcrypt from "bcrypt";
              export async function hash(pw: string){ return bcrypt.hash(pw, 4); }`,
          },
        ],
        "security/bcrypt-low-rounds",
      ),
    ).toBe(true);
  });

  it("flags created_at without default", () => {
    expect(
      hasCheck(
        [
          {
            path: "supabase/migrations/0001.sql",
            content: `
              create table x (
                id uuid primary key,
                created_at timestamp with time zone
              );`,
          },
        ],
        "data_safety/created-at-no-default",
      ),
    ).toBe(true);
  });
});

describe("checks-v4 · Auth / Session", () => {
  it("flags JWT in localStorage", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `"use client";
              export function login(t: string){ localStorage.setItem("auth_token", t); }`,
          },
        ],
        "security/jwt-in-localstorage",
      ),
    ).toBe(true);
  });

  it("flags jwt.sign without expiresIn", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/auth.ts",
            content: `
              import jwt from "jsonwebtoken";
              export function sign(u: any){ return jwt.sign({ sub: u.id }, "secret"); }`,
          },
        ],
        "security/jwt-no-expiry",
      ),
    ).toBe(true);
  });

  it("flags shared secret for access + refresh", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/auth.ts",
            content: `
              import jwt from "jsonwebtoken";
              export function access(u: any){ return jwt.sign({ sub:u.id }, process.env.JWT_SECRET!, { expiresIn:"15m" }); }
              export function refresh(u: any){ return jwt.sign({ sub:u.id, type:"refresh" }, process.env.JWT_SECRET!, { expiresIn:"30d" }); }`,
          },
        ],
        "security/shared-jwt-secret",
      ),
    ).toBe(true);
  });

  it("flags jwt.verify without audience/issuer", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/auth.ts",
            content: `
              import jwt from "jsonwebtoken";
              export function verify(t: string){ return jwt.verify(t, process.env.JWT_SECRET!); }`,
          },
        ],
        "security/jwt-verify-loose",
      ),
    ).toBe(true);
  });

  it("flags OAuth callback without state comparison", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/auth/callback/route.ts",
            content: `
              export async function GET(req: Request){
                const url = new URL(req.url);
                const state = url.searchParams.get("state");
                return Response.json({ state });
              }`,
          },
        ],
        "security/oauth-no-state-check",
      ),
    ).toBe(true);
  });

  it("flags reset token without expiry", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/reset/route.ts",
            content: `
              import crypto from "crypto";
              export async function POST(){ const token = crypto.randomUUID(); return Response.json({ token }); }`,
          },
        ],
        "security/reset-token-no-expiry",
      ),
    ).toBe(true);
  });

  it("flags logout that only clears cookie", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/logout/route.ts",
            content: `
              import { cookies } from "next/headers";
              export async function POST(){ const c = await cookies(); c.delete("session"); return Response.json({ ok:true }); }`,
          },
        ],
        "security/logout-client-only",
      ),
    ).toBe(true);
  });

  it("flags Math.random for token", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/t.ts",
            content: `
              export function makeToken(){ return Math.random().toString(36).slice(2); }`,
          },
        ],
        "security/math-random-token",
      ),
    ).toBe(true);
  });
});

describe("checks-v4 · Async / error handling", () => {
  it("flags await res.json() without res.ok", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/q.ts",
            content: `
              async function get(){
                const res = await fetch("/api/x");
                const data = await res.json();
                return data;
              }`,
          },
        ],
        "reliability/res-json-no-ok",
      ),
    ).toBe(true);
  });

  it("flags floating promise from fetch", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/x.ts",
            content: `
              function go(){
                fetch("/api/x");
                return 1;
              }`,
          },
        ],
        "reliability/floating-promise",
      ),
    ).toBe(true);
  });

  it("flags Promise.all over mutations", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/x.ts",
            content: `
              async function f(){
                await Promise.all([
                  prisma.user.create({ data:{} }),
                  prisma.post.create({ data:{} }),
                ]);
              }`,
          },
        ],
        "data_safety/promise-all-mutations",
      ),
    ).toBe(true);
  });

  it("flags fetch in useEffect without AbortController", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `"use client";
              import { useEffect } from "react";
              export function C(){ useEffect(()=>{ fetch("/api/x"); }, []); return null; }`,
          },
        ],
        "reliability/useeffect-fetch-no-abort",
      ),
    ).toBe(true);
  });

  it("flags pointless rethrow catch", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/x.ts",
            content: `
              function f(){ try { return 1; } catch (e) { throw e; } }`,
          },
        ],
        "reliability/pointless-rethrow",
      ),
    ).toBe(true);
  });

  it("flags error.message returned to client", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/x/route.ts",
            content: `
              export async function GET(){
                try { throw new Error("db down"); }
                catch (error: any) { return Response.json({ error: error.message }, { status: 500 }); }
              }`,
          },
        ],
        "security/error-message-leak",
      ),
    ).toBe(true);
  });
});

describe("checks-v4 · Build / deploy", () => {
  it("flags missing engines.node in package.json", () => {
    expect(
      hasCheck(
        [
          { path: "package.json", content: `{ "name":"x", "version":"1" }` },
        ],
        "deploy_readiness/missing-engines-node",
      ),
    ).toBe(true);
  });

  it("flags missing lockfile", () => {
    expect(
      hasCheck(
        [{ path: "package.json", content: `{ "name":"x" }` }],
        "deploy_readiness/missing-lockfile",
      ),
    ).toBe(true);
  });

  it("flags output:'export' with route handlers", () => {
    expect(
      hasCheck(
        [
          {
            path: "next.config.js",
            content: `module.exports = { output: 'export' };`,
          },
          {
            path: "app/api/x/route.ts",
            content: `export async function GET(){ return Response.json({}); }`,
          },
        ],
        "deploy_readiness/static-export-with-routes",
      ),
    ).toBe(true);
  });

  it("flags missing .gitignore", () => {
    expect(
      hasCheck(
        [{ path: "package.json", content: `{ "name":"x" }` }],
        "deploy_readiness/no-gitignore",
      ),
    ).toBe(true);
  });

  it("flags next.config without headers()", () => {
    expect(
      hasCheck(
        [
          {
            path: "next.config.js",
            content: `module.exports = { reactStrictMode: true };`,
          },
        ],
        "security/no-next-config-headers",
      ),
    ).toBe(true);
  });
});

describe("checks-v4 · File upload", () => {
  it("flags upload route with no MIME validation", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/upload/route.ts",
            content: `
              export async function POST(req: Request){
                const form = await req.formData();
                const file = form.get("file");
                return Response.json({ ok:true });
              }`,
          },
        ],
        "security/upload-no-mime-validation",
      ),
    ).toBe(true);
  });

  it("flags upload route with no size cap", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/upload/route.ts",
            content: `
              export async function POST(req: Request){
                const form = await req.formData();
                const file = form.get("file") as File;
                if (file.type !== "image/png") return Response.json({ err: "mime" });
                return Response.json({ ok:true });
              }`,
          },
        ],
        "security/upload-no-size-limit",
      ),
    ).toBe(true);
  });

  it("flags user filename written to disk", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/upload/route.ts",
            content: `
              import fs from "fs";
              export async function POST(req: Request){
                const form = await req.formData();
                const file: any = form.get("file");
                fs.writeFileSync("./uploads/" + file.name, Buffer.from(await file.arrayBuffer()));
                return Response.json({ ok:true });
              }`,
          },
        ],
        "security/upload-path-traversal",
      ),
    ).toBe(true);
  });

  it("flags S3 ACL public-read", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/s3.ts",
            content: `
              import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
              const s3 = new S3Client({});
              export async function upload(k: string, body: Buffer){
                return s3.send(new PutObjectCommand({ Bucket:"x", Key:k, Body:body, ACL:"public-read" }));
              }`,
          },
        ],
        "security/s3-public-read",
      ),
    ).toBe(true);
  });

  it("flags image upload not re-encoded", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/image/upload/route.ts",
            content: `
              import fs from "fs";
              export async function POST(req: Request){
                const form = await req.formData();
                const f: any = form.get("file");
                fs.writeFileSync("./uploads/x.png", Buffer.from(await f.arrayBuffer()));
                return Response.json({ ok:true });
              }`,
          },
        ],
        "security/image-no-reencoding",
      ),
    ).toBe(true);
  });
});

describe("checks-v4 · Rate limit / DoS", () => {
  it("flags login route with no rate limit", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/login/route.ts",
            content: `
              export async function POST(req: Request){
                const { email, password } = await req.json();
                return Response.json({ ok:true });
              }`,
          },
        ],
        "security/login-no-rate-limit",
      ),
    ).toBe(true);
  });

  it("flags signup route with no protection", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/signup/route.ts",
            content: `
              export async function POST(req: Request){
                const body = await req.json();
                return Response.json({ ok:true });
              }`,
          },
        ],
        "security/signup-no-protection",
      ),
    ).toBe(true);
  });

  it("flags POST route with no body-size cap", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/data/route.ts",
            content: `
              export async function POST(req: Request){
                const body = await req.json();
                return Response.json({ ok:true });
              }`,
          },
        ],
        "reliability/route-no-body-limit",
      ),
    ).toBe(true);
  });

  it("flags LLM route with no maxDuration", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/chat/route.ts",
            content: `
              import OpenAI from "openai";
              const openai = new OpenAI();
              export async function POST(req: Request){
                const r = await openai.chat.completions.create({ model:"gpt-4o", messages:[], max_tokens:100, temperature:0 });
                return Response.json(r);
              }`,
          },
        ],
        "reliability/route-no-max-duration",
      ),
    ).toBe(true);
  });
});

describe("checks-v4 · Email / verification", () => {
  it("flags verification link without expiry", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/verify/route.ts",
            content: `
              import crypto from "crypto";
              export async function POST(){
                const token = crypto.randomUUID();
                const url = "https://x.test/verify?token=" + token;
                return Response.json({ url });
              }`,
          },
        ],
        "security/verify-link-no-expiry",
      ),
    ).toBe(true);
  });

  it("flags reusable reset token", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/reset/route.ts",
            content: `
              export async function POST(req: Request){
                const { token, password } = await req.json();
                await db.user.update({ where:{ resetToken: token }, data:{ password } });
                return Response.json({ ok:true });
              }`,
          },
        ],
        "security/reset-token-reusable",
      ),
    ).toBe(true);
  });

  it("flags HTML email with unsanitised user content", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/email.ts",
            content: `
              import { Resend } from "resend";
              const resend = new Resend();
              export async function send(name: string){
                await resend.emails.send({
                  from: "x", to: "y", subject: "hi",
                  html: \`<p>Hello \${name}</p>\`,
                });
              }`,
          },
        ],
        "security/email-html-injection",
      ),
    ).toBe(true);
  });
});

describe("checks-v4 · Privacy / compliance", () => {
  it("flags analytics initialised without consent", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `"use client";
              import posthog from "posthog-js";
              posthog.init("phc_x", { api_host:"https://app.posthog.com" });
              export default function C(){ return null; }`,
          },
        ],
        "data_safety/analytics-no-consent",
      ),
    ).toBe(true);
  });

  it("flags missing privacy/terms links", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/layout.tsx",
            content: `
              export default function Layout({ children }: any){
                return <html><body>{children}<footer>© 2026</footer></body></html>;
              }`,
          },
        ],
        "data_safety/no-legal-links",
      ),
    ).toBe(true);
  });

  it("flags missing account delete endpoint", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/signup/route.ts",
            content: `export async function POST(){ return Response.json({}); }`,
          },
        ],
        "data_safety/no-account-delete",
      ),
    ).toBe(true);
  });

  it("flags missing account export endpoint", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/api/auth/signup/route.ts",
            content: `export async function POST(){ return Response.json({}); }`,
          },
          {
            path: "app/api/account/delete/route.ts",
            content: `export async function POST(){ return Response.json({}); }`,
          },
        ],
        "data_safety/no-account-export",
      ),
    ).toBe(true);
  });

  it("flags PII included in console.error", () => {
    expect(
      hasCheck(
        [
          {
            path: "lib/x.ts",
            content: `
              function f(user: any, error: any){ console.error("login failed", { user, error }); }`,
          },
        ],
        "data_safety/pii-in-error-log",
      ),
    ).toBe(true);
  });
});

describe("checks-v4 · Accessibility", () => {
  it("flags <div onClick> used as button", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `
              export default function C(){ return <div onClick={()=>{}}>click</div>; }`,
          },
        ],
        "reliability/div-as-button",
      ),
    ).toBe(true);
  });

  it("flags <img> without alt", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `
              export default function C(){ return <img src="/x.png" />; }`,
          },
        ],
        "reliability/img-no-alt",
      ),
    ).toBe(true);
  });

  it("flags <input> with no label / aria-label", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `
              export default function C(){ return <input type="text" placeholder="email" />; }`,
          },
        ],
        "reliability/input-no-label",
      ),
    ).toBe(true);
  });

  it("flags heading skip h1 -> h3", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/page.tsx",
            content: `
              export default function P(){ return (<><h1>X</h1><h3>Y</h3></>); }`,
          },
        ],
        "reliability/heading-skip",
      ),
    ).toBe(true);
  });

  it("flags color-only state", () => {
    expect(
      hasCheck(
        [
          {
            path: "app/c.tsx",
            content: `
              export default function C(){
                return (<div>
                  <span className="text-red-500">Error</span>
                  <span className="text-green-500">OK</span>
                </div>);
              }`,
          },
        ],
        "reliability/color-only-state",
      ),
    ).toBe(true);
  });

  it("flags Modal with no aria-modal / focus trap", () => {
    expect(
      hasCheck(
        [
          {
            path: "components/Modal.tsx",
            content: `
              export function Modal({ open, children }: any){
                if (!open) return null;
                return <div className="fixed inset-0">{children}</div>;
              }`,
          },
        ],
        "reliability/modal-no-aria",
      ),
    ).toBe(true);
  });
});
