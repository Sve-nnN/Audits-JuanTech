import { describe, expect, it } from "vitest";
import { validateEntities } from "./validateEntities";

describe("validateEntities (motor puro)", () => {
  it("marca una propiedad requerida faltante como error de propiedad y de entidad", () => {
    const [entity] = validateEntities([{ "@type": "Organization" }]);
    expect(entity?.type).toContain("Organization");
    const nameProp = entity?.properties.find((p) => p.name === "name");
    expect(nameProp?.status).toBe("error");
    expect(entity?.status).toBe("error");
    expect(entity?.issues.some((i) => i.status === "error")).toBe(true);
  });

  it("marca propiedades recomendadas faltantes como warning sin elevar a error", () => {
    const [entity] = validateEntities([{ "@type": "Organization", name: "Acme" }]);
    const nameProp = entity?.properties.find((p) => p.name === "name");
    expect(nameProp?.status).toBe("ok");
    const recommended = entity?.properties.filter((p) => ["url", "logo", "sameAs"].includes(p.name));
    expect(recommended?.every((p) => p.status === "warning")).toBe(true);
    expect(entity?.status).toBe("warning");
    expect(entity?.issues.some((i) => i.status === "error")).toBe(false);
  });

  it("Product con aggregateRating sin reviewCount genera advertencia (no error)", () => {
    const [entity] = validateEntities([
      {
        "@type": "Product",
        name: "Zapato",
        aggregateRating: { "@type": "AggregateRating", ratingValue: "4.5" },
      },
    ]);
    const antiPattern = entity?.issues.find((i) => i.message.includes("reviewCount"));
    expect(antiPattern?.status).toBe("warning");
    expect(entity?.status).not.toBe("error");
    expect(entity?.issues.some((i) => i.status === "error")).toBe(false);
  });

  it("Product con aggregateRating completo no genera el anti-patrón", () => {
    const [entity] = validateEntities([
      {
        "@type": "Product",
        name: "Zapato",
        image: "https://x.example/z.png",
        description: "Un zapato",
        offers: { "@type": "Offer", price: "10", priceCurrency: "USD" },
        brand: "Acme",
        aggregateRating: { "@type": "AggregateRating", ratingValue: "4.5", reviewCount: "12" },
      },
    ]);
    expect(entity?.issues.some((i) => i.message.includes("reviewCount"))).toBe(false);
  });

  it("BlogPosting sin author cae como error (author requerido) y sin datePublished como warning", () => {
    const [entity] = validateEntities([{ "@type": "BlogPosting", headline: "Hola" }]);
    const authorProp = entity?.properties.find((p) => p.name === "author");
    const dateProp = entity?.properties.find((p) => p.name === "datePublished");
    expect(authorProp?.status).toBe("error");
    expect(dateProp?.status).toBe("warning");
    expect(entity?.status).toBe("error");
  });

  it("no lista ni marca propiedades desconocidas", () => {
    const [entity] = validateEntities([{ "@type": "Organization", name: "x", fooBar: 1 }]);
    expect(entity?.properties.some((p) => p.name === "fooBar")).toBe(false);
    expect(entity?.issues.some((i) => i.message.includes("fooBar"))).toBe(false);
  });

  it("una entidad con @type fuera del subconjunto no se valida ni penaliza", () => {
    const [entity] = validateEntities([{ "@type": "UnknownThing" }]);
    expect(entity?.status).toBe("ok");
    expect(entity?.properties).toEqual([]);
    expect(entity?.issues).toEqual([]);
  });

  it("es determinista: mismas entradas producen salidas profundamente iguales", () => {
    const input = [
      { "@type": "Organization", name: "Acme" },
      { "@type": "Product", name: "Zapato", aggregateRating: { ratingValue: "4" } },
    ];
    const a = validateEntities(input);
    const b = validateEntities(input);
    expect(a).toEqual(b);
  });

  it("acumula reglas de todos los tipos conocidos en un @type array (multi-tipo)", () => {
    const [entity] = validateEntities([{ "@type": ["Organization", "LocalBusiness"], name: "Acme" }]);
    // 'address' viene de LocalBusiness (requerida): debe aparecer y estar en error.
    const addressProp = entity?.properties.find((p) => p.name === "address");
    expect(addressProp?.status).toBe("error");
  });

  it("cubre los 13 tipos: cada tipo declara al menos una propiedad", () => {
    const types = [
      "Organization",
      "WebSite",
      "Article",
      "BlogPosting",
      "Product",
      "FAQPage",
      "Person",
      "LocalBusiness",
      "BreadcrumbList",
      "Event",
      "Recipe",
      "Review",
      "Offer",
    ];
    const results = validateEntities(types.map((t) => ({ "@type": t })));
    expect(results).toHaveLength(13);
    for (const r of results) {
      expect(r.properties.length).toBeGreaterThan(0);
    }
  });

  it("expone el @id de la entidad cuando existe", () => {
    const [entity] = validateEntities([
      { "@type": "Organization", "@id": "https://x.example/#org", name: "Acme" },
    ]);
    expect(entity?.id).toBe("https://x.example/#org");
  });
});
