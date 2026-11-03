"use client";

import { FileSignature, Gavel, Globe, Scale } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { RecordAgreementForm } from "@/components/RecordAgreementForm";
import { FileDisputeForm } from "@/components/FileDisputeForm";
import { AgreementViewer } from "@/components/AgreementViewer";
import { PrecedentBrowser } from "@/components/PrecedentBrowser";
import { ContractBanner } from "@/components/ContractBanner";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-24 pb-12 px-4 md:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-10 animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm text-accent mb-5">
              <Scale className="w-4 h-4" />
              #JusticeNeedsAnUpgrade
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              A courthouse
              <br className="hidden sm:block" />
              <span className="text-gradient-purple-pink">
                {" "}
                in a contract
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Record an agreement, file a dispute with evidence, and an on-chain AI panel
              renders an impartial, appealable verdict — grounded in evidence it can verify
              itself, by validator consensus, all on GenLayer.
            </p>
          </div>

          {/* Flagship: live web evidence */}
          <div className="mb-10 rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 to-[var(--blue)]/5 p-5 md:p-6 animate-fade-in">
            <div className="flex items-start gap-4">
              <span className="gradient-purple-pink rounded-lg p-2.5 flex text-white shrink-0">
                <Globe className="w-6 h-6" />
              </span>
              <div>
                <h2 className="font-bold text-lg mb-1">
                  The court can open the link itself
                </h2>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  Submit an <span className="text-accent font-medium">https URL</span> as
                  evidence and the contract fetches that page live during the ruling — then
                  every validator independently re-fetches and re-judges. A blockchain that
                  can check whether the file was really delivered or the record really says
                  what a party claims. No ordinary chain can read the web; GenLayer can.
                </p>
              </div>
            </div>
          </div>

          {/* Degraded state when the v2 contract address isn't set */}
          <ContractBanner />

          {/* How it works */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <HowStep
              icon={<FileSignature className="w-5 h-5" />}
              step="1"
              title="Record the agreement"
              body="Both parties and the plain-language terms are stored on-chain under an agreement ID."
            />
            <HowStep
              icon={<Gavel className="w-5 h-5" />}
              step="2"
              title="File a dispute with evidence"
              body="Attach text or live https URLs. Each item is committed by sha256 — tamper-evident and auditable."
            />
            <HowStep
              icon={<Scale className="w-5 h-5" />}
              step="3"
              title="Rule, appeal, set precedent"
              body="An AI panel rules by consensus; a loser can escalate to a larger panel (1 → 3 → 5). Finalized rulings become public precedent."
            />
          </div>

          {/* Write flows */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 animate-slide-up">
            <RecordAgreementForm />
            <FileDisputeForm />
          </div>

          {/* View + resolve + appeal flow */}
          <div className="animate-slide-up mb-6" style={{ animationDelay: "100ms" }}>
            <AgreementViewer />
          </div>

          {/* Public case law */}
          <div className="animate-slide-up" style={{ animationDelay: "150ms" }}>
            <PrecedentBrowser />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-4">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <a
              href="https://genlayer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
            >
              Powered by GenLayer
            </a>
            <a
              href="https://studio.genlayer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
            >
              Studio
            </a>
            <a
              href="https://docs.genlayer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
            >
              Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HowStep({
  icon,
  step,
  title,
  body,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="brand-card brand-card-hover p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="gradient-purple-pink rounded-lg p-2 flex text-white">{icon}</span>
        <span className="text-xs font-bold text-accent uppercase tracking-wider">
          Step {step}
        </span>
      </div>
      <h3 className="font-bold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
