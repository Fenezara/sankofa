"use client";

/**
 * Sankofa — Charte éthique / CGU (modal, V2 restylé)
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShieldCheck, Lock, Database, AlertTriangle } from "lucide-react";
import { KitaBorder } from "@/components/cultural/kita-border";

interface PrivacyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrivacyDialog({ open, onOpenChange }: PrivacyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
        <KitaBorder thickness={5} />
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-text-on-light">
              <ShieldCheck className="size-5 text-terracotta" />
              Charte éthique & confidentialité
            </DialogTitle>
            <DialogDescription>
              Sankofa — Côte d'Ivoire. Version MVP démonstrative.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm text-text-on-light-soft mt-4">
            <section>
              <h3 className="font-semibold flex items-center gap-2 mb-1 text-text-accent">
                <Lock className="size-4" />
                1. Anonymat radical
              </h3>
              <p className="text-text-on-light-muted leading-relaxed">
                Sankofa ne te demande jamais ton nom, prénom, email, adresse ou numéro de
                téléphone personnel. À ta première visite, un identifiant aléatoire
                (UUID v4) est généré et stocké localement dans ton navigateur. Cet
                identifiant permet uniquement de garder le fil de ta conversation entre
                les sessions.
              </p>
            </section>

            <section>
              <h3 className="font-semibold flex items-center gap-2 mb-1 text-text-accent">
                <Database className="size-4" />
                2. Données stockées
              </h3>
              <ul className="text-text-on-light-muted space-y-1 list-disc pl-5">
                <li>Le contenu de tes messages (pour le fil de conversation et l'audit médical)</li>
                <li>Le niveau de triage estimé (info / orientation / urgence)</li>
                <li>Le protocole RAG injecté (slug)</li>
                <li>Le numéro Mobile Money masqué (4 derniers chiffres seulement, en cas de paiement)</li>
                <li>La date et l'heure des messages</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold flex items-center gap-2 mb-1 text-text-accent">
                <AlertTriangle className="size-4" />
                3. Ce que Sankofa ne fait PAS
              </h3>
              <ul className="text-text-on-light-muted space-y-1 list-disc pl-5">
                <li>Aucun diagnostic médical formel</li>
                <li>Aucune prescription d'ordonnance</li>
                <li>Aucune méthode d'avortement (loi CI)</li>
                <li>Aucune méthode d'automutilation ou de suicide</li>
                <li>Aucune publicité, aucune revente de données à un tiers</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1 text-text-accent">4. Cadre légal ivoirien</h3>
              <p className="text-text-on-light-muted leading-relaxed">
                Service d'orientation de santé sexuelle et reproductive opéré selon le
                <strong> Décret n° 2018-361 du 29 mars 2018</strong> portant réglementation
                de la télémédecine en Côte d'Ivoire. Les données personnelles (et
                particulièrement les données de santé, considérées comme sensibles) sont
                protégées au titre de la loi ARTCI 2013 (révisée 2024). Sankofa n'est pas un
                dispositif médical certifié — c'est un assistant IA d'orientation.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1 text-text-accent">5. Audit participatif</h3>
              <p className="text-text-on-light-muted leading-relaxed">
                12 jeunes ivoirien·ne·s rémunéré·e·s auditent les conversations de l'IA
                chaque semaine pour l'améliorer. Les conversations sont anonymisées avant
                audit. Aucune donnée identifiante n'est partagée.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1 text-text-accent">6. Effacement</h3>
              <p className="text-text-on-light-muted leading-relaxed">
                Tu peux à tout moment effacer ton historique local en vidant le localStorage
                de ton navigateur. Les messages stockés côté serveur sont conservés 90 jours
                à des fins d'audit médical anonymisé, puis supprimés automatiquement.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1 text-text-accent">7. Limites de responsabilité</h3>
              <p className="text-text-on-light-muted leading-relaxed">
                Les informations fournies par Sankofa le sont à titre d'orientation et
                éducatives. Elles ne remplacent pas une consultation médicale. En cas
                d'urgence vitale, appelle le <strong>185</strong> (SAMU) ou rends-toi aux
                urgences du CHU le plus proche.
              </p>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PrivacyDialog;
