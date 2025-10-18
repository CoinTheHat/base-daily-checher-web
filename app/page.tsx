"use client";

import { useEffect, useMemo, useState } from "react";
import {
  WagmiConfig,
  configureChains,
  createConfig,
  useAccount,
  useReadContract,
  useWriteContract
} from "wagmi";
import { http } from "viem";
import { base } from "viem/chains";
import { OnchainKitProvider, ConnectWallet } from "@coinbase/onchainkit";
import abi from "../lib/DailyCheckerAbi.json";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT as `0x${string}`;

const { publicClient } = configureChains([base], [http()]);
const config = createConfig({ autoConnect: true, publicClient });

function CountdownUTC() {
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const msToReset = useMemo(() => {
    const n = new Date(now);
    const y = n.getUTCFullYear(), m = n.getUTCMonth(), d = n.getUTCDate();
    const tmr = new Date(Date.UTC(y, m, d + 1, 0, 0, 0));
    return Math.max(0, tmr.getTime() - n.getTime());
  }, [now]);
  const h = Math.floor(msToReset / 3600000);
  const mm = Math.floor((msToReset % 3600000) / 60000);
  const s = Math.floor((msToReset % 60000) / 1000);
  return <span>{String(h).padStart(2,"0")}:{String(mm).padStart(2,"0")}:{String(s).padStart(2,"0")}</span>;
}

function ICSButton() {
  const ics = [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//BaseDailyChecker//EN","BEGIN:VEVENT",
    "SUMMARY:Daily check-in (Base)","RRULE:FREQ=DAILY;BYHOUR=21;BYMINUTE=0;BYSECOND=0",
    "DTSTART:20250101T210000","END:VEVENT","END:VCALENDAR"
  ].join("\r\n");
  const blob = typeof window !== "undefined" ? new Blob([ics], { type: "text/calendar;charset=utf-8" }) : null;
  const url = blob ? URL.createObjectURL(blob) : "#";
  return (
    <a href={url} download="base-daily-checker.ics"
      className="inline-flex px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700">
      Add daily reminder (.ics)
    </a>
  );
}

function AppBody() {
  const { address, isConnected } = useAccount();
  const { data: status } = useReadContract({
    address: CONTRACT,
    abi,
    functionName: "viewStatus",
    args: [isConnected ? address! : "0x0000000000000000000000000000000000000000"]
  }) as { data: [ { lastDay: bigint, streak: bigint, best: bigint }, bigint ] | undefined };

  const { writeContractAsync, isPending } = useWriteContract();
  const today = status?.[1];
  const user = status?.[0];
  const lastDay = user ? Number(user.lastDay) : 0;
  const streak  = user ? Number(user.streak)  : 0;
  const best    = user ? Number(user.best)    : 0;

  const canCheckIn = isConnected && (lastDay !== Number(today));
  const checkIn = async () => { await writeContractAsync({ address: CONTRACT, abi, functionName: "checkIn" }); };
  const claim   = async (id: number) => { await writeContractAsync({ address: CONTRACT, abi, functionName: "claimBadge", args: [BigInt(id)] }); };

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100 px-6 py-10">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Base Daily Checker</h1>
          <ConnectWallet />
        </div>

        <div className="rounded-2xl bg-neutral-900 p-5 shadow">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-sm text-neutral-400">Current streak</p>
              <p className="text-4xl font-bold">{streak}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-neutral-400">Best</p>
              <p className="text-2xl font-semibold">{best}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-neutral-400">
              Next reset (UTC) in <span className="font-mono"><CountdownUTC /></span>
            </p>
            <button
              onClick={checkIn}
              disabled={!canCheckIn || isPending}
              className={`px-4 py-2 rounded-xl font-medium ${
                canCheckIn ? "bg-white text-black" : "bg-neutral-700 text-neutral-300 cursor-not-allowed"
              }`}
            >
              {canCheckIn ? (isPending ? "Checking..." : "Check-in") : "Already checked today"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-neutral-900 p-5 shadow">
          <p className="text-sm text-neutral-300 mb-3">Claim your badges</p>
          <div className="grid grid-cols-3 gap-3">
            {[7,30,120].map((id) => (
              <button key={id} onClick={() => claim(id)}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700"
                title={`Requires streak ≥ ${id}`}>
                {id}-day
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            You can claim once per badge when your current streak meets the threshold.
          </p>
        </div>

        <ICSButton />
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <WagmiConfig config={config}>
      <OnchainKitProvider chain={base}>
        <AppBody />
      </OnchainKitProvider>
    </WagmiConfig>
  );
}
