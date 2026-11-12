import type { Metadata } from "next";

import { LogoSeal } from "@/components/layout/logo-seal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PhotoFrame, PhotoPlaceholder } from "@/components/ui/photo-frame";
import { Seal, Stamp } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { TextField } from "@/components/ui/text-field";

export const metadata: Metadata = {
  title: "Guia de estilo",
  robots: { index: false },
};

const palette = [
  { name: "Verde Paidabartira", token: "verde", className: "bg-verde", hex: "#1F3D2B" },
  { name: "Preto", token: "preto", className: "bg-preto", hex: "#141414" },
  { name: "Verde-musgo", token: "musgo", className: "bg-musgo", hex: "#4A6B4F" },
  { name: "Creme", token: "creme", className: "bg-creme", hex: "#F4ECD8" },
  { name: "Papel envelhecido", token: "papel", className: "bg-papel", hex: "#E6D9BC" },
  { name: "Sépia", token: "sepia", className: "bg-sepia", hex: "#8A6F4D" },
  { name: "Sépia escuro (texto)", token: "sepia-escuro", className: "bg-sepia-escuro", hex: "#5E4A30" },
  { name: "Mostarda", token: "mostarda", className: "bg-mostarda", hex: "#C2963F" },
  { name: "Vinho (alertas)", token: "vinho", className: "bg-vinho", hex: "#6B1F2A" },
];

/** Vitrine dos componentes, para revisar a identidade visual em um só lugar. */
export default function StyleGuidePage() {
  return (
    <div className="flex flex-col gap-12">
      <SectionHeading as="h1" kicker="Identidade visual" title="Guia de estilo" />

      <section className="flex flex-col gap-4">
        <SectionHeading number="01" title="Paleta" />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {palette.map((color) => (
            <li key={color.token} className="border border-sepia bg-creme">
              <div className={`h-20 ${color.className}`} />
              <div className="p-2">
                <p className="font-semibold">{color.name}</p>
                <p className="rotulo text-sepia-escuro">{color.hex}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading number="02" title="Tipografia" />
        <p className="font-display text-4xl font-bold">Fraunces para títulos</p>
        <p>Source Sans 3 para o texto corrido e a interface, com boa leitura em telas pequenas.</p>
        <p className="rotulo">Courier Prime · datas, legendas e carimbos</p>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading number="03" title="Logotipo, selos e carimbos" />
        <div className="flex flex-wrap items-center gap-6">
          <LogoSeal size={120} />
          <Seal>Atual morador</Seal>
          <Seal tone="preto">Ex-morador</Seal>
          <Seal tone="vinho">Fundador</Seal>
          <Stamp>Cancelado</Stamp>
          <Stamp tone="verde">Confirmado</Stamp>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading number="04" title="Botões e formulário" />
        <div className="flex flex-wrap gap-3">
          <Button>Principal</Button>
          <Button variant="dark">Escuro</Button>
          <Button variant="outline">Contorno</Button>
          <Button disabled>Desativado</Button>
        </div>
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <TextField name="exemplo" label="Campo" hint="Texto de ajuda." placeholder="Exemplo" />
          <TextField name="exemplo-erro" label="Campo com erro" error="Mensagem de erro." />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading number="05" title="Cartões, avisos e fotos" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h3 className="text-xl font-semibold">Cartão</h3>
            <p className="mt-2">Superfície de papel para agrupar conteúdo.</p>
          </Card>
          <div className="flex flex-col gap-3">
            <Notice>Aviso informativo.</Notice>
            <Notice tone="success">Operação concluída.</Notice>
            <Notice tone="error">Algo deu errado.</Notice>
          </div>
        </div>
        <div className="grid max-w-2xl grid-cols-2 gap-8 pt-2">
          <PhotoFrame caption="Legenda · ano" tilt="left">
            <PhotoPlaceholder label="Foto" />
          </PhotoFrame>
          <PhotoFrame caption="Legenda · ano" tilt="right">
            <PhotoPlaceholder label="Foto" />
          </PhotoFrame>
        </div>
      </section>
    </div>
  );
}
